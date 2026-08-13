import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const themeJs = await readFile(new URL('site/assets/theme.js', root), 'utf8');
const themeCss = await readFile(new URL('site/assets/theme.css', root), 'utf8');
const buildScript = await readFile(new URL('scripts/build.mjs', root), 'utf8');

function rgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const contrastPairs = [
  ['light body text', '#0b1020', '#f7f9fc', 4.5],
  ['light secondary text', '#263047', '#f7f9fc', 4.5],
  ['light muted text', '#667186', '#f7f9fc', 4.5],
  ['dark body text', '#f4f7fb', '#080d19', 4.5],
  ['dark secondary text', '#d3dbea', '#080d19', 4.5],
  ['dark muted text', '#9aa8bd', '#080d19', 4.5],
  ['dark accent button', '#0b1020', '#63e6be', 4.5],
  ['dark CTA button', '#ffffff', '#0b1020', 4.5],
  ['light inline link', '#176b55', '#f7f9fc', 4.5]
];

const checks = [
  [themeJs.includes("'system', 'light', 'dark'"), 'theme control must expose System, Light, and Dark'],
  [themeJs.includes("localStorage.getItem(storageKey)"), 'theme preference must load from localStorage'],
  [themeJs.includes("localStorage.setItem(storageKey, value)"), 'theme preference must persist to localStorage'],
  [themeJs.includes("matchMedia('(prefers-color-scheme: dark)')"), 'System mode must follow prefers-color-scheme'],
  [themeJs.includes('root.dataset.theme = theme'), 'resolved theme must be applied to the document root'],
  [themeJs.includes("addEventListener('change', onSystemThemeChange)"), 'System mode must react to OS theme changes'],
  [themeJs.includes("data-theme-select") || themeJs.includes('dataset.themeSelect'), 'theme UI must expose a selectable control'],
  [themeCss.includes(':root[data-theme="dark"]'), 'dark theme token set must exist'],
  [themeCss.includes('.theme-control'), 'theme control must have responsive styling'],
  [themeCss.includes('.field input') && themeCss.includes('.article-card') && themeCss.includes('.resource-card'), 'forms, Insights, and brand content must be themed'],
  [themeCss.includes('html[data-theme] .language-picker select'), 'language selector must inherit the active color theme'],
  [themeCss.includes('input:-webkit-autofill'), 'dark and light form autofill must preserve theme colors'],
  [themeCss.includes('img[src$="logo-mark.svg"]'), 'brand mark must have theme-safe presentation polish'],
  [themeCss.includes('.portfolio-visual'), 'project and portfolio imagery must have theme-safe framing'],
  [/min-width:\s*44px/.test(themeCss) && /min-height:\s*44px/.test(themeCss), 'interactive controls must preserve 44px touch targets'],
  [themeCss.includes('@media (max-width: 1160px)') && themeCss.includes('@media (max-width: 980px)') && themeCss.includes('@media (max-width: 640px)'), 'desktop/laptop, tablet, and mobile responsive polish breakpoints must exist'],
  [/max-height:\s*calc\(100dvh\s*-\s*92px\)/.test(themeCss) && /overflow-y:\s*auto/.test(themeCss), 'mobile navigation must stay usable on short viewports'],
  [themeCss.includes('@media (prefers-reduced-motion: reduce)') && /transition:\s*none\s*!important/.test(themeCss), 'reduced-motion users must not receive decorative theme motion'],
  [buildScript.includes('/assets/theme.js') && buildScript.includes('/assets/theme.css'), 'production build must inject theme assets into every HTML page'],
  [buildScript.includes("entry.name.endsWith('.html')"), 'production build must theme all HTML files including the 404 page']
];

for (const [name, foreground, background, minimum] of contrastPairs) {
  const ratio = contrast(foreground, background);
  checks.push([ratio >= minimum, `${name} contrast ${ratio.toFixed(2)}:1 must meet ${minimum}:1`]);
}

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error(`Theme verification failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Theme verification passed: ${checks.length} foundation, contrast, interaction, responsive, reduced-motion, multilingual-control, and production checks passed.`);
