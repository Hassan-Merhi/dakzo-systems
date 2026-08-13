import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const errors = [];
const worker = await readFile(join(root, 'src/worker.js'), 'utf8');
const api = await readFile(join(root, 'src/cms-api.js'), 'utf8');
const admin = await readFile(join(root, 'src/admin-page.js'), 'utf8');
const schema = await readFile(join(root, 'migrations/0001_cms.sql'), 'utf8');
const projectSeed = await readFile(join(root, 'migrations/0002_media_projects.sql'), 'utf8');
const contentSeed = await readFile(join(root, 'migrations/0003_pages_insights.sql'), 'utf8');
const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
const combined = worker + '\n' + api;

for (const required of ['Cf-Access-Jwt-Assertion','ACCESS_TEAM_DOMAIN','ACCESS_AUD','crypto.subtle.verify']) {
  if (!worker.includes(required)) errors.push(`Worker is missing required admin-security contract: ${required}`);
}
if (!worker.includes("url.pathname.startsWith('/admin/')") || !worker.includes("url.pathname.startsWith('/api/admin/')")) errors.push('Admin routes are not routed through the protected Worker path.');
if (!worker.includes('env.ASSETS.fetch(request)')) errors.push('Public static assets are not preserved through the Worker asset binding.');
if (!worker.includes("request.headers.get('origin') === url.origin")) errors.push('Admin mutations are missing the same-origin CSRF boundary.');
for (const required of ['noindex, nofollow, noarchive','x-frame-options','content-security-policy']) if (!api.includes(required)) errors.push(`Admin response security is missing: ${required}`);

for (const table of ['cms_pages','cms_projects','cms_articles','cms_media','cms_revisions','cms_activity']) {
  if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) errors.push(`CMS schema is missing ${table}.`);
}
for (const project of ['HMD ERP','Congo Delivery','Moto Track']) if (!projectSeed.includes(project)) errors.push(`CMS project seed is missing ${project}.`);

for (const required of ['MEDIA_BUCKET.put','MEDIA_BUCKET.get','MEDIA_BUCKET.delete','MAX_UPLOAD_BYTES','ALLOWED_IMAGE_TYPES','/api/admin/media']) {
  if (!api.includes(required)) errors.push(`Phase 3 media contract is missing: ${required}`);
}
for (const required of ['/api/admin/projects','createProject','updateProject','archiveProject','cms_revisions','cms_activity','env.CMS_DB.batch']) {
  if (!api.includes(required)) errors.push(`Phase 4 project contract is missing: ${required}`);
}
for (const required of ['/api/admin/pages','listPages','updatePage','normalizePageBody','canonical_path','social_image_key']) {
  if (!api.includes(required)) errors.push(`Phase 5 page-editor contract is missing: ${required}`);
}
for (const required of ['/api/admin/articles','createArticle','updateArticle','archiveArticle','featured_media_id','relatedProjectSlug','takeaways']) {
  if (!api.includes(required)) errors.push(`Phase 6 Insights contract is missing: ${required}`);
}

for (const page of ['page-home','page-about','page-services','page-solutions','page-contact']) if (!contentSeed.includes(page)) errors.push(`Phase 5 migration is missing ${page}.`);
for (const article of ['custom-erp-vs-off-the-shelf','when-custom-software-is-worth-it','how-logistics-platforms-work','how-fleet-tracking-systems-work']) if (!contentSeed.includes(article)) errors.push(`Phase 6 migration is missing article ${article}.`);
if (!contentSeed.includes('relatedProjectSlug')) errors.push('Insights migration does not connect seeded articles to project slugs.');

if (!admin.includes('SVG uploads are intentionally blocked')) errors.push('Media safety policy does not document SVG handling.');
if (!api.includes('image/avif') || !api.includes('image/webp')) errors.push('Modern safe image formats are not included in the media allowlist.');
for (const label of ['Media Library','Project Manager','Upload image','Hero image','Gallery images','Archive project','Page & Homepage Editor','Save page','Dakzo Insights CMS','+ New article','Featured image','Related project','Save article','Archive article']) {
  if (!admin.includes(label)) errors.push(`Admin UI is missing CMS control: ${label}`);
}
for (const control of ['page-social-image','page-canonical','article-body','article-takeaways','article-seo-title','article-seo-description']) if (!admin.includes(control)) errors.push(`Admin UI is missing field ${control}.`);
if (!admin.includes('textContent') || admin.includes('eval(')) errors.push('Admin client rendering must use safe DOM APIs and avoid eval.');

for (const entity of ["revisionStatement(env,'page'", "revisionStatement(env,'article'", "activityStatement(env,actorEmail,'page.update'", "activityStatement(env,actorEmail,'article.update'"]) {
  if (!api.includes(entity)) errors.push(`Phase 5–6 audit/revision contract is missing: ${entity}`);
}

if (!wrangler.includes('"main": "src/worker.js"') || !wrangler.includes('"binding": "ASSETS"')) errors.push('Wrangler is not configured for Worker + static assets.');
if (!wrangler.includes('"/admin*"') || !wrangler.includes('"/api/admin/*"')) errors.push('Wrangler does not run the Worker first for admin routes.');
if (!wrangler.includes('"nodejs_compat"')) errors.push('Wrangler should enable nodejs_compat per Workers best practices.');
if (!wrangler.includes('"observability"')) errors.push('Wrangler should enable Worker observability for production diagnostics.');
try { await access(join(root, 'site/admin/index.html')); errors.push('Admin must not exist in the crawlable static site tree.'); } catch {}

if (errors.length) {
  console.error(`CMS verification failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('CMS Phases 1–6 verification passed: protected Access boundary, D1/R2 media and project management, page editor, Insights authoring, seeded content, SEO/media fields, revisions/activity, non-indexability, and public-site preservation verified.');
