import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const project = new URL('../', import.meta.url).pathname;
const source = join(project, 'site');
const output = join(project, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const indexStat = await stat(join(output, 'index.html'));
if (indexStat.size < 1000) throw new Error('Production homepage output is unexpectedly small.');

console.log(`Build passed: production site generated in dist/ (${indexStat.size} byte homepage).`);
