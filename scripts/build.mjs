import { cp, mkdir, rm, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const project = new URL('../', import.meta.url).pathname;
const source = join(project, 'site');
const output = join(project, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://dakzosystems.com').replace(/\/$/, '');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

async function collectHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

const htmlFiles = await collectHtml(output);
const pages = htmlFiles.filter((file) => file.endsWith('index.html'));
const urls = pages.map((file) => {
  const rel = relative(output, file).replaceAll('\\', '/');
  const route = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
  return `${siteUrl}${route}`;
}).sort();

const themeHead = '<script src="/assets/theme.js"></script><link rel="stylesheet" href="/assets/theme.css">';
for (const file of htmlFiles) {
  let html = await readFile(file, 'utf8');
  if (!html.includes('/assets/theme.js')) html = html.replace('</head>', `${themeHead}</head>`);
  if (!html.includes('/assets/theme.css')) throw new Error(`${relative(output, file)} is missing the theme stylesheet.`);
  if (html.indexOf('/assets/theme.js') > html.indexOf('/assets/theme.css')) throw new Error(`${relative(output, file)} loads the theme initializer after the theme stylesheet.`);
  await writeFile(file, html);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

const indexStat = await stat(join(output, 'index.html'));
if (indexStat.size < 1000) throw new Error('Production homepage output is unexpectedly small.');
if (urls.length < 15) throw new Error('Production sitemap has unexpectedly few routes.');

const requiredProductionFiles = ['404.html','health.json','.well-known/security.txt','privacy/index.html','assets/i18n.js','assets/i18n.css','assets/i18n-pages.js','assets/i18n-pages.css'];
for (const path of requiredProductionFiles) await stat(join(output, path));

const jsBudget = 48 * 1024;
const localeChunkBudget = 24 * 1024;
const cssBudget = 40 * 1024;
const htmlBudget = 16 * 1024;
const coreJsFiles = ['site.js', 'theme.js', 'i18n.js', 'i18n-pages.js'];
let coreJsSize = 0;
for (const file of coreJsFiles) coreJsSize += (await stat(join(output, 'assets', file))).size;
let largestLocaleChunk = 0;
for (const locale of ['fr','ar','es']) {
  for (let index = 0; index < 11; index += 1) {
    const size = (await stat(join(output, 'assets/i18n-pages', locale, `${index}.js`))).size;
    largestLocaleChunk = Math.max(largestLocaleChunk, size);
    if (size > localeChunkBudget) throw new Error(`${locale}/${index}.js exceeds ${localeChunkBudget} byte locale chunk budget (${size}).`);
  }
}
const cssFiles = ['styles.css', 'wave3.css', 'wave5.css', 'theme.css', 'i18n.css', 'i18n-pages.css'];
let cssSize = 0;
for (const file of cssFiles) cssSize += (await stat(join(output, 'assets', file))).size;
if (coreJsSize > jsBudget) throw new Error(`Core JavaScript exceeds ${jsBudget} byte production budget (${coreJsSize}).`);
if (cssSize > cssBudget) throw new Error(`CSS exceeds ${cssBudget} byte production budget (${cssSize}).`);

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const size = Buffer.byteLength(html);
  if (size > htmlBudget) throw new Error(`${relative(output, file)} exceeds ${htmlBudget} byte HTML budget (${size}).`);
  if (!html.includes('name="viewport"')) throw new Error(`${relative(output, file)} is missing a mobile viewport.`);
  if (!html.includes('/assets/theme.js') || !html.includes('/assets/theme.css')) throw new Error(`${relative(output, file)} is missing global theme assets.`);
  if (/src="https?:\/\//i.test(html)) throw new Error(`${relative(output, file)} contains a third-party executable script.`);
}

console.log(`Build passed: ${urls.length} crawlable routes and ${htmlFiles.length} themed HTML files generated for ${siteUrl}; core JS ${coreJsSize} B; largest lazy locale chunk ${largestLocaleChunk} B; CSS ${cssSize} B; per-page HTML budget ${htmlBudget} B.`);
