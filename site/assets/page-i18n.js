const LOCALE_MODULES = {
  fr: '/assets/i18n-pages/fr.js',
  ar: '/assets/i18n-pages/ar.js',
  es: '/assets/i18n-pages/es.js'
};

const ATTRIBUTE_NAMES = ['placeholder', 'aria-label', 'title', 'alt'];
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
let originalTitle = null;
let originalDescription = null;
let activeLanguage = 'en-US';
let activeDictionary = null;
let loadSequence = 0;
let observer = null;

function normalizeLanguage(language) {
  return Object.hasOwn(LOCALE_MODULES, language) ? language : 'en-US';
}

function rememberMetadata() {
  if (originalTitle === null) originalTitle = document.title;
  if (originalDescription === null) {
    originalDescription = document.querySelector('meta[name="description"]')?.content ?? '';
  }
}

function preserveOuterWhitespace(original, translated) {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest('script, style, noscript, svg, [data-no-translate]'));
}

function translateTextNode(node, dictionary, restoreEnglish) {
  if (shouldSkipTextNode(node)) return;
  if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? '');
  const english = originalText.get(node) ?? '';
  const key = english.trim();
  if (!key) return;

  if (restoreEnglish) {
    node.nodeValue = english;
    return;
  }

  const translated = dictionary?.[key];
  if (typeof translated === 'string') node.nodeValue = preserveOuterWhitespace(english, translated);
}

function translateAttributes(element, dictionary, restoreEnglish) {
  let originals = originalAttributes.get(element);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(element, originals);
  }

  for (const name of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(name) && !originals.has(name)) continue;
    if (!originals.has(name)) originals.set(name, element.getAttribute(name) ?? '');
    const english = originals.get(name) ?? '';
    if (restoreEnglish) {
      element.setAttribute(name, english);
      continue;
    }
    const translated = dictionary?.[english.trim()];
    if (typeof translated === 'string') element.setAttribute(name, translated);
  }
}

function translateTree(root, dictionary, restoreEnglish) {
  if (!(root instanceof Element)) return;
  translateAttributes(root, dictionary, restoreEnglish);

  const elements = root.querySelectorAll('*');
  elements.forEach((element) => translateAttributes(element, dictionary, restoreEnglish));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node, dictionary, restoreEnglish);
    node = walker.nextNode();
  }
}

function translateMetadata(dictionary, restoreEnglish) {
  rememberMetadata();
  const description = document.querySelector('meta[name="description"]');

  if (restoreEnglish) {
    document.title = originalTitle ?? document.title;
    if (description && originalDescription !== null) description.content = originalDescription;
    return;
  }

  const titleTranslation = dictionary?.[(originalTitle ?? '').trim()];
  if (typeof titleTranslation === 'string') document.title = titleTranslation;

  const descriptionTranslation = dictionary?.[(originalDescription ?? '').trim()];
  if (description && typeof descriptionTranslation === 'string') description.content = descriptionTranslation;
}

function applyDictionary(dictionary, restoreEnglish = false) {
  const main = document.querySelector('#main');
  if (main) translateTree(main, dictionary, restoreEnglish);

  const themeControl = document.querySelector('[data-theme-control]');
  if (themeControl) translateTree(themeControl, dictionary, restoreEnglish);

  translateMetadata(dictionary, restoreEnglish);
}

async function loadDictionary(language) {
  if (language === 'en-US') return null;
  const modulePath = LOCALE_MODULES[language];
  if (!modulePath) return null;
  const module = await import(modulePath);
  return module.default ?? {};
}

async function setPageLanguage(language) {
  const normalized = normalizeLanguage(language);
  activeLanguage = normalized;
  const sequence = ++loadSequence;

  if (normalized === 'en-US') {
    activeDictionary = null;
    applyDictionary(null, true);
    return;
  }

  try {
    const dictionary = await loadDictionary(normalized);
    if (sequence !== loadSequence || activeLanguage !== normalized) return;
    activeDictionary = dictionary;
    applyDictionary(activeDictionary, false);
  } catch (error) {
    console.warn(`Dakzo page translation failed for ${normalized}.`, error);
  }
}

function observeDynamicContent() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (activeLanguage === 'en-US' || !activeDictionary) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-theme-control]') || node.closest('#main') || node.querySelector('#main, [data-theme-control]')) {
          translateTree(node, activeDictionary, false);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function initPageI18n(i18n = window.DakzoI18n) {
  rememberMetadata();
  observeDynamicContent();
  const initialLanguage = i18n?.language || document.documentElement.dataset.locale || 'en-US';
  void setPageLanguage(initialLanguage);

  window.addEventListener('dakzo:languagechange', (event) => {
    void setPageLanguage(event.detail?.language || 'en-US');
  });

  return {
    setLanguage: setPageLanguage,
    get language() {
      return activeLanguage;
    }
  };
}
