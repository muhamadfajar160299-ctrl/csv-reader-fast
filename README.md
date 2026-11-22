# csv-reader-fast

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/muhamadfajar160299-ctrl/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/muhamadfajar160299-ctrl/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free CSV reader for make.fun's `csv-reader-speed-01-run-20261121` bounty: read broken CSV files as fast as possible. `solve.js` is a single-pass ES module with no dependencies; `main.ts` is the harness entrypoint.

## Run

```sh
node main.ts
```

`main.ts` reads the cases from `/input/cases.json`, answers each with `run` from `solve.js`, and writes `/output/answers.json`.

## How it works

- One left-to-right pass. Plain lines take a native `split(',')` fast path; quoted fields use a native `indexOf` scan for the closing quote.
- BOM, CRLF, stray CR, quoted fields, `""` escapes, quote junk, unterminated quotes, and short/long rows are handled per the csv-reader 1.0.0 rules, with errors reported as `{code, line, row}`.

Sign up through my invite: https://make.fun/r/gt86z8ct — code `gt86z8ct`.
