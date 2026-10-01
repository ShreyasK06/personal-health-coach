# Personal Health Coach

A single-user, Whoop-style dashboard built on Apple Watch / Apple Health data. It turns raw HRV, resting heart rate, sleep, workouts, and activity into daily **recovery**, **sleep**, **strain**, and **training-load** scores, scored against your own rolling baseline rather than population averages.

Built with React 19, TypeScript, Vite, and Tailwind CSS. The scoring logic is written as pure, unit-tested functions, separate from the UI.

## What it shows

- **Today:** recovery ring, a readiness banner (the lead signal), training load, strain gauge, and an at-a-glance grid (recovery, strain, sleep, HRV, steps, active calories, resting HR, respiratory rate) with day-over-day deltas.
- **Sleep:** sleep score versus a computed sleep need, sleep stages, and sleep debt.
- **Activity:** move / exercise / stand rings, an activity heatmap, and distance and flights charts.
- **Trends:** charts across days, with a detail sheet for every metric that explains the drivers behind the number.
- **Calibration banner:** shown while there isn't enough history to build a reliable baseline.

## The scoring engines (`src/metrics/`)

| Engine | What it computes |
|---|---|
| `recovery` | Recovery (0 to 100%) from overnight HRV and resting heart rate, as standardized deviations from a rolling baseline |
| `sleep` | Sleep score (0 to 100) versus a personalized sleep need |
| `strain` | Cardiovascular strain (0 to 21) from workout heart-rate data, relative to max heart rate |
| `load` | Acute versus chronic training load and monotony, used to flag overtraining risk |
| `baseline` | Rolling mean and standard deviation used by the other engines |

Weights and constants are tunable defaults intended to be calibrated against real data. Coaching guidance (readiness downgrades, intensity targets, HRV trend) is derived deterministically from these outputs; there is no LLM in the current code.

## Data

The app reads Health Auto Export JSON (the iOS app that exports Apple Health data) through `src/lib/parseHaeJson.ts` and loads it from a Firebase Realtime Database configured in `src/lib/firebase.ts`. There are also importers for CSV and ZIP exports (`csv.ts`, `loadZip.ts`, `healthExport.ts`).

**This repository contains no personal health data.** Treat health data as sensitive: restrict read access on whatever database you point the app at, and don't commit exports.

## Getting started

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # type-check and production build
npm run lint
```

Point `src/lib/firebase.ts` at your own database before running.

## Tests

Vitest unit tests cover the CSV and JSON parsers, the export pipeline, and each scoring engine (recovery, sleep, strain, load, baseline).

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the app and publishes it to GitHub Pages on pushes to `main`.

## Project layout

```
src/
  metrics/       Scoring engines and their tests
  lib/           Parsers, importers, data loading, UI helpers
  components/    Rings, gauges, charts, cards, navigation
  screens/       Today, Sleep, Activity, Trends, and detail sheets
docs/
  superpowers/   Design spec and implementation plan
```

## Status

Active personal project. The original design (see `docs/superpowers/specs/`) also describes a Supabase ingest endpoint and an LLM-narrated coach; the current implementation instead loads data from Firebase and computes guidance deterministically.
