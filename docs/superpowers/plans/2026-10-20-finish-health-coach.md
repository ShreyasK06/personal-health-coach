# Finish Personal Health Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contain the data exposure, then ship a public synthetic-data live demo with a Sport Load screen and a coach (morning brief + chat) that works offline.

**Architecture:** All data enters through one `loadHealthData()` seam. It loads the owner's live Firebase data by default and returns synthetic demo data only when the page URL has `?demo=1`. The coach is a `CoachAdapter` interface fed only the already-computed `DayView` numbers; a deterministic rules adapter is the default and an optional HTTP adapter falls back to it on any failure. Sport Load is a new pure engine over a new `DayView.workouts` field, plus one screen.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, Vitest 4 (existing). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-06-21-personal-health-coach-design.md` (sections 6.4 Sport Load, 7 Coach, 9 Security). Deviations decided with the owner on 2026-10-20: data source is Firebase not Supabase; no passcode gate (replaced by demo-by-default plus private repo); no LLM key ships in the bundle.

## Global Constraints

- Work on branch `feat/plan-1-foundation` (the real code; `master` holds docs only).
- Owner accepts the existing public data exposure; do not add privacy or purge work. New code must not add secrets (API keys) to the client bundle.
- Engines stay pure functions with Vitest tests; run `npx vitest run`, `npx tsc -b`, `npx eslint .` before every commit.
- ACWR bands come from `LOAD_BANDS` in `src/metrics/load.ts` (0.8 / 1.3 / 1.5); do not redefine them.
- Cricket often logs as Apple type `"Other"`; evening means workout start hour >= 16 (spec 6.4 heuristic).
- Not medical advice: coach copy must not diagnose.
- Never push, force-push, make the repo private, create GitHub repos, or change Firebase rules without the owner confirming at that moment. Those are owner actions or confirmed actions.
- All asset and fetch paths relative or via `import.meta.env.BASE_URL`; never hardcode `/foo.png`.
- Before `npm run build`, make sure no dev server is running against the same output dir.

## Review Focus

- Day with no workouts, or whole dataset with none: Sport Load shows an empty state, no NaN/crash.
- Chronic load of 0 (new user, <28 days): ACWR displays "not enough history", never `Infinity`/`NaN`.
- Workout crossing midnight or with null avg HR: classified and counted without throwing.
- `localStorage` unavailable or corrupt JSON: sport tags degrade to none, app still renders.
- Coach with a day whose `recovery` is null (calibrating): brief says baseline is still building, no invented numbers.
- LLM endpoint timeout / non-200 / malformed body: chat still answers via rules adapter.
- `?demo=1` absent: the live path is unchanged; present: no network call at all.

---

### Task 1: Make the README truthful (owner decision: data stays public)

**Decision (2026-10-20):** the owner chose to leave the Firebase database and the committed `.superpowers/` export public and the repo public. No history purge, no privacy flip, no rule changes. Do not raise this again.

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** In `README.md`, replace the sentence "This repository contains no personal health data." with an accurate one: the repo includes a sample export under `.superpowers/` and reads a public Firebase database, both from the owner's own data.
- [ ] **Step 2:** Commit `docs: correct README statement about included health data`.

### Task 2: Demo-by-default data seam

**Files:**
- Modify: `src/lib/firebase.ts` (`loadHealthData` chooses source), `src/App.tsx` (demo pill)
- Create: `src/demo/generateDemo.ts`, `src/demo/generateDemo.test.ts`
- Test: `src/lib/firebase.test.ts`

**Interfaces:**
- Produces: `generateDemoPayloads(days?: number, seed?: number): unknown[]` returning Health Auto Export-shaped payloads (`{ data: { metrics, workouts } }`) for the last `days` (default 45) ending today; deterministic for a given `seed` (default 7). Includes `heart_rate_variability`, `resting_heart_rate`, `respiratory_rate`, `sleep_analysis`, `step_count`, `active_energy`, and per-day workouts: a morning "Traditional Strength Training" and an evening "Tennis" or "Other" (cricket).
- Produces: `loadHealthData(): Promise<DayView[]>` returns `buildDayViews(generateDemoPayloads())` with no network call when `new URLSearchParams(location.search).has('demo')`; otherwise it fetches the existing live Firebase URL exactly as today (keep the `FIREBASE_DB_URL` constant). `isDemoData(): boolean` exported for the UI pill.

- [ ] **Step 1:** Write `generateDemo.test.ts`: `generateDemoPayloads(45, 7)` deep-equals a second call (determinism); `buildDayViews(...)` yields 45 days; at least one day has `recovery` non-null with `band` in red/amber/green; the JSON string contains neither `"Shreyas"` nor `firebaseio`.
- [ ] **Step 2:** Run `npx vitest run src/demo`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `generateDemo.ts` with a small seeded PRNG (mulberry32); weekly sinusoidal HRV/RHR plus noise; include one hard-load week so ACWR leaves the optimal band for the Sport Load demo.
- [ ] **Step 4:** Write `firebase.test.ts` using `vi.stubEnv` and a stubbed `fetch`: with `?demo=1` in `location.search`, resolves demo days and never calls `fetch`; without it, calls `fetch` once on `${FIREBASE_DB_URL}/health_raw.json`.
- [ ] **Step 5:** Implement the seam.
- [ ] **Step 6:** In `App.tsx`, show a small "Demo data" pill when `isDemoData()`.
- [ ] **Step 7:** Run tests, tsc, eslint. Expected: pass. Commit `feat(data): synthetic demo data by default, live database opt-in via env`.

