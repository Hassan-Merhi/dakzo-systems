import { cp, mkdir, rm, stat, readdir, writeFile } from 'node:fs/promises';
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
    else if (entry.isFile() && entry.name === 'index.html') files.push(path);
  }
  return files;
}

const pages = await collectHtml(output);
const urls = pages.map((file) => {
  const rel = relative(output, file).replaceAll('\\', '/');
  const route = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
  return `${siteUrl}${route}`;
}).sort();

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

const indexStat = await stat(join(output, 'index.html'));
if (indexStat.size < 1000) throw new Error('Production homepage output is unexpectedly small.');
if (urls.length < 10) throw new Error('Production sitemap has unexpectedly few routes.');

console.log(`Build passed: ${urls.length} crawlable routes generated in dist/ for ${siteUrl}.`);