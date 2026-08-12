import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../site/', import.meta.url).pathname;
const routes = ['/', '/solutions/', '/services/', '/work/', '/work/hmd-erp/', '/work/congo-delivery/', '/work/moto-track/', '/about/', '/insights/', '/contact/'];
const errors = [];

function routeFile(route) {
  return route === '/' ? join(root, 'index.html') : join(root, route, 'index.html');
}

for (const route of routes) {
  try { await access(routeFile(route)); }
  catch { errors.push(`Missing route: ${route}`); }
}

const home = await readFile(join(root, 'index.html'), 'utf8');
const work = await readFile(join(root, 'work/index.html'), 'utf8');
const about = await readFile(join(root, 'about/index.html'), 'utf8');
const hmd = await readFile(join(root, 'work/hmd-erp/index.html'), 'utf8');
const delivery = await readFile(join(root, 'work/congo-delivery/index.html'), 'utf8');
const moto = await readFile(join(root, 'work/moto-track/index.html'), 'utf8');
const css = await readFile(join(root, 'assets/styles.css'), 'utf8');
const js = await readFile(join(root, 'assets/site.js'), 'utf8');
const logo = await readFile(join(root, 'assets/logo-mark.svg'), 'utf8');

const expectations = [
  ['brand relationship', home.includes('A Dakik LLC Company')],
  ['hero positioning', home.includes('We build systems that') && home.includes('run businesses.')],
  ['HMD ERP', home.includes('HMD ERP')],
  ['Congo Delivery', home.includes('Congo Delivery')],
  ['Moto Track', home.includes('Moto Track')],
  ['service positioning', home.includes('Custom Software Development') && home.includes('Business Automation')],
  ['responsive breakpoint', css.includes('@media (max-width: 640px)')],
  ['reduced motion', css.includes('prefers-reduced-motion')],
  ['keyboard focus', css.includes(':focus-visible')],
  ['mobile menu aria state', js.includes('aria-expanded')],
  ['escape closes menu', js.includes("event.key === 'Escape'")],
  ['brand svg semantics', logo.includes('<title') && logo.includes('<desc')],
  ['portfolio links to HMD ERP case study', work.includes('href="/work/hmd-erp/"')],
  ['portfolio links to Congo Delivery case study', work.includes('href="/work/congo-delivery/"')],
  ['portfolio links to Moto Track case study', work.includes('href="/work/moto-track/"')],
  ['HMD ERP operational depth', hmd.includes('Inventory & locations') && hmd.includes('Factory & production') && hmd.includes('Accounts & daybook')],
  ['Congo Delivery operational depth', delivery.includes('Order intake') && delivery.includes('Dispatch') && delivery.includes('Tracking')],
  ['Moto Track operational depth', moto.includes('Live map') && moto.includes('Fleet management') && moto.includes('Alerts')],
  ['Dakik LLC corporate relationship', about.includes('software and technology subsidiary of Dakik LLC') && about.includes('Dakik LLC → Dakzo Systems')]
];

for (const [name, pass] of expectations) {
  if (!pass) errors.push(`Expectation failed: ${name}`);
}

for (const source of [home, work, about, hmd, delivery, moto]) {
  const hrefs = [...source.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith('/assets/')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    try { await access(routeFile(clean)); }
    catch { errors.push(`Internal link does not resolve: ${href}`); }
  }
}

if (errors.length) {
  console.error(`Tests failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Tests passed: ${expectations.length} brand/UI/portfolio assertions and ${routes.length} routes verified.`);
