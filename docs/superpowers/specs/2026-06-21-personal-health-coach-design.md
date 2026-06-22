# Personal Health & Fitness Coach — Design Spec

- **Date:** 2026-06-21
- **Status:** Approved (brainstorming), pending implementation plan
- **Author:** Shreyas Kakkar (with Claude)

## 1. Overview

A single-user, self-curated health and fitness coach built around **Apple Watch / Apple Health
data** — essentially a personal Whoop. The owner trains every morning and plays a sport
(tennis, pickleball, or cricket) every evening, so the app is tuned for a **twice-daily, every-day**
training routine and must be more useful than the stock Apple Health app.

The product produces, every day:

1. **Recovery** (0–100%) — how recovered the body is this morning.
2. **Strain / exertion** (0–21) — cardiovascular load per session and per day.
3. **Sleep** (0–100) — quality vs a computed sleep need.
4. **Training load / injury guard** — acute vs chronic load, to flag overtraining.
5. **Coaching** — a plain-language daily brief plus a chat, driven by the numbers above.

## 2. Key decisions (locked during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Project home | **Brand new repo** (`personal-health-coach`) | Unrelated domain to the finance app (delphi). |
| Data ingestion | **Health Auto Export** iOS app → auto POST JSON | Best value + richest data (HRV, RHR, sleep stages, workouts, resp rate) with the least effort. No web API exists for Apple Health, and a native HealthKit app is overkill. |
| Backend | **Supabase** (Postgres + Edge Function + auth) | Permanent HTTPS endpoint the phone can hit from anywhere; free tier; owner already knows it from delphi. |
| Coach AI | **NVIDIA Nemotron** | Reuse the provider/setup delphi's coach already uses. |
| Look & feel | **Whoop-style dark** | Dark, data-dense, athletic; colored recovery rings; charts. |
| Users | **Single user (just the owner)** | No signup/multi-tenant system. One ingest secret + a simple UI gate. |
| Coach architecture | **Hybrid** | Deterministic engines compute the numbers; the LLM only narrates/answers. |

## 3. Architecture & data flow

```
Apple Watch  →  Apple Health (iPhone)  →  Health Auto Export app
     │                                          │  (scheduled auto POST, JSON)
     ▼                                          ▼
                                   Supabase Edge Function  (/ingest, secret token)
                                          │  validate + parse + upsert
                                          ▼
                                   Postgres  (raw samples/workouts + nightly daily_metrics)
                                          │
                                          ▼
                          React web app  ── reads ──►  dashboard + coach
```

The owner configures Health Auto Export **once** to POST to the Supabase endpoint on a morning
schedule. Everything after that is automatic. The web app is **read-mostly**: it computes (or reads
precomputed) scores and renders them.

## 4. Data ingestion (Health Auto Export)

- HAE sends a JSON payload with two main collections:
  - **`metrics`** — quantity samples: `heart_rate_variability` (SDNN), `resting_heart_rate`,
    `heart_rate`, `respiratory_rate`, `active_energy`, `step_count`, `vo2_max`, `sleep_analysis`
    (with stages), etc. Each metric has a name/unit and an array of data points (date + value).
  - **`workouts`** — type, start/end, duration, active energy, avg/max HR, distance, and
    (where available) heart-rate samples.
- The exact field shape **must be verified against a real first export** (Phase 1) before the
  parser is finalized — payload shape is the one external unknown.
- Ingestion is **idempotent**: a dedupe key (metric name + start timestamp, or a payload hash)
  prevents duplicate rows when overlapping windows are re-sent.

## 5. Data model (Postgres, refined in the plan)

- `ingest_log(id, received_at, payload_hash, source, status)` — audit + dedupe.
- `samples(id, metric, start_ts, end_ts, value, unit, source)` — long format for all quantity metrics.
- `sleep_segments(id, start_ts, end_ts, stage)` — Core / Deep / REM / Awake.
- `workouts(id, type, start_ts, end_ts, duration_s, active_energy, avg_hr, max_hr, distance, sport_tag)`.
- `daily_metrics(date PK, recovery, strain, sleep_score, sleep_need_h, hrv, rhr, resp_rate, acwr, monotony, computed_at)`
  — the nightly rollup the UI reads.
- `profile(id, birth_year, sex, hr_max_override, sleep_need_base_h)` — single row; inputs the engines need.

Baselines (rolling means/SDs) are computed from `samples`/`daily_metrics` either on the fly or in a
materialized view; decided in the plan.

## 6. The four engines

All engines are **pure, unit-tested functions** over the stored data, scored against the owner's
**personal rolling baseline** (their normal, not population averages). All weights/constants below
are **tunable defaults**, to be calibrated against real data.

### 6.1 Recovery (0–100%)
- Maintain a rolling baseline (≈30-day, exponentially weighted) mean and SD for overnight **HRV
  (SDNN)** and **resting HR**.
- Compute today's standardized deviations:
  - `zHRV  = (HRV_today − mean_HRV) / sd_HRV`        (higher HRV = better)
  - `zRHR  = (RHR_today − mean_RHR) / sd_RHR`         (higher RHR = worse, so invert)
  - `respPenalty` from elevated respiratory rate vs baseline (possible illness/overreach).
  - `sleepPerf` (0–1) from the sleep engine.