### Task 3: Workouts on `DayView`

**Files:**
- Modify: `src/lib/firebase.ts` (`DayView`, `buildDayViews`)
- Test: `src/lib/firebase.test.ts`

**Interfaces:**
- Consumes: `parseFirebaseExports(...).workoutsByDate: Map<string, WorkoutInput[]>`.
- Produces: `DayView.workouts: WorkoutInput[]` (empty array when none).

- [ ] **Step 1:** Add test: `buildDayViews(generateDemoPayloads(10, 7))` — every day has a `workouts` array; at least one day has length 2; a day with none yields `[]`, not undefined.
- [ ] **Step 2:** Run. Expected: FAIL. Implement by reading `workoutsByDate.get(result.date) ?? []`. Run. Expected: PASS. Commit `feat(data): expose per-day workouts on DayView`.

### Task 4: Sport Load engine + sport tags

**Files:**
- Create: `src/metrics/sport.ts`, `src/metrics/sport.test.ts`, `src/lib/sportTags.ts`, `src/lib/sportTags.test.ts`

**Interfaces:**
- Consumes: `WorkoutInput` (`src/metrics/types.ts`), `DayView.workouts`, `DayView.strain.sessions`, `DayView.load`, `LOAD_BANDS`.
- Produces:
  - `classifySport(w: WorkoutInput): string`. Precedence: `w.sportTag`, then Apple type map (Tennis, Pickleball, Cricket, and the common gym/cardio types keep their own names), then `"Other"` starting at hour >= 16 gives `"Evening sport"`, else `"Other"`.
  - `interface SportSlice { sport: string; sessions: number; minutes: number; trimp: number; share: number }` (share is 0..1 of window TRIMP).
  - `sportBreakdown(days: DayView[], index: number, windowDays = 28): SportSlice[]`, sorted by trimp desc; `[]` when no workouts.
  - `loadGuard(day: DayView, historyDays: number): { band: LoadResult['band'] | 'insufficient'; acwr: number | null; monotony: number | null; message: string }`. `insufficient` when `historyDays < 14` or chronic load is 0.
  - `getSportTags(): Record<string, string>` and `setSportTag(workoutStart: string, sport: string): void` in `sportTags.ts`, keyed by workout `start`, stored in `localStorage` under `phc.sportTags`, wrapped in try/catch returning `{}` on any failure.

- [ ] **Step 1:** Write `sport.test.ts`: Tennis workout gives "Tennis"; type "Other" at `2026-06-20T18:30:00` gives "Evening sport"; same at `07:00` gives "Other"; `sportTag: 'Cricket'` on an "Other" gives "Cricket"; `sportBreakdown` shares sum to 1 (`toBeCloseTo`) and are sorted desc; empty days give `[]`; `loadGuard` with ACWR 1.6 gives band `high-risk`; chronic 0 gives `insufficient` with `acwr === null`.
- [ ] **Step 2:** Run `npx vitest run src/metrics/sport`. Expected: FAIL.
- [ ] **Step 3:** Implement `sport.ts` as pure functions; read the hour from the ISO string rather than a local `Date` conversion so tests are timezone-stable.
- [ ] **Step 4:** Write `sportTags.test.ts`: round-trip set/get; corrupt JSON in storage gives `{}`; a throwing `localStorage` getter gives `{}` and `setSportTag` does not throw. Implement.
- [ ] **Step 5:** Run all tests. Expected: pass. Commit `feat(metrics): sport load engine and manual sport tags`.

### Task 5: Sport Load screen

**Files:**
- Create: `src/screens/SportLoad.tsx`, `src/screens/SportLoad.test.tsx`
- Modify: `src/components/BottomNav.tsx` (`TabId` adds `'load'`; five tabs, split 2 left / 3 right around the center button), `src/App.tsx`

**Interfaces:**
- Consumes: `sportBreakdown`, `loadGuard`, `getSportTags`, `setSportTag`, existing `Card`, `ChartCard`, `Gauge`, `BarChart`, `SectionLabel`, `EmptyState`.
- Produces: `SportLoad({ days, selectedIndex, onSelectIndex }: { days: DayView[]; selectedIndex: number; onSelectIndex: (i: number) => void })`.

