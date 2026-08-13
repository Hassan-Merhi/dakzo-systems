const DEFAULT_LANGUAGE = 'en-US';
const SUPPORTED = new Set(['en-US', 'fr', 'ar', 'es']);
const CHUNK_COUNT = 11;
const ATTRIBUTES = ['aria-label', 'placeholder', 'alt', 'title'];
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const localeCache = new Map();
let currentLanguage = DEFAULT_LANGUAGE;
let observer;
let requestId = 0;

function normalizeLanguage(value) {
  return SUPPORTED.has(value) ? value : DEFAULT_LANGUAGE;
}

function ignored(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return Boolean(element?.closest('[data-i18n-ignore], script, style, noscript, template'));
}

function remember(node) {
  if (ignored(node)) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
    return;
  }
  if (!(node instanceof Element) || originalAttributes.has(node)) return;
  const values = new Map();
  for (const name of ATTRIBUTES) if (node.hasAttribute(name)) values.set(name, node.getAttribute(name));
  if (node.matches('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]') && node.hasAttribute('content')) {
    values.set('content', node.getAttribute('content'));
  }
  originalAttributes.set(node, values);
}

function walk(root, callback) {
  if (!root) return;
  if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.TEXT_NODE) callback(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) callback(node);
}

function capture(root) { walk(root, remember); }

function restore(root) {
  walk(root, (node) => {
    if (node.nodeType === Node.TEXT_NODE && originalText.has(node)) {
      node.nodeValue = originalText.get(node);
      return;
    }
    if (!(node instanceof Element)) return;
    const values = originalAttributes.get(node);
    if (!values) return;
    for (const [name, value] of values) {
      if (value === null) node.removeAttribute(name);
      else node.setAttribute(name, value);
    }
  });
}

function preserveWhitespace(original, translated) {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function translateRoot(root, dictionary) {
  walk(root, (node) => {
    if (ignored(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const original = originalText.get(node);
      if (original === undefined) return;
      const source = original.trim();
      const translated = dictionary[source];
      if (source && translated) node.nodeValue = preserveWhitespace(original, translated);
      return;
    }
    if (!(node instanceof Element)) return;
    const values = originalAttributes.get(node);
    if (!values) return;
    for (const [name, original] of values) {
      const source = String(original || '').trim();
      const translated = dictionary[source];
      if (source && translated) node.setAttribute(name, translated);
    }
  });
}

async function loadBuiltInDictionary(language) {
  if (language === DEFAULT_LANGUAGE) return {};
  if (localeCache.has(language)) return localeCache.get(language);
  const modules = await Promise.all(
    Array.from({ length: CHUNK_COUNT }, (_, index) => import(`/assets/i18n-pages/${language}/${index}.js`))
  );
  const dictionary = Object.assign({}, ...modules.map((module) => module.default || {}));
  localeCache.set(language, dictionary);
  return dictionary;
}

async function loadCmsDictionary(language) {
  if (language === DEFAULT_LANGUAGE) return { strings: {} };
  try {
    const query = new URLSearchParams({ path: window.location.pathname, locale: language });
    const response = await fetch(`/api/i18n?${query}`, { headers: { accept: 'application/json' } });
    if (!response.ok) return { strings: {} };
    const data = await response.json();
    return data && typeof data === 'object' ? data : { strings: {} };
  } catch {
    return { strings: {} };
  }
}

function syncMetadata(cms) {
  if (cms?.seoTitle) document.title = String(cms.seoTitle);
  const description = document.querySelector('meta[name="description"]');
  if (description && cms?.seoDescription) description.setAttribute('content', String(cms.seoDescription));
  const text = description?.getAttribute('content') || '';
  for (const meta of document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')) meta.setAttribute('content', document.title);
  for (const meta of document.querySelectorAll('meta[property="og:description"], meta[name="twitter:description"]')) meta.setAttribute('content', text);
}

function localizedValidation(field, dictionary) {
  field.setCustomValidity('');
  if (field.validity.valueMissing) return dictionary['Please complete this field.'] || '';
  if (field.validity.typeMismatch && field.getAttribute('type') === 'email') return dictionary['Please enter a valid email address.'] || '';
  if (field.validity.tooShort) return dictionary['Please enter at least 30 characters.'] || '';
  return '';
}

function installValidation(dictionary) {
  document.querySelectorAll('[data-project-form] input, [data-project-form] select, [data-project-form] textarea').forEach((field) => {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    field.setCustomValidity('');
    field.oninvalid = () => {
      const message = localizedValidation(field, dictionary);
      if (message) field.setCustomValidity(message);
    };
    field.oninput = () => field.setCustomValidity('');
    field.onchange = () => field.setCustomValidity('');
  });
}

function ensureStyles() {
  if (document.querySelector('link[data-i18n-pages-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/i18n-pages.css';
  link.dataset.i18nPagesStyles = '';
  document.head.append(link);
}

function ensureFallbackPicker() {
  if (document.querySelector('[data-language-picker]') || document.querySelector('[data-page-language-picker]')) return;
  const row = document.querySelector('.site-header .header-row');
  if (!row || !window.DakzoI18n) return;
  const label = document.createElement('label');
  label.className = 'language-picker page-language-picker';
  label.dataset.pageLanguagePicker = '';
  label.dataset.i18nIgnore = '';
  const caption = document.createElement('span');
  caption.className = 'language-picker-label';
  caption.textContent = 'Language';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Language');
  for (const language of window.DakzoI18n.languages || []) {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = language.label;
    select.append(option);
  }
  select.value = window.DakzoI18n.language || DEFAULT_LANGUAGE;
  select.addEventListener('change', () => void window.DakzoI18n.setLanguage(select.value));
  label.append(caption, select);
  row.append(label);
}

async function applyLanguage(language) {
  const id = ++requestId;
  const next = normalizeLanguage(language);
  const [builtIn, cms] = await Promise.all([loadBuiltInDictionary(next), loadCmsDictionary(next)]);
  if (id !== requestId) return;
  currentLanguage = next;
  const dictionary = { ...builtIn, ...(cms.strings && typeof cms.strings === 'object' ? cms.strings : {}) };
  observer?.disconnect();
  restore(document.documentElement);
  if (next !== DEFAULT_LANGUAGE) translateRoot(document.documentElement, dictionary);
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  syncMetadata(cms);
  installValidation(dictionary);
  observer?.observe(document.documentElement, { childList: true, subtree: true });
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((records) => {
    const dictionary = localeCache.get(currentLanguage) || {};
    for (const record of records) {
      for (const node of record.addedNodes) {
        capture(node);
        if (currentLanguage !== DEFAULT_LANGUAGE) translateRoot(node, dictionary);
      }
    }
    ensureFallbackPicker();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function initPageI18n() {
  if (window.DakzoPageI18n?.ready) return window.DakzoPageI18n;
  ensureStyles();
  capture(document.documentElement);
  startObserver();

  const api = {
    ready: true,
    applyLanguage,
    translateElement: async (root) => {
      const builtIn = await loadBuiltInDictionary(currentLanguage);
      capture(root);
      translateRoot(root, builtIn);
    }
  };
  window.DakzoPageI18n = api;
  window.addEventListener('dakzo:languagechange', (event) => {
    void applyLanguage(event.detail?.language || DEFAULT_LANGUAGE);
    queueMicrotask(ensureFallbackPicker);
  });
  queueMicrotask(ensureFallbackPicker);
  return api;
}