- Weighted blend (default weights HRV 0.50, RHR 0.25, Sleep 0.20, Resp 0.05), mapped through a
  clamped logistic to 0–100. Output bucketed for the UI: red (<34%), amber (34–66%), green (>66%).

### 6.2 Strain / exertion (0–21), Banister TRIMP
- `HR_max` from `211 − 0.64 × age` (Nes formula) or `hr_max_override` / observed max; `HR_rest` from data.
- Per session: `HRr = (HR_avg − HR_rest) / (HR_max − HR_rest)`,
  `TRIMP = duration_min × HRr × 0.64 × e^(1.92 × HRr)`.
- Daily TRIMP = sum of session TRIMPs + ambient activity contribution.
- Map cumulative daily TRIMP to a **logarithmic 0–21 strain** (`strain = a · ln(1 + k·TRIMP)`),
  with `a`,`k` calibrated so a typical hard day lands ~14–16 and an all-out day ~18–21.
- Per-session strain is shown for the morning workout and the evening sport separately.

### 6.3 Sleep (0–100)
- **Sleep need (h)** = base (profile, default 8.0) + accrued **sleep debt** (capped) +
  **strain adjustment** (yesterday's high strain raises need) − nap credit.
- Components: **performance** = asleep / need (cap 100%); **efficiency** = asleep / time-in-bed;
  **consistency** = closeness of sleep/wake times to recent average; **restorative** =
  (deep + REM)/asleep scored vs a ~40–50% target.
- Weighted blend → 0–100.

### 6.4 Training load / injury guard
- Daily load = session TRIMP (or strain).
- **ACWR** = acute (7-day) / chronic (28-day) load. Sweet spot 0.8–1.3; **>1.5 = elevated injury
  risk**; <0.8 = detraining. Shown as a gauge.
- **Monotony** (Foster) = mean daily load / SD of daily load over 7 days; **training strain** =
  weekly load × monotony. High monotony with a twice-daily routine is the key risk to surface.
- **Per-sport breakdown** by Apple workout `type`. Tennis/pickleball/cricket may map imperfectly
  (cricket often logs as "Other"), so a **time-of-day heuristic** (evening = sport) plus optional
  **manual sport tagging** (`sport_tag`) resolves it.

## 7. The coach (hybrid, Nemotron)

- The deterministic engines produce structured daily metrics; a thin LLM layer turns them into:
  - a **morning brief** — e.g. *"Recovery 41%. HRV is below your baseline and you got 5h54m. Keep
    the morning session zone-2 and make tonight's tennis social rather than competitive."*
  - a **chat** — "should I play hard tonight?" answered with the day's context.
- Implemented behind a **`CoachAdapter` interface** (mirroring delphi's `src/lib/coach/adapter.ts`),
  with a Nemotron implementation. The LLM receives the computed numbers as context; it does **not**
  compute scores itself.

## 8. Frontend

- **Stack:** React 19 + Vite + Tailwind v4 + Supabase client (same proven stack as delphi). New repo.
- **Theme:** Whoop-style dark — dark surfaces, colored recovery rings (red/amber/green), dense charts.
- **Screens:**
  - **Today** — recovery ring, today's strain target, last night's sleep summary, coach morning brief.
  - **Trends** — HRV, RHR, recovery, strain over weeks.
  - **Sleep** — stages, debt, consistency, sleep score history.
  - **Sport Load** — per-sport breakdown + ACWR injury gauge + monotony.
  - **Coach** — chat.
- **Structure:** `metrics/` (the four engines, pure + tested), `lib/supabase`, `pages/`, `components/`.

## 9. Security (personal-grade)

- **Ingest** protected by a long random bearer token stored as an Edge Function secret; rejects
  unauthenticated POSTs.
- **UI** access via a simple passcode gate + Supabase RLS read policies. This is "good enough for a
  personal single-user app," explicitly **not** a hardened multi-tenant auth system.
- No PII beyond the owner's own health data; data stays in the owner's Supabase project.

## 10. Testing

- The four engines are **pure functions** developed **test-first (TDD)** with fixture data, so the
  scoring math is verified independently of the UI and the network.
- The ingest parser is tested against a captured real HAE payload.

## 11. Build phases (high level — detailed in the plan)

1. **Foundation** — repo scaffold, Supabase project, schema, `/ingest` Edge Function; verify a real
   Health Auto Export → DB round trip.
2. **Recovery + Sleep engines** (TDD) + **Today** screen.
3. **Strain engine** + **Trends** screen.
4. **Training load** (ACWR + monotony) + **Sport Load** screen.
5. **Nemotron coach** (morning brief + chat) via `CoachAdapter`.
6. **Polish** — Whoop-dark theming, dark charts, baseline/constant calibration on real data.

## 12. Non-goals (YAGNI)

- Multi-user / public signup.
- A native iOS/HealthKit app or real-time streaming.
- Medical-grade accuracy or diagnosis.
- Writing data back into Apple Health.

## 13. Open questions (resolved during implementation)

- Exact Health Auto Export payload field names (verify with first real export in Phase 1).
- Profile inputs needed by the engines (birth year, sex, HR max, base sleep need) — small settings form.
- Final calibration of strain/recovery constants against the owner's real data.
