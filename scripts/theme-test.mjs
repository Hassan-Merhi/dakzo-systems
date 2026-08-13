import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const themeJs = await readFile(new URL('site/assets/theme.js', root), 'utf8');
const themeCss = await readFile(new URL('site/assets/theme.css', root), 'utf8');
const buildScript = await readFile(new URL('scripts/build.mjs', root), 'utf8');

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
  [buildScript.includes('/assets/theme.js') && buildScript.includes('/assets/theme.css'), 'production build must inject theme assets into every HTML page'],
  [buildScript.includes("entry.name.endsWith('.html')"), 'production build must theme all HTML files including the 404 page']
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error(`Theme verification failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Theme verification passed: System/Light/Dark preference, persistence, global styling, and production injection are covered.');