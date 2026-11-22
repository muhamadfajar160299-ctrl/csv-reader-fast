import { setFlagsFromString } from 'node:v8';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './solve.js';

setFlagsFromString('--no-incremental-marking');

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const parsed = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const cases = Array.isArray(parsed) ? parsed : parsed.cases;
const answers = [];
for (const c of cases) {
  const input = c && typeof c === 'object' && 'input' in c ? c.input : c;
  answers.push(run(input));
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
