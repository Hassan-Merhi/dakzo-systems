import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluateProductionReadiness, REQUIRED_TABLES } from '../src/production-readiness.js';

const root = new URL('../', import.meta.url).pathname;
const worker = await readFile(join(root, 'src/worker.js'), 'utf8');
const readiness = await readFile(join(root, 'src/production-readiness.js'), 'utf8');
const admin = await readFile(join(root, 'src/admin-phase8.js'), 'utf8');
const docs = await readFile(join(root, 'docs/cms-phase-8-production.md'), 'utf8');
const publicationMigration = await readFile(join(root, 'migrations/0004_publications.sql'), 'utf8');
const i18nMigration = await readFile(join(root, 'migrations/0005_i18n_content.sql'), 'utf8');
const wrangler = await readFile(join(root, 'wrangler.jsonc'), 'utf8');

assert.deepEqual(REQUIRED_TABLES, ['cms_pages','cms_projects','cms_articles','cms_media','cms_revisions','cms_activity','cms_publications','cms_translations']);

for (const token of ['/api/admin/production-readiness','handleProductionReadiness','injectPhase8Admin']) {
  assert.ok(worker.includes(token), `Worker is missing Phase 8 integration: ${token}`);
}
for (const token of ['sqlite_master','PRAGMA table_info(cms_publications)','MEDIA_BUCKET.head','seedFloorReady','publicationColumnsReady','0005_i18n_content.sql','No secret values']) {
  assert.ok(readiness.includes(token), `Production readiness diagnostics missing: ${token}`);
}
for (const token of ['Run production check','Production gate: READY','Production gate: BLOCKED','textContent']) {
  assert.ok(admin.includes(token), `Admin Phase 8 UI missing: ${token}`);
}
for (const migrationFile of ['0001_cms.sql','0002_media_projects.sql','0003_pages_insights.sql','0004_publications.sql','0005_i18n_content.sql']) {
  assert.ok(docs.includes(migrationFile), `Production runbook missing migration ${migrationFile}`);
}
for (const token of ['Rollback','Preview draft','revision history','dark mode','Arabic RTL','Search Console','cms_translations','French','Spanish']) {
  assert.ok(docs.includes(token), `Production runbook missing final QA/rollback coverage: ${token}`);
}
assert.ok(publicationMigration.includes('is_live'), 'Production publication schema must include the Phase 7 tombstone column.');
assert.ok(i18nMigration.includes('cms_translations') && i18nMigration.includes('TRANSLATIONS_REQUIRED'), 'Production multilingual schema must include translation records and publication guards.');
for (const route of ['"/admin*"','"/api/admin/*"','"/cms-media/*"','"/work/*"','"/insights/*"']) {
  assert.ok(wrangler.includes(route), `Worker-first production routing missing ${route}`);
}

const ready = evaluateProductionReadiness({
  bindings: { database:true, media:true, accessTeamDomain:true, accessAudience:true },
  schema: { checked:true, missingTables:[], publicationColumnsReady:true },
  content: { checked:true, seedFloorReady:true },
  media: { checked:true, reachable:true }
});
assert.equal(ready.ready, true, 'All production checks should produce READY.');
assert.deepEqual(ready.blockers, []);

const blocked = evaluateProductionReadiness({
  bindings: { database:true, media:false, accessTeamDomain:true, accessAudience:true },
  schema: { checked:true, missingTables:['cms_translations'], publicationColumnsReady:true },
  content: { checked:true, seedFloorReady:true },
  media: { checked:false, reachable:false }
});
assert.equal(blocked.ready, false, 'Missing R2 or multilingual schema must block production readiness.');
assert.ok(blocked.blockers.includes('mediaBinding'));
assert.ok(blocked.blockers.includes('mediaReachable'));
assert.ok(blocked.blockers.includes('schema'));

console.log('CMS Phase 8 verification passed: authenticated live readiness diagnostics, multilingual migration floor, binding/schema/seed checks, admin production gate, rollback runbook, and final QA contract verified.');
