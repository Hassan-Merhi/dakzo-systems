import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../site/', import.meta.url).pathname;
const projectRoot = new URL('../', import.meta.url).pathname;
const routes = ['/', '/solutions/', '/services/', '/work/', '/work/hmd-erp/', '/work/congo-delivery/', '/work/moto-track/', '/about/', '/insights/', '/insights/custom-erp-vs-off-the-shelf/', '/insights/when-custom-software-is-worth-it/', '/insights/how-logistics-platforms-work/', '/insights/how-fleet-tracking-systems-work/', '/contact/', '/privacy/'];
const errors = [];
function routeFile(route) { return route === '/' ? join(root, 'index.html') : join(root, route, 'index.html'); }
for (const route of routes) { try { await access(routeFile(route)); } catch { errors.push(`Missing route: ${route}`); } }

const home = await readFile(join(root, 'index.html'), 'utf8');
const work = await readFile(join(root, 'work/index.html'), 'utf8');
const about = await readFile(join(root, 'about/index.html'), 'utf8');
const hmd = await readFile(join(root, 'work/hmd-erp/index.html'), 'utf8');
const delivery = await readFile(join(root, 'work/congo-delivery/index.html'), 'utf8');
const moto = await readFile(join(root, 'work/moto-track/index.html'), 'utf8');
const insights = await readFile(join(root, 'insights/index.html'), 'utf8');
const contact = await readFile(join(root, 'contact/index.html'), 'utf8');
const privacy = await readFile(join(root, 'privacy/index.html'), 'utf8');
const notFound = await readFile(join(root, '404.html'), 'utf8');
const securityTxt = await readFile(join(root, '.well-known/security.txt'), 'utf8');
const health = await readFile(join(root, 'health.json'), 'utf8');
const erpGuide = await readFile(join(root, 'insights/custom-erp-vs-off-the-shelf/index.html'), 'utf8');
const softwareGuide = await readFile(join(root, 'insights/when-custom-software-is-worth-it/index.html'), 'utf8');
const logisticsGuide = await readFile(join(root, 'insights/how-logistics-platforms-work/index.html'), 'utf8');
const trackingGuide = await readFile(join(root, 'insights/how-fleet-tracking-systems-work/index.html'), 'utf8');
const css = await readFile(join(root, 'assets/styles.css'), 'utf8');
const wave3css = await readFile(join(root, 'assets/wave3.css'), 'utf8');
const js = await readFile(join(root, 'assets/site.js'), 'utf8');
const logo = await readFile(join(root, 'assets/logo-mark.svg'), 'utf8');
const build = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
const renderConfig = await readFile(join(projectRoot, 'render.yaml'), 'utf8');
const wave4 = await readFile(join(projectRoot, 'docs/wave-4-verification.md'), 'utf8');

