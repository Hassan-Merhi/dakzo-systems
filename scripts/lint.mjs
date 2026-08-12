import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../site/', import.meta.url);
const requiredMeta = ['<meta charset="utf-8">', 'name="viewport"', 'name="description"'];
const forbidden = [/\bTODO\b/i, /lorem ipsum/i, /href=["']#["']/i];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(root.pathname);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const errors = [];

for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8');
  const name = relative(root.pathname, file);
  for (const token of requiredMeta) {
    if (!text.includes(token)) errors.push(`${name}: missing ${token}`);
  }
  const h1Count = (text.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) errors.push(`${name}: expected exactly one h1, found ${h1Count}`);
  if (!/<title>[^<]{8,}<\/title>/.test(text)) errors.push(`${name}: missing useful title`);
  if (!/<html lang="en">/.test(text)) errors.push(`${name}: html lang must be en`);
  if (!/href="#main"/.test(text) || !/id="main"/.test(text)) errors.push(`${name}: skip link/main target missing`);
  for (const pattern of forbidden) {
    if (pattern.test(text)) errors.push(`${name}: forbidden placeholder pattern ${pattern}`);
  }
  const imgTags = text.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgTags) {
    if (!/\balt="[^"]*"/.test(tag)) errors.push(`${name}: image missing alt attribute`);
  }
}

if (errors.length) {
  console.error(`Lint failed with ${errors.length} issue(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Lint passed: ${htmlFiles.length} HTML pages checked.`);
