import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const errors = [];
const worker = await readFile(join(root, 'src/worker.js'), 'utf8');
const admin = await readFile(join(root, 'src/admin-page.js'), 'utf8');
const schema = await readFile(join(root, 'migrations/0001_cms.sql'), 'utf8');
const seed = await readFile(join(root, 'migrations/0002_media_projects.sql'), 'utf8');
const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');

for (const required of ['Cf-Access-Jwt-Assertion','ACCESS_TEAM_DOMAIN','ACCESS_AUD','crypto.subtle.verify','noindex, nofollow, noarchive']) {
  if (!worker.includes(required)) errors.push(`Worker is missing required admin-security contract: ${required}`);
}
if (!worker.includes("url.pathname.startsWith('/admin/')") || !worker.includes("url.pathname.startsWith('/api/admin/')")) errors.push('Admin routes are not routed through the protected Worker path.');
if (!worker.includes('env.ASSETS.fetch(request)')) errors.push('Public static assets are not preserved through the Worker asset binding.');
if (!worker.includes("request.headers.get('origin') === url.origin")) errors.push('Admin mutations are missing the same-origin CSRF boundary.');

for (const table of ['cms_pages','cms_projects','cms_articles','cms_media','cms_revisions','cms_activity']) {
  if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) errors.push(`CMS schema is missing ${table}.`);
}
for (const project of ['HMD ERP','Congo Delivery','Moto Track']) if (!seed.includes(project)) errors.push(`CMS project seed is missing ${project}.`);

for (const required of ['MEDIA_BUCKET.put','MEDIA_BUCKET.get','MEDIA_BUCKET.delete','MAX_UPLOAD_BYTES','ALLOWED_IMAGE_TYPES','/api/admin/media']) {
  if (!worker.includes(required)) errors.push(`Phase 3 media contract is missing: ${required}`);
}
for (const required of ['/api/admin/projects','createProject','updateProject','archiveProject','cms_revisions','cms_activity','env.CMS_DB.batch']) {
  if (!worker.includes(required)) errors.push(`Phase 4 project contract is missing: ${required}`);
}
if (!admin.includes('SVG uploads are intentionally blocked')) errors.push('Media safety policy does not document SVG handling.');
if (!worker.includes('image/avif') || !worker.includes('image/webp')) errors.push('Modern safe image formats are not included in the media allowlist.');

for (const label of ['Media Library','Project Manager','Upload image','Hero image','Gallery images','SEO title','Archive project']) {
  if (!admin.includes(label)) errors.push(`Admin UI is missing Phase 3–4 control: ${label}`);
}
if (!admin.includes('textContent') || admin.includes('eval(')) errors.push('Admin client rendering must use safe DOM APIs and avoid eval.');

if (!wrangler.includes('"main": "src/worker.js"') || !wrangler.includes('"binding": "ASSETS"')) errors.push('Wrangler is not configured for Worker + static assets.');
if (!wrangler.includes('"/admin*"') || !wrangler.includes('"/api/admin/*"')) errors.push('Wrangler does not run the Worker first for admin routes.');
if (!wrangler.includes('"nodejs_compat"')) errors.push('Wrangler should enable nodejs_compat per Workers best practices.');
if (!wrangler.includes('"observability"')) errors.push('Wrangler should enable Worker observability for production diagnostics.');
try { await access(join(root, 'site/admin/index.html')); errors.push('Admin must not exist in the crawlable static site tree.'); } catch {}

if (errors.length) {
  console.error(`CMS verification failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('CMS Phases 1–4 verification passed: Access boundary, D1 content model, R2 media CRUD, project CRUD, revision/activity safety, admin UI, non-indexability, and static-site preservation verified.');
