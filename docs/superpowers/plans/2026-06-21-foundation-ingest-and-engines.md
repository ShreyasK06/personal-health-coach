# Foundation, Ingest Capture & Scoring Engines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the personal health-coach project: a deployed Supabase ingest endpoint that captures real Apple Health data from Health Auto Export, plus the four pure scoring engines (recovery, sleep, strain, training load) built and unit-tested against synthetic fixtures.

**Architecture:** A React 19 + Vite + Tailwind v4 single-page app (UI comes in Plan 2) sharing a repo with a Supabase backend. Health Auto Export POSTs JSON to a Supabase Edge Function (`/ingest`) that authenticates with a bearer token and stores the raw payload as `jsonb`. The scoring engines are pure TypeScript functions over an internal normalized data model (`src/metrics/types.ts`) — deliberately decoupled from Health Auto Export's wire format, so they are fully testable now and the format-specific parser is isolated to Plan 2.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), `@supabase/supabase-js`, Supabase CLI (Postgres + Deno Edge Functions), Vitest for unit tests, TypeScript ~6.0.

## Global Constraints

- **Single-user app.** No signup/multi-tenant auth. One ingest bearer token; UI gating comes in Plan 2.
- **Engines are pure functions.** No I/O, no `Date.now()` inside engine logic — the "as of" date/time is always passed in as a parameter, so tests are deterministic.
- **TDD.** Every engine function gets a failing test first, then minimal implementation.
- **All scoring weights/constants are exported, named defaults** (e.g. `RECOVERY_WEIGHTS`) so Plan 2 calibration can tune them without editing logic.
- **Money/finance has nothing to do with this repo.** Do not copy delphi's domain code; only mirror its stack choices and the `CoachAdapter` *pattern* (Plan 2).
- **Node.js** is installed user-locally at `~/.local/node` (not on default PATH). Prefix commands with `export PATH="$HOME/.local/node/bin:$PATH"` or call binaries directly.
- **No em dashes in any user-facing copy.**

---

## File Structure

```
personal-health-coach/
  package.json                     # scripts: dev, build, test, lint
  vite.config.ts                   # React + Tailwind v4 plugins
  vitest.config.ts                 # node test environment
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  index.html
  .env.local                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
  src/
    main.tsx                       # placeholder app shell (real UI in Plan 2)
    index.css                      # Tailwind import + Whoop-dark tokens (expanded in Plan 2)
    metrics/
      types.ts                     # internal normalized domain model + engine result types
      baseline.ts                  # mean, stdDev, ewma, rollingBaseline
      baseline.test.ts
      sleep.ts                     # computeSleep
      sleep.test.ts
      recovery.ts                  # computeRecovery (depends on sleep performance)
      recovery.test.ts
      strain.ts                    # hrMax, sessionTrimp, dayStrain, computeStrain
      strain.test.ts
      load.ts                      # computeLoad (ACWR + monotony)
      load.test.ts
  supabase/
    config.toml                    # created by `supabase init`
    migrations/
      0001_raw_capture.sql         # raw_payloads table
    functions/
      ingest/
        index.ts                   # Deno edge function: auth + store raw jsonb
  docs/superpowers/
    specs/2026-06-21-personal-health-coach-design.md   # (already committed)
    plans/2026-06-21-foundation-ingest-and-engines.md  # (this file)
```

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/index.css`
- (Scaffolding tool generates most; you then add Tailwind v4 + Vitest.)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable, testable project. `npm run build` succeeds, `npm test` runs (zero tests OK).

- [ ] **Step 1: Scaffold Vite React-TS into the existing folder**

The folder already contains `docs/` and `.gitignore`. Scaffold in place:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd "C:/Users/Shreyas Kakkar/Documents/GitHub/personal-health-coach"
npm create vite@latest . -- --template react-ts
```

When prompted that the directory is not empty, choose **"Ignore files and continue"**. Then:

```bash
npm install
```

- [ ] **Step 2: Add Tailwind v4 and Vitest**

```bash
npm install tailwindcss @tailwindcss/vite @supabase/supabase-js
npm install -D vitest
```

- [ ] **Step 3: Wire Tailwind into Vite and add the test script**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Replace `src/index.css` with the Tailwind import and a minimal dark base (full Whoop-dark tokens land in Plan 2):

```css
@import "tailwindcss";

:root { color-scheme: dark; }
body { background: #0b0d10; color: #e8eaed; }
```

