import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = new URL('../', import.meta.url).pathname;
const siteRoot = join(project, 'site');
const pageI18nPath = join(siteRoot, 'assets/i18n-pages.js');
const pageCssPath = join(siteRoot, 'assets/i18n-pages.css');
const baseI18nPath = join(siteRoot, 'assets/i18n.js');
const migrationPath = join(project, 'migrations/0005_i18n_content.sql');

const [runtime, css, migration, worker, publicApi, adminApi, siteScript, buildScript] = await Promise.all([
  readFile(pageI18nPath, 'utf8'),
  readFile(pageCssPath, 'utf8'),
  readFile(migrationPath, 'utf8'),
  readFile(join(project, 'src/worker.js'), 'utf8'),
  readFile(join(project, 'src/public-i18n.js'), 'utf8'),
  readFile(join(project, 'src/admin-i18n.js'), 'utf8'),
  readFile(join(siteRoot, 'assets/site.js'), 'utf8'),
  readFile(join(project, 'scripts/build.mjs'), 'utf8')
]);
const baseI18n = await import(`${pathToFileURL(baseI18nPath).href}?v=${Date.now()}`);

const dictionaries = {};
for (const locale of ['fr', 'ar', 'es']) {
  const chunks = [];
  for (let index = 0; index < 11; index += 1) {
    const file = join(siteRoot, `assets/i18n-pages/${locale}/${index}.js`);
    chunks.push((await import(`${pathToFileURL(file).href}?v=${Date.now()}-${index}`)).default);
  }
  dictionaries[locale] = Object.assign({}, ...chunks);
}

const keys = Object.keys(dictionaries.fr).sort();
assert.ok(keys.length >= 560, `Expected at least 560 translated source strings, found ${keys.length}.`);
assert.deepEqual(Object.keys(dictionaries.ar).sort(), keys, 'Arabic must cover the same full-page source strings as French.');
assert.deepEqual(Object.keys(dictionaries.es).sort(), keys, 'Spanish must cover the same full-page source strings as French.');

for (const token of [
  'CHUNK_COUNT = 11',
  'dakzo:languagechange',
  "document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'",
  'new MutationObserver',
  'localizedValidation',
  "fetch(`/api/i18n?${query}`",
  '.site-header .header-row',
  "meta[property=\"og:title\"]"
]) assert.ok(runtime.includes(token), `Page i18n runtime is missing ${token}.`);

for (const token of [
  'html[dir="rtl"] .skip-link',
  'html[dir="rtl"] .capability-item:nth-child(even)',
  'html[dir="rtl"] input[type="email"]',
  'html[dir="rtl"] .article-shell',
  '@media (max-width: 980px)'
]) assert.ok(css.includes(token), `RTL page stylesheet is missing ${token}.`);

for (const token of [
  'CREATE TABLE IF NOT EXISTS cms_translations',
  "locale IN ('fr','ar','es')",
  'i18n_required',
  'TRANSLATIONS_REQUIRED',
  'cms_publications_require_i18n_insert',
  'cms_publications_require_i18n_update'
]) assert.ok(migration.includes(token), `Migration 0005 is missing ${token}.`);

for (const token of ['handlePublicI18n', "url.pathname === '/api/i18n'", 'handleAdminI18n']) {
  assert.ok(worker.includes(token), `Worker is missing multilingual routing: ${token}.`);
}
for (const token of ['FROM cms_translations', 'is_complete=1', 'cms_publications']) {
  assert.ok(publicApi.includes(token), `Public CMS translation API is missing ${token}.`);
}
for (const token of ['ON CONFLICT(entity_type,entity_id,locale)', 'isComplete', 'strings_json']) {
  assert.ok(adminApi.includes(token), `Admin CMS translation API is missing ${token}.`);
}
assert.ok(siteScript.includes("import('/assets/i18n-pages.js')"), 'Shared site runtime must bootstrap full-page i18n before base i18n.');
assert.ok(buildScript.includes('i18n-pages.js') && buildScript.includes('i18n-pages.css'), 'Production build must budget full-page i18n assets.');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}
function decode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&nbsp;', ' ');
}
function normalize(value) { return decode(value).replace(/\s+/g, ' ').trim(); }

const shared = new Set(Object.values(baseI18n.STRINGS?.['en-US'] || {}));
const technical = new Set([
  'Dakzo Systems','Dakik LLC','HMD ERP','Congo Delivery','Moto Track','ERP','POS','WhatsApp','GPS','SVG',
  'LinkedIn','GitHub','YouTube','Instagram','HTTPS','CI','IP','404','WebP','JPG','D1','R2'
]);
function exempt(value) {
  if (!value || shared.has(value) || technical.has(value)) return true;
  if (/^[\d\s/.,:+$€£%()#©→←↗↖–—-]+$/.test(value)) return true;
  if (/^\/[a-z0-9/_-]+\/?$/i.test(value)) return true;
  return false;
}
function verify(value, file, kind, errors) {
  const source = normalize(value);
  if (exempt(source)) return;
  for (const locale of ['fr','ar','es']) {
    if (!dictionaries[locale][source]) errors.push(`${relative(siteRoot, file)}: ${kind} missing ${locale} for "${source}"`);
  }
}

const htmlFiles = await walk(siteRoot);
assert.ok(htmlFiles.length >= 17, `Expected at least 17 public HTML pages, found ${htmlFiles.length}.`);
const errors = [];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
  for (const match of cleaned.matchAll(/>([^<>]+)</g)) verify(match[1], file, 'text', errors);
  for (const match of cleaned.matchAll(/\b(?:aria-label|placeholder|alt|title)="([^"]*)"/gi)) verify(match[1], file, 'attribute', errors);
  const description = cleaned.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
  if (description) verify(description, file, 'meta description', errors);
}
if (errors.length) {
  console.error(`Full-page i18n coverage failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Full-page i18n verification passed: ${htmlFiles.length} public pages and ${keys.length} source strings are covered in French, Arabic, and Spanish, with RTL, forms, dynamic CMS translations, and publication requirements.`);
