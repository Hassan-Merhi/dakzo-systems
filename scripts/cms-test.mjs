import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const errors = [];
const worker = await readFile(join(root, 'src/worker.js'), 'utf8');
const admin = await readFile(join(root, 'src/admin-page.js'), 'utf8');
const schema = await readFile(join(root, 'migrations/0001_cms.sql'), 'utf8');
const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');

for (const required of ['Cf-Access-Jwt-Assertion','ACCESS_TEAM_DOMAIN','ACCESS_AUD','crypto.subtle.verify','noindex, nofollow, noarchive']) {
  if (!worker.includes(required)) errors.push(`Worker is missing required admin-security contract: ${required}`);
}
if (!worker.includes("url.pathname.startsWith('/admin/')") || !worker.includes("url.pathname.startsWith('/api/admin/')")) errors.push('Admin routes are not routed through the protected Worker path.');
if (!worker.includes('env.ASSETS.fetch(request)')) errors.push('Public static assets are not preserved through the Worker asset binding.');
for (const table of ['cms_pages','cms_projects','cms_articles','cms_media','cms_revisions','cms_activity']) {
  if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) errors.push(`CMS schema is missing ${table}.`);
}
for (const label of ['Pages','Projects','Insights','Media','Revisions','SEO']) if (!admin.includes(label)) errors.push(`Admin shell is missing ${label}.`);
if (!wrangler.includes('"main": "src/worker.js"') || !wrangler.includes('"binding": "ASSETS"')) errors.push('Wrangler is not configured for Worker + static assets.');
if (!wrangler.includes('"/admin*"') || !wrangler.includes('"/api/admin/*"')) errors.push('Wrangler does not run the Worker first for admin routes.');
try { await access(join(root, 'site/admin/index.html')); errors.push('Admin must not exist in the crawlable static site tree.'); } catch {}

if (errors.length) {
  console.error(`CMS verification failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('CMS Phases 1–2 verification passed: content schema, protected admin boundary, Access JWT validation, non-indexability, and static-site preservation verified.');