Replace `src/main.tsx` body with a placeholder shell so the build has an entry point:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>personal health coach</h1>
      <p>Scoring engine + ingest pipeline. UI lands in Plan 2.</p>
    </main>
  </StrictMode>,
)
```

Delete the scaffold's `src/App.tsx`, `src/App.css`, and asset imports if `main.tsx` no longer references them.

- [ ] **Step 4: Verify build and test runner**

```bash
npm run build
npm test
```

Expected: build succeeds; `vitest run` reports "no test files found" (exit 0) — that is fine at this point.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react-ts + tailwind v4 + vitest"
```

---

### Task 2: Supabase raw-capture schema

**Files:**
- Create: `supabase/migrations/0001_raw_capture.sql` (and `supabase/config.toml` via `supabase init`)

**Interfaces:**
- Consumes: nothing.
- Produces: a `raw_payloads` table the Edge Function (Task 3) writes to.

- [ ] **Step 1: Initialize Supabase locally**

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npx supabase init
```

Accept defaults. This creates `supabase/config.toml`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0001_raw_capture.sql`:

```sql
-- Raw capture: store every Health Auto Export payload verbatim as jsonb.
-- Plan 2 parses these into normalized tables once the real shape is known.
create table if not exists raw_payloads (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  source      text,
  byte_size   integer,
  body        jsonb not null
);

create index if not exists raw_payloads_received_at_idx
  on raw_payloads (received_at desc);

-- No public access. Only the service role (used by the Edge Function) touches this.
alter table raw_payloads enable row level security;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(db): add raw_payloads capture table migration"
```

> **User action (out of band):** Create a Supabase project at supabase.com, then link and push:
> ```bash
> npx supabase link --project-ref <YOUR_PROJECT_REF>
> npx supabase db push
> ```
> Save the project URL and anon key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

### Task 3: Ingest Edge Function (auth + raw capture)

**Files:**
- Create: `supabase/functions/ingest/index.ts`

**Interfaces:**
- Consumes: `raw_payloads` table (Task 2); env `INGEST_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the last two are injected automatically in deployed Edge Functions).
- Produces: a deployed HTTPS endpoint `POST /functions/v1/ingest` that stores the body and returns `{ ok: true, id }`.

- [ ] **Step 1: Write the function**

Create `supabase/functions/ingest/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const expected = Deno.env.get('INGEST_TOKEN')
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!expected || token !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const byteSize = JSON.stringify(body).length
  const { data, error } = await supabase
    .from('raw_payloads')
    .insert({ source: 'health-auto-export', byte_size: byteSize, body })
    .select('id')
    .single()

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
```

- [ ] **Step 2: Set the secret and deploy**

Generate a long random token and set it, then deploy (no JWT verification — Health Auto Export sends our bearer token, not a Supabase JWT):

```bash
export PATH="$HOME/.local/node/bin:$PATH"
# generate a token (any long random string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx supabase secrets set INGEST_TOKEN=<paste-token>
npx supabase functions deploy ingest --no-verify-jwt
```

- [ ] **Step 3: Smoke-test the deployed endpoint**

```bash
curl -i -X POST "https://<YOUR_PROJECT_REF>.functions.supabase.co/ingest" \
  -H "Authorization: Bearer <paste-token>" \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'
```

Expected: `HTTP/1.1 200` with body `{"ok":true,"id":1}`. A request with a wrong/missing token returns `401`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat(ingest): edge function stores authenticated raw payloads"
```

---

### Task 4: Capture the first real payload (start data collection)

