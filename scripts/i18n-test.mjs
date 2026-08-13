import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = new URL('../', import.meta.url).pathname;
const i18nPath = join(project, 'site/assets/i18n.js');
const stylesPath = join(project, 'site/assets/i18n.css');
const siteScriptPath = join(project, 'site/assets/site.js');

const [i18nSource, styles, siteScript] = await Promise.all([
  readFile(i18nPath, 'utf8'),
  readFile(stylesPath, 'utf8'),
  readFile(siteScriptPath, 'utf8')
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
assert.ok(siteScript.includes("import('/assets/i18n.js')"), 'Every page using the shared site script must initialize i18n.');
assert.ok(siteScript.includes("dakzo:languagechange"), 'Interactive inquiry UI must react to language changes.');
assert.ok(styles.includes('html[dir="rtl"]'), 'RTL-safe shared styles are required.');
assert.ok(styles.includes('@media (max-width: 980px)'), 'The language selector must have mobile styling.');

console.log('i18n verification passed: English (US) default, four-language selector, persistence, shared translations, RTL foundation, and responsive styling are present.');