const expectations = [
  ['brand relationship', home.includes('A Dakik LLC Company')],
  ['hero positioning', home.includes('We build systems that') && home.includes('run businesses.')],
  ['HMD ERP', home.includes('HMD ERP')], ['Congo Delivery', home.includes('Congo Delivery')], ['Moto Track', home.includes('Moto Track')],
  ['service positioning', home.includes('Custom Software Development') && home.includes('Business Automation')],
  ['responsive breakpoint', css.includes('@media (max-width: 640px)')], ['reduced motion', css.includes('prefers-reduced-motion')], ['keyboard focus', css.includes(':focus-visible')],
  ['mobile menu aria state', js.includes('aria-expanded')], ['escape closes menu', js.includes("event.key === 'Escape'")], ['brand svg semantics', logo.includes('<title') && logo.includes('<desc')],
  ['portfolio links', work.includes('/work/hmd-erp/') && work.includes('/work/congo-delivery/') && work.includes('/work/moto-track/')],
  ['HMD ERP depth', hmd.includes('Inventory & locations') && hmd.includes('Factory & production') && hmd.includes('Accounts & daybook')],
  ['Congo Delivery depth', delivery.includes('Order intake') && delivery.includes('Dispatch') && delivery.includes('Tracking')],
  ['Moto Track depth', moto.includes('Live map') && moto.includes('Fleet management') && moto.includes('Alerts')],
  ['Dakik LLC relationship', about.includes('software and technology subsidiary of Dakik LLC') && about.includes('Dakik LLC → Dakzo Systems')],
  ['project inquiry form', contact.includes('data-project-form') && contact.includes('projectType') && contact.includes('budget') && contact.includes('details')],
  ['conversion privacy', contact.includes('We do not submit anything automatically')],
  ['conversion responsive CSS', wave3css.includes('.conversion-grid') && wave3css.includes('@media(max-width:820px)')],
  ['canonical runtime', js.includes("rel = 'canonical'") && js.includes('window.location.origin')],
  ['Open Graph runtime', js.includes('og:title') && js.includes('og:description') && js.includes('twitter:card')],
  ['Organization schema', js.includes("'@type': 'Organization'") && js.includes("'@type': 'WebSite'")],
  ['Article schema', js.includes("'@type': 'Article'") && erpGuide.includes('data-content-type="article"')],
  ['crawl files generated', build.includes('sitemap.xml') && build.includes('robots.txt') && build.includes('SITE_URL')],
  ['insights index links', insights.includes('/insights/custom-erp-vs-off-the-shelf/') && insights.includes('/insights/how-fleet-tracking-systems-work/')],
  ['ERP guide content', erpGuide.includes('workflow fit') && erpGuide.includes('total ownership')],
  ['custom software guide content', softwareGuide.includes('spreadsheets') && softwareGuide.includes('source of truth')],
  ['logistics guide content', logisticsGuide.includes('Dispatch') && logisticsGuide.includes('Exceptions')],
  ['tracking guide content', trackingGuide.includes('Location data') && trackingGuide.includes('Alerts')],
  ['privacy route', privacy.includes('does not automatically transmit') && privacy.includes('No third-party analytics')],
  ['custom 404', notFound.includes('name="robots" content="noindex"') && notFound.includes('Page Not Found')],
  ['security disclosure', securityTxt.includes('Canonical: https://dakzosystems.com/.well-known/security.txt') && securityTxt.includes('Policy: https://dakzosystems.com/privacy/')],
  ['health probe', JSON.parse(health).status === 'ok'],
  ['CI-gated deploy', renderConfig.includes('autoDeployTrigger: checksPass')],
  ['Render static production', renderConfig.includes('runtime: static') && renderConfig.includes('staticPublishPath: ./dist')],
  ['security headers', ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security','Content-Security-Policy'].every((header) => renderConfig.includes(header))],
  ['bounded asset cache', renderConfig.includes('max-age=86400') && !renderConfig.includes('immutable')],
  ['production budgets', build.includes('jsBudget') && build.includes('cssBudget') && build.includes('htmlBudget')],
  ['production required files', build.includes('404.html') && build.includes('health.json') && build.includes('.well-known/security.txt')],
  ['local presence guardrail', wave4.includes('must not publish a physical address') && wave4.includes('Google Business Profile')]
];
for (const [name, pass] of expectations) if (!pass) errors.push(`Expectation failed: ${name}`);

const linkSources = [home, work, about, hmd, delivery, moto, insights, contact, privacy, erpGuide, softwareGuide, logisticsGuide, trackingGuide];
for (const source of linkSources) {
  const hrefs = [...source.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith('/assets/')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    try { await access(routeFile(clean)); } catch { errors.push(`Internal link does not resolve: ${href}`); }
  }
}

for (const route of routes) {
  const html = await readFile(routeFile(route), 'utf8');
  if (!html.includes('name="viewport"')) errors.push(`Missing mobile viewport: ${route}`);
  if (/src="https?:\/\//i.test(html)) errors.push(`Third-party executable script found: ${route}`);
  if ((await stat(routeFile(route))).size > 16 * 1024) errors.push(`HTML size budget exceeded: ${route}`);
}
if ((await stat(join(root, 'assets/site.js'))).size > 8 * 1024) errors.push('JavaScript size budget exceeded.');
if ((await stat(join(root, 'assets/styles.css'))).size + (await stat(join(root, 'assets/wave3.css'))).size > 20 * 1024) errors.push('CSS size budget exceeded.');

if (errors.length) { console.error(`Tests failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`Tests passed: ${expectations.length} brand/UI/portfolio/conversion/SEO/performance/security assertions and ${routes.length} routes verified.`);