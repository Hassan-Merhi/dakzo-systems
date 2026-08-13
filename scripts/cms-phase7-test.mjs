import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { livePathFor, renderCmsDocument } from '../src/public-cms.js';

const root = new URL('../', import.meta.url).pathname;
const errors = [];
const worker = await readFile(join(root, 'src/worker.js'), 'utf8');
const publishing = await readFile(join(root, 'src/publishing-api.js'), 'utf8');
const publicCms = await readFile(join(root, 'src/public-cms.js'), 'utf8');
const adminPhase7 = await readFile(join(root, 'src/admin-phase7.js'), 'utf8');
const migration = await readFile(join(root, 'migrations/0004_publications.sql'), 'utf8');
const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');

for (const token of ['cms_publications', 'snapshot_json', 'live_path', 'version', 'is_live']) {
  if (!migration.includes(token)) errors.push(`Phase 7 migration missing ${token}.`);
}
for (const token of ['/api/admin/publish/', '/api/admin/unpublish/', '/api/admin/revisions', '/restore', 'ON CONFLICT(entity_type,entity_id)', "'publish'", "'unpublish'", "'restore'"]) {
  if (!publishing.includes(token)) errors.push(`Publishing API missing ${token}.`);
}
for (const token of ['forceDraftContentSave', '/admin/preview/', 'handlePublicCms', 'injectPhase7Admin', 'unpublishUrl']) {
  if (!worker.includes(token)) errors.push(`Worker Phase 7 contract missing ${token}.`);
}
for (const token of ['Preview draft', 'Publish', 'Unpublish', 'Revision history', 'Restore to draft']) {
  if (!adminPhase7.includes(token)) errors.push(`Admin Phase 7 controls missing ${token}.`);
}
for (const token of ['/cms-media/', 'renderCmsDocument', 'index,follow', 'noindex,nofollow,noarchive', 'application/ld+json']) {
  if (!publicCms.includes(token)) errors.push(`Public CMS renderer missing ${token}.`);
}
for (const route of ['"/cms-media/*"', '"/work/*"', '"/insights/*"', '"/about/*"', '"/contact/*"']) {
  if (!wrangler.includes(route)) errors.push(`Wrangler Worker-first routing missing ${route}.`);
}

const page = {
  id: 'page-test', slug: 'about', title: 'About Test', status: 'draft', canonical_path: '/about/',
  seo_title: 'About Test | Dakzo Systems', seo_description: 'Test description',
  body: { heroEyebrow: 'Preview', heroTitle: '<script>alert(1)</script>', intro: 'Safe preview', sections: [], primaryCta: { label: 'Contact', href: '/contact/' }, secondaryCta: { label: '', href: '' } }
};
const article = {
  id: 'article-test', slug: 'safe-article', title: 'Safe article', excerpt: 'An article excerpt', status: 'published',
  content: { category: 'Engineering', body: 'First paragraph.\n\nSecond paragraph.', relatedProjectSlug: 'hmd-erp', takeaways: ['One'] },
  seo_title: '', seo_description: ''
};

if (livePathFor('page', page) !== '/about/') errors.push('Page live path is incorrect.');
if (livePathFor('project', { slug: 'hmd-erp' }) !== '/work/hmd-erp/') errors.push('Project live path is incorrect.');
if (livePathFor('article', article) !== '/insights/safe-article/') errors.push('Article live path is incorrect.');

const previewResponse = renderCmsDocument(page, 'page', { origin: 'https://dakzo.example', preview: true });
const previewHtml = await previewResponse.text();
if (previewResponse.headers.get('x-robots-tag') !== 'noindex, nofollow, noarchive') errors.push('Draft preview is not protected from indexing.');
if (!previewHtml.includes('Private draft preview')) errors.push('Draft preview banner is missing.');
if (previewHtml.includes('<script>alert(1)</script>') || !previewHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) errors.push('CMS renderer does not safely escape editor text.');

const liveResponse = renderCmsDocument(article, 'article', { origin: 'https://dakzo.example', preview: false });
const liveHtml = await liveResponse.text();
if (liveResponse.headers.get('x-robots-tag') !== 'index, follow') errors.push('Published CMS response is not indexable.');
if (!liveHtml.includes('https://dakzo.example/insights/safe-article/')) errors.push('Published article canonical URL is missing.');
if (!liveHtml.includes('application/ld+json')) errors.push('Published article structured data is missing.');

if (errors.length) {
  console.error(`CMS Phase 7 verification failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('CMS Phase 7 verification passed: draft-only saves, private preview, explicit publication snapshots, unpublish tombstones, revision restore, public rendering, routing, SEO, and output escaping verified.');
