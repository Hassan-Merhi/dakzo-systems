import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../site/', import.meta.url).pathname;
const projectRoot = new URL('../', import.meta.url).pathname;
const errors = [];
const must = async (path) => { try { await access(join(root,path)); return true; } catch { errors.push(`Missing Wave 5 file: ${path}`); return false; } };
await must('brand/index.html');
for (const file of ['assets/work-hmd-erp.svg','assets/work-congo-delivery.svg','assets/work-moto-track.svg','assets/wave5.css']) await must(file);
const brand = await readFile(join(root,'brand/index.html'),'utf8');
const work = await readFile(join(root,'work/index.html'),'utf8');
const doc = await readFile(join(projectRoot,'docs/authority-marketing.md'),'utf8');
const checks = [
 ['brand metadata', brand.includes('<title>Brand & Media | Dakzo Systems</title>') && brand.includes('name="description"')],
 ['authority attribution', brand.includes('Technology platform developed by Dakzo Systems') && brand.includes('/work/hmd-erp/')],
 ['verified channel guardrail', brand.includes('Only verified profiles are published here') && brand.includes('unverified profile')],
 ['official logos', brand.includes('/assets/logo-dark.svg') && brand.includes('/assets/logo-light.svg') && brand.includes('/assets/logo-mark.svg')],
 ['portfolio visuals', work.includes('/assets/work-hmd-erp.svg') && work.includes('/assets/work-congo-delivery.svg') && work.includes('/assets/work-moto-track.svg')],
 ['visual accessibility', work.includes('alt="Illustrated HMD ERP') && work.includes('loading="lazy"')],
 ['brand hub link', work.includes('/brand/')],
 ['ethical backlink rules', doc.includes('purchased bulk backlinks') && doc.includes('fake offices') && doc.includes('fabricated testimonials')),
 ['social rollout', doc.includes('LinkedIn company page') && doc.includes('GitHub organization/profile') && doc.includes('YouTube')),
 ['visual truthfulness', doc.includes('not fabricated screenshots') && doc.includes('no confidential customer data')]
];
for (const [name,pass] of checks) if (!pass) errors.push(`Wave 5 expectation failed: ${name}`);
for (const file of ['assets/work-hmd-erp.svg','assets/work-congo-delivery.svg','assets/work-moto-track.svg']) {
 const svg = await readFile(join(root,file),'utf8');
 if (!svg.includes('<title') || !svg.includes('<desc')) errors.push(`SVG accessibility metadata missing: ${file}`);
 if ((await stat(join(root,file))).size > 12*1024) errors.push(`SVG budget exceeded: ${file}`);
}
if ((await stat(join(root,'assets/wave5.css'))).size > 6*1024) errors.push('Wave 5 CSS budget exceeded.');
if (errors.length) { console.error(`Wave 5 tests failed:\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`Wave 5 tests passed: ${checks.length} authority/brand/portfolio assertions.`);