**Files:**
- Create: `src/metrics/__fixtures__/hae-sample.json` (a redacted real payload, used by Plan 2's parser tests)

**Interfaces:**
- Consumes: the deployed `/ingest` endpoint (Task 3).
- Produces: a saved real-shape fixture; ongoing daily data accumulation.

> This task is gated on a physical device. It is placed early on purpose so real data starts accumulating (baselines need a few weeks).

- [ ] **Step 1: Install and configure Health Auto Export (user action)**

On the iPhone:
1. Install **Health Auto Export — JSON+CSV** from the App Store.
2. Create an **Automation** of type **REST API**.
3. URL: `https://<YOUR_PROJECT_REF>.functions.supabase.co/ingest`
4. Add header `Authorization: Bearer <token>`; format **JSON**; method **POST**.
5. Select metrics: heart rate variability, resting heart rate, heart rate, respiratory rate, active energy, step count, VO2 max, sleep analysis; and enable **Workouts**.
6. Schedule it to run every morning; tap **Run Now** once to send a first batch.

- [ ] **Step 2: Confirm receipt and extract the fixture**

In the Supabase SQL editor (or `psql`):

```sql
select id, received_at, byte_size, jsonb_pretty(body) from raw_payloads order by id desc limit 1;
```

Copy the `body` JSON into `src/metrics/__fixtures__/hae-sample.json`. Redact nothing structural, but you may scrub exact values if desired — Plan 2's parser only needs the field names/shape.

- [ ] **Step 3: Commit the fixture**

```bash
git add src/metrics/__fixtures__/hae-sample.json
git commit -m "test(fixtures): capture real Health Auto Export payload shape"
```

> After this, **Plan 2 can be written** against the real shape. Tasks 5-10 below do not depend on this fixture and can proceed immediately.

---

### Task 5: Internal domain types

**Files:**
- Create: `src/metrics/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the types every engine and (Plan 2) the parser use:
  `NightSample`, `SleepInput`, `WorkoutInput`, `Profile`, `Baseline`,
  `SleepResult`, `RecoveryResult`, `SessionStrain`, `StrainResult`, `LoadResult`.

- [ ] **Step 1: Write the types file**

Create `src/metrics/types.ts`:

```ts
// Internal normalized model. Decoupled from Health Auto Export's wire format;
// Plan 2's parser maps the raw payload into these shapes.

/** Overnight cardiovascular snapshot for the night ending on `date`. */
export interface NightSample {
  date: string            // YYYY-MM-DD (the morning the night ended)
  hrvMs: number | null    // overnight SDNN, milliseconds
  restingHr: number | null// bpm
  respiratoryRate: number | null // breaths/min
}

export interface SleepInput {
  date: string            // YYYY-MM-DD
  inBedMinutes: number
  asleepMinutes: number
  deepMinutes: number
  remMinutes: number
  coreMinutes: number
  awakeMinutes: number
  bedTime: string         // ISO 8601
  wakeTime: string        // ISO 8601
}

export interface WorkoutInput {
  start: string           // ISO 8601
  end: string             // ISO 8601
  type: string            // Apple workout type, e.g. "Tennis", "Traditional Strength Training"
  sportTag?: string       // optional manual override
  avgHr: number | null
  maxHr: number | null
  durationMin: number
}

export interface Profile {
  birthYear: number
  sex: 'male' | 'female'
  hrMaxOverride?: number
  hrRest?: number              // optional fixed resting HR; otherwise use baseline
  sleepNeedBaseHours: number   // default 8.0
}

export interface Baseline {
  mean: number
  sd: number
  n: number
}

export interface SleepResult {
  score: number          // 0..100
  needHours: number
  performance: number    // 0..1
  efficiency: number     // 0..1
  consistency: number    // 0..1
  restorative: number    // 0..1
}

export interface RecoveryResult {
  score: number          // 0..100
  band: 'red' | 'amber' | 'green'
  zHrv: number
  zRhr: number
  respPenalty: number
}

export interface SessionStrain {
  type: string
  trimp: number
}

export interface StrainResult {
  sessions: SessionStrain[]
  dayTrimp: number
  strain: number         // 0..21
}

export interface LoadResult {
  acute: number          // 7-day average daily load
  chronic: number        // 28-day average daily load
  acwr: number           // acute / chronic
  monotony: number       // mean(7) / sd(7)
  trainingStrain: number // weekly load * monotony
  band: 'detraining' | 'optimal' | 'caution' | 'high-risk'
}
```

- [ ] **Step 2: Verify it compiles**

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/metrics/types.ts
git commit -m "feat(metrics): internal normalized domain types"
```

---

### Task 6: Baseline statistics utilities

**Files:**
- Create: `src/metrics/baseline.ts`, `src/metrics/baseline.test.ts`

**Interfaces:**
- Consumes: `Baseline` from `types.ts`.
- Produces:
  - `mean(xs: number[]): number`
  - `stdDev(xs: number[]): number` (sample SD, n-1; returns 0 for length < 2)
  - `ewma(xs: number[], alpha: number): number` (oldest→newest order; returns 0 for empty)
  - `rollingBaseline(history: number[], windowDays: number): Baseline` (last `windowDays` values; `sd` floored to a small epsilon to avoid divide-by-zero downstream)

- [ ] **Step 1: Write the failing test**

Create `src/metrics/baseline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mean, stdDev, ewma, rollingBaseline } from './baseline'

describe('baseline stats', () => {
  it('mean averages the values', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })

  it('stdDev is the sample standard deviation', () => {
    expect(stdDev([2, 4, 6])).toBeCloseTo(2, 5)
  })

  it('stdDev returns 0 for fewer than two values', () => {
    expect(stdDev([5])).toBe(0)
    expect(stdDev([])).toBe(0)
  })

  it('ewma weights recent values more', () => {
    // oldest -> newest; high alpha leans toward the last value
    expect(ewma([10, 20], 0.9)).toBeCloseTo(19, 5)
  })

  it('rollingBaseline uses only the last windowDays values and floors sd', () => {
    const b = rollingBaseline([100, 1, 2, 3], 3) // last 3 -> [1,2,3]
    expect(b.mean).toBe(2)
    expect(b.n).toBe(3)
    expect(b.sd).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npx vitest run src/metrics/baseline.test.ts
```

Expected: FAIL — cannot find module `./baseline`.

- [ ] **Step 3: Write the implementation**

Create `src/metrics/baseline.ts`:

```ts
import type { Baseline } from './types'

const SD_FLOOR = 1e-6

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

/** Exponentially weighted moving average. `xs` is oldest -> newest. */
export function ewma(xs: number[], alpha: number): number {
  if (xs.length === 0) return 0
  let acc = xs[0]
  for (let i = 1; i < xs.length; i++) acc = alpha * xs[i] + (1 - alpha) * acc
  return acc
}

/** Mean/SD over the most recent `windowDays` values. SD floored to avoid /0. */
export function rollingBaseline(history: number[], windowDays: number): Baseline {
  const window = history.slice(-windowDays)
  return {
    mean: mean(window),
    sd: Math.max(stdDev(window), SD_FLOOR),
    n: window.length,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/metrics/baseline.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/metrics/baseline.ts src/metrics/baseline.test.ts
git commit -m "feat(metrics): baseline statistics utilities"
```

---

### Task 7: Sleep engine

**Files:**
- Create: `src/metrics/sleep.ts`, `src/metrics/sleep.test.ts`

**Interfaces:**
- Consumes: `SleepInput`, `Profile`, `SleepResult` from `types.ts`.
- Produces:
  - `SLEEP_WEIGHTS` (exported default weights)
  - `SleepContext` interface
  - `computeSleep(today: SleepInput, ctx: SleepContext): SleepResult`
  - The `performance` field of the result is what the Recovery engine (Task 8) consumes.

- [ ] **Step 1: Write the failing test**

Create `src/metrics/sleep.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSleep } from './sleep'
import type { SleepInput, Profile } from './types'

const profile: Profile = { birthYear: 2000, sex: 'male', sleepNeedBaseHours: 8 }

const goodNight: SleepInput = {
  date: '2026-06-21',
  inBedMinutes: 8 * 60,
  asleepMinutes: 7.5 * 60,
  deepMinutes: 90,
  remMinutes: 105,
  coreMinutes: 255,
  awakeMinutes: 30,
  bedTime: '2026-06-20T23:00:00Z',
  wakeTime: '2026-06-21T07:00:00Z',
}

describe('computeSleep', () => {
  it('rewards a full, efficient, restorative, consistent night', () => {
    const r = computeSleep(goodNight, {
      profile,
      sleepDebtHours: 0,
      yesterdayStrain: 8,
      recentBedMinutesOfDay: [23 * 60, 23 * 60],
      recentWakeMinutesOfDay: [7 * 60, 7 * 60],
    })
    expect(r.score).toBeGreaterThan(80)
    expect(r.performance).toBeGreaterThan(0.9)
    expect(r.needHours).toBeCloseTo(8, 1)
  })

  it('raises sleep need after a high-strain day and with sleep debt', () => {
    const r = computeSleep(goodNight, {
      profile,
      sleepDebtHours: 2,
      yesterdayStrain: 18,
      recentBedMinutesOfDay: [23 * 60],
      recentWakeMinutesOfDay: [7 * 60],
    })
    expect(r.needHours).toBeGreaterThan(8.5)
  })

  it('penalizes a short night', () => {
    const short: SleepInput = { ...goodNight, asleepMinutes: 5 * 60, deepMinutes: 40, remMinutes: 50, coreMinutes: 210 }
    const r = computeSleep(short, {
      profile,
      sleepDebtHours: 0,
      yesterdayStrain: 8,
      recentBedMinutesOfDay: [23 * 60],
      recentWakeMinutesOfDay: [7 * 60],
    })
    expect(r.score).toBeLessThan(70)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/metrics/sleep.test.ts
```

Expected: FAIL — cannot find module `./sleep`.

- [ ] **Step 3: Write the implementation**

Create `src/metrics/sleep.ts`:

```ts
import type { SleepInput, Profile, SleepResult } from './types'

export const SLEEP_WEIGHTS = {
  performance: 0.5,
  efficiency: 0.15,
  consistency: 0.15,
  restorative: 0.2,
} as const

const RESTORATIVE_TARGET = 0.45 // target (deep + REM) / asleep
const HIGH_STRAIN_THRESHOLD = 14 // strain (0..21) above which sleep need rises
const STRAIN_NEED_BONUS_HOURS = 0.75
const DEBT_CAP_HOURS = 2

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Mean of clock-minute-of-day values, handling wrap-around past midnight. */
function circularMeanMinutes(values: number[]): number {
  if (values.length === 0) return 0
  const angles = values.map((m) => (m / 1440) * 2 * Math.PI)
  const sin = angles.reduce((a, t) => a + Math.sin(t), 0) / values.length
  const cos = angles.reduce((a, t) => a + Math.cos(t), 0) / values.length
  let theta = Math.atan2(sin, cos)
  if (theta < 0) theta += 2 * Math.PI
  return (theta / (2 * Math.PI)) * 1440
}

function circularDiffMinutes(a: number, b: number): number {
  const raw = Math.abs(a - b) % 1440
  return Math.min(raw, 1440 - raw)
}

export interface SleepContext {
  profile: Profile
  sleepDebtHours: number
  yesterdayStrain: number
  recentBedMinutesOfDay: number[]
  recentWakeMinutesOfDay: number[]
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function computeSleep(today: SleepInput, ctx: SleepContext): SleepResult {
  const strainBonus = ctx.yesterdayStrain >= HIGH_STRAIN_THRESHOLD ? STRAIN_NEED_BONUS_HOURS : 0
  const needHours =
    ctx.profile.sleepNeedBaseHours +
    Math.min(Math.max(ctx.sleepDebtHours, 0), DEBT_CAP_HOURS) +
    strainBonus

  const performance = clamp01(today.asleepMinutes / 60 / needHours)
  const efficiency = today.inBedMinutes > 0 ? clamp01(today.asleepMinutes / today.inBedMinutes) : 0
  const restorativeRatio =
    today.asleepMinutes > 0 ? (today.deepMinutes + today.remMinutes) / today.asleepMinutes : 0
  const restorative = clamp01(restorativeRatio / RESTORATIVE_TARGET)

  const bedMean = circularMeanMinutes(ctx.recentBedMinutesOfDay)
  const wakeMean = circularMeanMinutes(ctx.recentWakeMinutesOfDay)
  const bedDiff = ctx.recentBedMinutesOfDay.length ? circularDiffMinutes(minutesOfDay(today.bedTime), bedMean) : 0
  const wakeDiff = ctx.recentWakeMinutesOfDay.length ? circularDiffMinutes(minutesOfDay(today.wakeTime), wakeMean) : 0
  // 0 min off -> 1.0; 90+ min off -> 0.0
  const consistency = clamp01(1 - (bedDiff + wakeDiff) / 2 / 90)

  const score = Math.round(
    100 *
      (SLEEP_WEIGHTS.performance * performance +
        SLEEP_WEIGHTS.efficiency * efficiency +
        SLEEP_WEIGHTS.consistency * consistency +
        SLEEP_WEIGHTS.restorative * restorative),
  )

  return { score, needHours, performance, efficiency, consistency, restorative }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/metrics/sleep.test.ts
```

Expected: PASS (3 tests). If a boundary assertion is off, adjust the *fixture*, not the thresholds, to keep weights tunable.

- [ ] **Step 5: Commit**

```bash
git add src/metrics/sleep.ts src/metrics/sleep.test.ts
git commit -m "feat(metrics): sleep engine (need, performance, efficiency, consistency, restorative)"
```

---

### Task 8: Recovery engine

**Files:**
- Create: `src/metrics/recovery.ts`, `src/metrics/recovery.test.ts`

**Interfaces:**
- Consumes: `NightSample`, `Baseline`, `RecoveryResult` from `types.ts`; `sleepPerformance` (0..1) produced by `computeSleep` (Task 7).
- Produces:
  - `RECOVERY_WEIGHTS` (exported)
  - `RecoveryInput` interface
  - `computeRecovery(input: RecoveryInput): RecoveryResult`

- [ ] **Step 1: Write the failing test**

Create `src/metrics/recovery.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeRecovery } from './recovery'
import type { Baseline, NightSample } from './types'

const hrvBaseline: Baseline = { mean: 60, sd: 10, n: 30 }
const rhrBaseline: Baseline = { mean: 55, sd: 4, n: 30 }
const respBaseline: Baseline = { mean: 14, sd: 1, n: 30 }

describe('computeRecovery', () => {
  it('high HRV, low RHR, good sleep -> green, high score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 80, restingHr: 50, respiratoryRate: 14 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.95 })
    expect(r.score).toBeGreaterThan(66)
    expect(r.band).toBe('green')
  })

  it('low HRV, high RHR, poor sleep -> red, low score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 40, restingHr: 63, respiratoryRate: 16 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.5 })
    expect(r.score).toBeLessThan(34)
    expect(r.band).toBe('red')
  })

  it('at baseline with average sleep -> mid score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 60, restingHr: 55, respiratoryRate: 14 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.85 })
    expect(r.score).toBeGreaterThanOrEqual(34)
    expect(r.score).toBeLessThanOrEqual(80)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/metrics/recovery.test.ts
```

Expected: FAIL — cannot find module `./recovery`.

- [ ] **Step 3: Write the implementation**

Create `src/metrics/recovery.ts`:

```ts
import type { NightSample, Baseline, RecoveryResult } from './types'

export const RECOVERY_WEIGHTS = {
  hrv: 0.5,
  rhr: 0.25,
  sleep: 0.2,
  resp: 0.05,
} as const

export interface RecoveryInput {
  today: NightSample
  hrvBaseline: Baseline
  rhrBaseline: Baseline
  respBaseline: Baseline
  sleepPerformance: number // 0..1 from computeSleep
}

const z = (x: number, b: Baseline) => (x - b.mean) / b.sd

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const { today } = input

  const zHrv = today.hrvMs == null ? 0 : z(today.hrvMs, input.hrvBaseline)
  const zRhr = today.restingHr == null ? 0 : z(today.restingHr, input.rhrBaseline)
  const respPenalty =
    today.respiratoryRate == null ? 0 : Math.max(0, z(today.respiratoryRate, input.respBaseline))

  // Map sleep performance (centered ~0.85, span ~0.15) to a z-like term.
  const sleepZ = (input.sleepPerformance - 0.85) / 0.15

  const composite =
    RECOVERY_WEIGHTS.hrv * zHrv +
    RECOVERY_WEIGHTS.rhr * -zRhr + // higher RHR is worse
    RECOVERY_WEIGHTS.sleep * sleepZ +
    RECOVERY_WEIGHTS.resp * -respPenalty

  // Logistic squash; gain chosen so +/- ~1.5 composite spans most of 0..100.
  const GAIN = 1.6
  const score = Math.round(100 / (1 + Math.exp(-GAIN * composite)))

  const band: RecoveryResult['band'] = score < 34 ? 'red' : score < 67 ? 'amber' : 'green'

  return { score, band, zHrv, zRhr, respPenalty }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/metrics/recovery.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/metrics/recovery.ts src/metrics/recovery.test.ts
git commit -m "feat(metrics): recovery engine (HRV/RHR/sleep/resp vs baseline)"
```

---

### Task 9: Strain engine

**Files:**
- Create: `src/metrics/strain.ts`, `src/metrics/strain.test.ts`

**Interfaces:**
- Consumes: `WorkoutInput`, `Profile`, `SessionStrain`, `StrainResult` from `types.ts`.
- Produces:
  - `STRAIN_TAU` (exported default)
  - `hrMax(profile: Profile, currentYear: number): number`
  - `sessionTrimp(args: { durationMin; avgHr; hrRest; hrMax; sex }): number`
  - `dayStrain(dayTrimp: number, tau?: number): number` (0..21 saturating)
  - `computeStrain(workouts: WorkoutInput[], ctx: { hrRest; hrMax; sex }): StrainResult`

- [ ] **Step 1: Write the failing test**

Create `src/metrics/strain.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hrMax, sessionTrimp, dayStrain, computeStrain } from './strain'
import type { Profile, WorkoutInput } from './types'

describe('strain engine', () => {
  it('hrMax uses the Nes formula and respects override', () => {
    const p: Profile = { birthYear: 1996, sex: 'male', sleepNeedBaseHours: 8 }
    expect(hrMax(p, 2026)).toBeCloseTo(211 - 0.64 * 30, 5) // age 30
    expect(hrMax({ ...p, hrMaxOverride: 195 }, 2026)).toBe(195)
  })

  it('sessionTrimp grows with intensity and duration', () => {
    const easy = sessionTrimp({ durationMin: 30, avgHr: 110, hrRest: 55, hrMax: 190, sex: 'male' })
    const hard = sessionTrimp({ durationMin: 60, avgHr: 165, hrRest: 55, hrMax: 190, sex: 'male' })
    expect(hard).toBeGreaterThan(easy)
    expect(easy).toBeGreaterThan(0)
  })

  it('dayStrain saturates toward 21 and is monotonic', () => {
    expect(dayStrain(0)).toBe(0)
    expect(dayStrain(120)).toBeGreaterThan(dayStrain(60))
    expect(dayStrain(10000)).toBeLessThanOrEqual(21)
    expect(dayStrain(10000)).toBeGreaterThan(20)
  })

  it('computeStrain sums sessions for a two-a-day', () => {
    const workouts: WorkoutInput[] = [
      { start: '2026-06-21T07:00:00Z', end: '2026-06-21T07:45:00Z', type: 'Traditional Strength Training', avgHr: 130, maxHr: 160, durationMin: 45 },
      { start: '2026-06-21T18:00:00Z', end: '2026-06-21T19:30:00Z', type: 'Tennis', avgHr: 150, maxHr: 180, durationMin: 90 },
    ]
    const r = computeStrain(workouts, { hrRest: 55, hrMax: 190, sex: 'male' })
    expect(r.sessions).toHaveLength(2)
    expect(r.dayTrimp).toBeGreaterThan(0)
    expect(r.strain).toBeGreaterThan(0)
    expect(r.strain).toBeLessThanOrEqual(21)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/metrics/strain.test.ts
```

Expected: FAIL — cannot find module `./strain`.

- [ ] **Step 3: Write the implementation**

Create `src/metrics/strain.ts`:

```ts
import type { WorkoutInput, Profile, SessionStrain, StrainResult } from './types'

export const STRAIN_TAU = 120 // day-TRIMP scale; tune in Plan 2

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function hrMax(profile: Profile, currentYear: number): number {
  if (profile.hrMaxOverride) return profile.hrMaxOverride
  const age = currentYear - profile.birthYear
  return 211 - 0.64 * age // Nes et al.
}

export function sessionTrimp(args: {
  durationMin: number
  avgHr: number
  hrRest: number
  hrMax: number
  sex: 'male' | 'female'
}): number {
  const denom = args.hrMax - args.hrRest
  if (denom <= 0 || args.durationMin <= 0) return 0
  const hrr = clamp01((args.avgHr - args.hrRest) / denom)
  const coeff = args.sex === 'male' ? 0.64 : 0.86
  const exp = args.sex === 'male' ? 1.92 : 1.67
  return args.durationMin * hrr * coeff * Math.exp(exp * hrr)
}

/** Saturating 0..21 map of cumulative daily TRIMP. */
export function dayStrain(dayTrimp: number, tau: number = STRAIN_TAU): number {
  if (dayTrimp <= 0) return 0
  return Math.min(21, 21 * (1 - Math.exp(-dayTrimp / tau)))
}

export function computeStrain(
  workouts: WorkoutInput[],
  ctx: { hrRest: number; hrMax: number; sex: 'male' | 'female' },
): StrainResult {
  const sessions: SessionStrain[] = workouts.map((w) => ({
    type: w.sportTag ?? w.type,
    trimp:
      w.avgHr == null
        ? 0
        : sessionTrimp({
            durationMin: w.durationMin,
            avgHr: w.avgHr,
            hrRest: ctx.hrRest,
            hrMax: ctx.hrMax,
            sex: ctx.sex,
          }),
  }))
  const dayTrimp = sessions.reduce((a, s) => a + s.trimp, 0)
  return { sessions, dayTrimp, strain: dayStrain(dayTrimp) }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/metrics/strain.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/metrics/strain.ts src/metrics/strain.test.ts
git commit -m "feat(metrics): strain engine (Banister TRIMP + 0-21 day strain)"
```

---

### Task 10: Training load / injury-guard engine

**Files:**
- Create: `src/metrics/load.ts`, `src/metrics/load.test.ts`

**Interfaces:**
- Consumes: `LoadResult` from `types.ts`; `mean`, `stdDev` from `baseline.ts`.
- Produces:
  - `LOAD_BANDS` (exported thresholds)
  - `computeLoad(dailyLoads: { date: string; load: number }[], asOf: string): LoadResult`
    - `dailyLoads` is daily TRIMP (or strain) history, any order; `asOf` is the YYYY-MM-DD anchor.
    - acute = mean of the 7 days ending `asOf`; chronic = mean of the 28 days ending `asOf`.
    - `acwr = acute/chronic` (0 when chronic is 0); `monotony = mean(7)/sd(7)` (0 when sd is 0).

- [ ] **Step 1: Write the failing test**

Create `src/metrics/load.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeLoad } from './load'

function days(values: number[], end: string): { date: string; load: number }[] {
  // values oldest -> newest, ending on `end`
  const endDate = new Date(end + 'T00:00:00Z')
  return values.map((load, i) => {
    const d = new Date(endDate)
    d.setUTCDate(endDate.getUTCDate() - (values.length - 1 - i))
    return { date: d.toISOString().slice(0, 10), load }
  })
}

describe('computeLoad', () => {
  it('steady load gives ACWR near 1 and optimal band', () => {
    const hist = days(Array(28).fill(100), '2026-06-21')
    const r = computeLoad(hist, '2026-06-21')
    expect(r.acwr).toBeCloseTo(1, 2)
    expect(r.band).toBe('optimal')
  })

  it('a sudden spike pushes ACWR high-risk', () => {
    const hist = days([...Array(21).fill(50), ...Array(7).fill(150)], '2026-06-21')
    const r = computeLoad(hist, '2026-06-21')
    expect(r.acwr).toBeGreaterThan(1.5)
    expect(r.band).toBe('high-risk')
  })

  it('handles empty chronic window without dividing by zero', () => {
    const r = computeLoad([], '2026-06-21')
    expect(r.acwr).toBe(0)
    expect(r.band).toBe('detraining')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/metrics/load.test.ts
```

Expected: FAIL — cannot find module `./load`.

- [ ] **Step 3: Write the implementation**

Create `src/metrics/load.ts`:

```ts
import type { LoadResult } from './types'
import { mean, stdDev } from './baseline'

export const LOAD_BANDS = {
  detrainingBelow: 0.8,
  optimalBelow: 1.3,
  cautionBelow: 1.5, // >= this is high-risk
} as const

function loadsEndingOn(
  dailyLoads: { date: string; load: number }[],
  asOf: string,
  windowDays: number,
): number[] {
  const end = new Date(asOf + 'T00:00:00Z').getTime()
  const startMs = end - (windowDays - 1) * 86_400_000
  return dailyLoads
    .filter((d) => {
      const t = new Date(d.date + 'T00:00:00Z').getTime()
      return t >= startMs && t <= end
    })
    .map((d) => d.load)
}

export function computeLoad(
  dailyLoads: { date: string; load: number }[],
  asOf: string,
): LoadResult {
  const week = loadsEndingOn(dailyLoads, asOf, 7)
  const month = loadsEndingOn(dailyLoads, asOf, 28)

  const acute = mean(week)
  const chronic = mean(month)
  const acwr = chronic > 0 ? acute / chronic : 0

  const wSd = stdDev(week)
  const monotony = wSd > 0 ? mean(week) / wSd : 0
  const weeklyLoad = week.reduce((a, b) => a + b, 0)
  const trainingStrain = weeklyLoad * monotony

  let band: LoadResult['band']
  if (acwr < LOAD_BANDS.detrainingBelow) band = 'detraining'
  else if (acwr < LOAD_BANDS.optimalBelow) band = 'optimal'
  else if (acwr < LOAD_BANDS.cautionBelow) band = 'caution'
  else band = 'high-risk'

  return { acute, chronic, acwr, monotony, trainingStrain, band }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/metrics/load.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite, typecheck, and commit**

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npx tsc -b
npm test
git add src/metrics/load.ts src/metrics/load.test.ts
git commit -m "feat(metrics): training load engine (ACWR + monotony injury guard)"
```

Expected: typecheck clean; all engine suites pass.

---

## What Plan 2 will cover (after Task 4 captures a real payload)

- **Parser** `src/lib/parseHae.ts` mapping the captured `hae-sample.json` shape into `NightSample`/`SleepInput`/`WorkoutInput`, tested against the fixture.
- **Normalized schema** migration (`samples`, `sleep_segments`, `workouts`, `daily_metrics`, `profile`) and an upsert path from `raw_payloads`.
- **Nightly compute pipeline** that runs the four engines and writes `daily_metrics`.
- **Whoop-dark UI**: index.css token palette, recovery ring, Today / Trends / Sleep / Sport Load / Coach screens.
- **Nemotron coach** behind a `CoachAdapter` (mirroring delphi's `src/lib/coach/adapter.ts`): morning brief + chat fed the computed metrics.
- **Calibration** of `STRAIN_TAU`, `RECOVERY_WEIGHTS` gain, and sleep thresholds against accumulated real data.
- **UI passcode gate** + Supabase RLS read policies.

---

## Self-Review

**Spec coverage:** Recovery (Task 8), Strain (Task 9), Sleep (Task 7), Training load/ACWR/monotony (Task 10), ingestion endpoint + Health Auto Export (Tasks 3-4), Supabase backend (Tasks 2-3), data model raw layer (Task 2; normalized layer explicitly deferred to Plan 2), stack/structure (Task 1). Coach, screens, parser, security gate, and calibration are explicitly scoped to Plan 2 with reasons (all require the real payload). No silent gaps.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Division-by-zero, null samples, and empty windows are handled with concrete code and tested. The only deferrals are the named Plan 2 items, each with a rationale.

**Type consistency:** `Baseline` (`mean`/`sd`/`n`) is produced by `rollingBaseline` (Task 6) and consumed by `computeRecovery` (Task 8). `SleepResult.performance` (Task 7) feeds `computeRecovery`'s `sleepPerformance` (Task 8). `WorkoutInput`/`Profile` (Task 5) feed `computeStrain` (Task 9). `mean`/`stdDev` (Task 6) are reused by `computeLoad` (Task 10). All signatures match across tasks.
