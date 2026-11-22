import { setFlagsFromString } from 'node:v8';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { run } from './solve.js';

setFlagsFromString('--no-incremental-marking');

const parsed = JSON.parse(readFileSync('/input/cases.json', 'utf8'));
const cases = Array.isArray(parsed) ? parsed : parsed.cases;
const answers = [];
for (const c of cases) {
  const input = c && typeof c === 'object' && 'input' in c ? c.input : c;
  answers.push(run(input));
}
mkdirSync('/output', { recursive: true });
writeFileSync('/output/answers.json', JSON.stringify(answers));
