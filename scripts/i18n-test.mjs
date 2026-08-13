import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = new URL('../', import.meta.url).pathname;
const i18nPath = join(project, 'site/assets/i18n.js');
const pageI18nPath = join(project, 'site/assets/page-i18n.js');
const stylesPath = join(project, 'site/assets/i18n.css');
const siteScriptPath = join(project, 'site/assets/site.js');
const localePaths = {
  fr: join(project, 'site/assets/i18n-pages/fr.js'),
  ar: join(project, 'site/assets/i18n-pages/ar.js'),
  es: join(project, 'site/assets/i18n-pages/es.js')
};

const [i18nSource, pageI18nSource, styles, siteScript, frSource, arSource, esSource] = await Promise.all([
  readFile(i18nPath, 'utf8'),
  readFile(pageI18nPath, 'utf8'),
  readFile(stylesPath, 'utf8'),
  readFile(siteScriptPath, 'utf8'),
  readFile(localePaths.fr, 'utf8'),
  readFile(localePaths.ar, 'utf8'),
  readFile(localePaths.es, 'utf8')
]);

const temporaryModule = join(tmpdir(), `dakzo-i18n-${process.pid}.mjs`);
await writeFile(temporaryModule, i18nSource);
let i18nModule;
try {
  i18nModule = await import(`${pathToFileURL(temporaryModule).href}?v=${Date.now()}`);
} finally {
  await rm(temporaryModule, { force: true });
}

assert.equal(i18nModule.DEFAULT_LANGUAGE, 'en-US', 'English (US) must be the default locale.');
assert.deepEqual(
  i18nModule.LANGUAGES.map(({ code }) => code),
  ['en-US', 'fr', 'ar', 'es'],
  'The public language selector must expose exactly the four requested locales.'
);
assert.equal(i18nModule.LANGUAGES.find(({ code }) => code === 'ar')?.dir, 'rtl', 'Arabic must declare RTL direction.');
assert.equal(i18nModule.STORAGE_KEY, 'dakzo-language', 'The language preference must use the stable storage key.');

for (const label of ['English (US)', 'Français', 'العربية', 'Español']) {
  assert.ok(i18nSource.includes(label), `Missing selector label: ${label}`);
}
for (const sharedKey of ['skipMain', 'openNav', 'primaryNav', 'solutions', 'services', 'work', 'about', 'insights', 'startProject', 'footerLegal', 'footerTagline']) {
  const occurrences = i18nSource.split(`${sharedKey}:`).length - 1;
  assert.equal(occurrences, 4, `${sharedKey} must exist in all four locale dictionaries.`);
}

assert.ok(i18nSource.includes("localStorage.setItem(STORAGE_KEY, language)"), 'Language selection must persist across visits.');
assert.ok(!i18nSource.includes('navigator.language'), 'Browser language detection must not override the English (US) default.');
assert.ok(i18nSource.includes("document.documentElement.dir = direction"), 'Locale changes must update document direction.');
assert.ok(i18nSource.includes("nav.insertBefore(wrapper, cta)"), 'The global selector must be inserted into the primary navigation.');

assert.ok(siteScript.includes("import('/assets/page-i18n.js')"), 'Every shared page must load the page-content translator.');
assert.ok(siteScript.includes("import('/assets/i18n.js')"), 'Every page using the shared site script must initialize shared i18n.');
assert.ok(siteScript.includes("initPageI18n({ language: 'en-US' })"), 'Page translation must capture the original English DOM before applying a stored locale.');
assert.ok(siteScript.includes('pageI18n.setLanguage(i18n.language)'), 'The stored locale must be applied to full page content after shared i18n initializes.');
assert.ok(siteScript.includes("dakzo:languagechange"), 'Interactive inquiry UI must react to language changes.');

for (const locale of ['fr', 'ar', 'es']) {
  assert.ok(pageI18nSource.includes(`${locale}: '/assets/i18n-pages/${locale}.js'`), `Missing lazy page dictionary for ${locale}.`);
}
assert.ok(pageI18nSource.includes("document.querySelector('#main')"), 'Full main-page content must participate in translation.');
assert.ok(pageI18nSource.includes("document.querySelector('[data-theme-control]')"), 'Theme control wording must participate in translation.');
assert.ok(pageI18nSource.includes("window.addEventListener('dakzo:languagechange'"), 'Page content must update immediately when the locale changes.');
assert.ok(pageI18nSource.includes('applyDictionary(null, true)'), 'Switching back to English must restore the original page text.');
assert.ok(pageI18nSource.includes('MutationObserver'), 'Dynamically mounted shared controls must be translated too.');

const localeSources = { fr: frSource, ar: arSource, es: esSource };
const representativePageKeys = [
  'Theme',
  'We build systems that',
  'Technology shaped around the way your business actually works.',
  'Design, engineering, and product thinking under one roof.',
  'Systems for operations that have outgrown generic software.',
  'Built products, not just presentations.',
  'Tell us what should work better.',
  'Software decisions explained around real operations.',
  'Clear data handling, without unnecessary collection.',
  'HMD ERP: one operating system for a complex business.',
  'Congo Delivery: software around the delivery journey.',
  'Moto Track: fleet visibility built around action.',
  'Custom ERP vs. off-the-shelf ERP',
  'When custom software is worth it',
  'How logistics platforms connect operations',
  'How fleet tracking systems work',
  'That page isn’t here.'
];
for (const [locale, source] of Object.entries(localeSources)) {
  for (const key of representativePageKeys) {
    assert.ok(source.includes(JSON.stringify(key)), `${locale} is missing representative full-page translation key: ${key}`);
  }
}

assert.ok(styles.includes('html[dir="rtl"]'), 'RTL-safe shared styles are required.');
assert.ok(styles.includes('.site-header .container'), 'Translated desktop navigation must have a wider alignment-safe header container.');
assert.ok(styles.includes('white-space: nowrap'), 'Desktop navigation controls must not split translated labels across lines.');
assert.ok(styles.includes('@media (max-width: 1180px)'), 'Translated navigation must switch to the menu before laptop-width wrapping occurs.');
assert.ok(styles.includes('html[data-locale="fr"] .hero h1'), 'French hero typography must adapt to longer copy.');
assert.ok(styles.includes('html[data-locale="ar"] .hero h1'), 'Arabic hero typography must have locale-specific sizing.');
assert.ok(styles.includes('letter-spacing: 0'), 'Arabic typography must remove Latin tracking that harms alignment/readability.');
assert.ok(styles.includes('unicode-bidi: isolate'), 'LTR technical content must remain stable inside Arabic pages.');

console.log('i18n verification passed: English (US) default, four-language selector, full-page French/Arabic/Spanish dictionaries, live language switching, English restoration, theme translation, RTL handling, and wrap-safe responsive navigation are present.');
