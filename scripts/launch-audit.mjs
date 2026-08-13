import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const project = new URL('../', import.meta.url).pathname;
const dist = join(project, 'dist');
const errors = [];

async function collect(dir, name) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(path, name));
    else if (entry.isFile() && entry.name === name) out.push(path);
  }
  return out;
}

try { await access(dist); } catch { errors.push('Missing dist/. Run the production build before the launch audit.'); }

if (!errors.length) {
  const htmlFiles = await collect(dist, 'index.html');
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
  const robots = await readFile(join(dist, 'robots.txt'), 'utf8');
  const render = await readFile(join(project, 'render.yaml'), 'utf8');
  const security = await readFile(join(dist, '.well-known/security.txt'), 'utf8');
  const health = JSON.parse(await readFile(join(dist, 'health.json'), 'utf8'));

  if (htmlFiles.length < 16) errors.push(`Expected at least 16 crawlable pages, found ${htmlFiles.length}.`);
  if (!robots.includes('Sitemap: https://')) errors.push('robots.txt does not publish an HTTPS sitemap URL.');
  if (!sitemap.includes('<urlset') || !sitemap.includes('<loc>https://')) errors.push('sitemap.xml is missing HTTPS URL entries.');
  if (health.status !== 'ok') errors.push('health.json does not report status=ok.');
  if (!security.includes('Canonical: https://')) errors.push('security.txt is missing an HTTPS canonical URL.');

  const requiredHeaders = ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'];
  for (const header of requiredHeaders) if (!render.includes(header)) errors.push(`Missing production security header configuration: ${header}`);
  if (!render.includes('autoDeployTrigger: checksPass')) errors.push('Production deploy is not gated on passing checks.');

  const placeholderPatterns = [
    [/\bTODO\b/i, 'TODO marker'],
    [/\bFIXME\b/i, 'FIXME marker'],
    [/localhost(?::\d+)?/i, 'localhost reference'],
    [/example\.(com|org|net)/i, 'example-domain placeholder']
  ];

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const label = relative(dist, file);
    if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${label} is missing a non-empty title.`);
    if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) errors.push(`${label} is missing a meta description.`);
    if (!html.includes('name="viewport"')) errors.push(`${label} is missing the mobile viewport.`);
    for (const [pattern, name] of placeholderPatterns) if (pattern.test(html)) errors.push(`${label} contains a ${name}.`);
  }

  for (const required of ['404.html', 'privacy/index.html', 'brand/index.html', 'work/hmd-erp/index.html', 'work/congo-delivery/index.html', 'work/moto-track/index.html']) {
    try { await access(join(dist, required)); } catch { errors.push(`Missing launch-critical production file: ${required}`); }
  }
}

if (errors.length) {
  console.error(`Launch audit failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Launch audit passed: production output, crawlability, security configuration, placeholders, critical routes, and metadata verified.');