- [ ] **Step 1:** Write the test with `react-dom/server` `renderToString` (no new dependency): demo days render "Sport load", at least one sport name and an ACWR value; days with all `workouts: []` render the empty-state text and no "NaN".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement: ACWR `Gauge` with band label from `loadGuard`; per-sport bars from `sportBreakdown`; monotony and weekly training-strain tiles; a "Tag sessions" list of the selected day's workouts, each with a select (Tennis / Pickleball / Cricket / Other) calling `setSportTag`. Follow the Card/ChartCard conventions and existing tokens.
- [ ] **Step 4:** Wire the tab in `BottomNav.tsx` and `App.tsx`. Run tests, tsc, eslint. Expected: pass.
- [ ] **Step 5:** Run `npm run dev`, screenshot the screen at 390px wide, confirm no overflow or overlap. Commit `feat(ui): Sport Load screen with ACWR guard and sport tagging`.

### Task 6: Coach (adapter, rules, optional HTTP, UI)

**Files:**
- Create: `src/coach/adapter.ts`, `src/coach/rulesAdapter.ts`, `src/coach/httpAdapter.ts`, `src/coach/index.ts`, `src/coach/coach.test.ts`, `src/components/CoachSheet.tsx`
- Modify: `src/screens/Today.tsx` (morning brief card with "Ask coach" button)

**Interfaces:**
- Consumes: `DayView`, `readiness(days, i)`, `intensityTarget(day)`, `sleepDebtHours(days, i)`, `loadGuard` (Task 4).
- Produces:
  - `interface CoachContext { day: DayView; readiness: Readiness; target: IntensityTarget | null; sleepDebtHours: number; load: ReturnType<typeof loadGuard> }` and `buildCoachContext(days: DayView[], i: number): CoachContext`.
  - `interface CoachAdapter { brief(ctx: CoachContext): Promise<string>; ask(ctx: CoachContext, question: string): Promise<string> }`.
  - `rulesAdapter: CoachAdapter`, deterministic. `brief` quotes recovery %, HRV vs baseline, sleep hours and the intensity zone. `ask` matches intents (`/play|train|workout|hard|push/` for intensity advice, `/sleep|tired|rest/` for sleep advice, else the brief plus a nudge). With `recovery === null` it says the baseline is still building and gives no recovery percentage.
  - `createHttpAdapter(endpoint: string, fallback: CoachAdapter, timeoutMs = 8000): CoachAdapter`. POSTs `{ context, question }` JSON (computed numbers only, no raw payloads); on timeout, non-2xx, or a non-string `reply` it returns the fallback's answer.
  - `getCoach(): CoachAdapter` returns the HTTP adapter when `import.meta.env.VITE_COACH_ENDPOINT` is set, else `rulesAdapter`. No API key is read or embedded anywhere in client code.

- [ ] **Step 1:** Write `coach.test.ts`: rules `brief` for a green-band day contains "Zone 4-5" and the recovery number; for `recovery: null` contains "baseline" and no `%`; `ask("should I play hard tonight?")` on a red day contains "Zone 1-2"; HTTP adapter with `fetch` mocked to reject, return 500, or return `{reply: 5}` yields the rules answer each time; with `{reply: 'ok'}` yields `'ok'`; the request body has no key named `payload` or `raw`.
- [ ] **Step 2:** Run `npx vitest run src/coach`. Expected: FAIL.
- [ ] **Step 3:** Implement the adapter files. Run. Expected: PASS.
- [ ] **Step 4:** Build `CoachSheet` following the `MetricDetailSheet` pattern: brief on open, input and message list for chat, a pending state while awaiting, footer "General guidance, not medical advice". Add the brief card to Today.
- [ ] **Step 5:** Run tests, tsc, eslint; check the sheet in the browser at 390px. Commit `feat(coach): CoachAdapter with offline rules coach and optional HTTP adapter`.

### Task 7: Demo deploy, docs, final verification

**Files:**
- Modify: `.github/workflows/deploy.yml`, `README.md`, `docs/superpowers/specs/2026-06-21-personal-health-coach-design.md` (append a "Deviations" note)

**Interfaces:** Produces: a workflow that triggers on pushes to `main` and `master` plus `workflow_dispatch`.

- [ ] **Step 1:** Change the workflow trigger to `branches: [main, master]`. Confirm `base` in `vite.config.ts` still resolves under `/personal-health-coach/`.
- [ ] **Step 3:** Run `npx vitest run`, `npx tsc -b`, `npx eslint .`, `npm run build`. Expected: all pass.
- [ ] **Step 4:** Confirm `dist/` contains no API keys: `grep -rEi "api[_-]?key|sk-" dist`. Expected: no output.
- [ ] **Step 5:** Serve `dist` with `npx vite preview`, click through every tab and the coach sheet, check the console is clean, and screenshot Today, Sport Load and Coach at 390px.
- [ ] **Step 6:** Update the README (features, Sport Load, Coach, demo vs live data, env vars, honest Status) and append the spec Deviations note. Commit `docs: README and spec deviations for demo, sport load, coach`.
- [ ] **Step 7 (confirm with owner first):** present the push command; run it only on an explicit go-ahead.
