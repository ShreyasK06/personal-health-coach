// Pure interpretive helpers for the "in-depth detail" views: turn the engines'
// already-computed scores (RecoveryResult/SleepResult/StrainResult/LoadResult)
// into driver breakdowns vs the user's own baseline, a training-readiness
// summary, sleep-architecture stage breakdowns, and short plain-language
// guidance. No I/O, no engine logic — consumed by the detail-view UI.
import type { DayView } from './firebase'
import { rollingBaseline } from '../metrics/baseline'
import { RECOVERY_WEIGHTS } from '../metrics/recovery'

const FLAT_Z_THRESHOLD = 0.25

function directionFromZ(z: number): 'up' | 'down' | 'flat' {
  if (z > FLAT_Z_THRESHOLD) return 'up'
  if (z < -FLAT_Z_THRESHOLD) return 'down'
  return 'flat'
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

// ---------------------------------------------------------------------------
// 1. Recovery drivers
// ---------------------------------------------------------------------------

export interface Driver {
  key: 'hrv' | 'rhr' | 'sleep' | 'respiratory'
  label: string
  value: number | null
  unit: string
  mean: number | null
  sd: number | null
  z: number
  contribution: number
  direction: 'up' | 'down' | 'flat'
  note: string
}

/** Baseline (mean/sd) for a numeric series ending strictly before index `i`.
 * Falls back to {mean: current value, sd: tiny} when there is no prior
 * history, matching computeDailyResults' first-day behavior. */
function priorBaseline(
  days: DayView[],
  i: number,
  pick: (d: DayView) => number | null,
): { mean: number; sd: number } {
  const prior: number[] = []
  for (let k = 0; k < i; k++) {
    const v = pick(days[k])
    if (v != null) prior.push(v)
  }
  if (prior.length === 0) {
    const current = pick(days[i])
    return { mean: current ?? 0, sd: 1e-6 }
  }
  const b = rollingBaseline(prior, 30)
  return { mean: b.mean, sd: b.sd }
}

/** Builds the four recovery drivers (HRV, RHR, sleep, respiratory) for day
 * `i`, weighted the same way computeRecovery weights them, so the
 * contributions sum to (approximately) the composite that feeds the score. */
export function recoveryDrivers(days: DayView[], i: number): Driver[] {
  const day = days[i]

  // --- HRV ---
  const hrvBaseline = priorBaseline(days, i, (d) => d.hrvMs)
  const hrvValue = day.hrvMs
  const zHrv = hrvValue == null ? 0 : (hrvValue - hrvBaseline.mean) / hrvBaseline.sd
  const hrvContribution = RECOVERY_WEIGHTS.hrv * zHrv
  const hrvDriver: Driver = {
    key: 'hrv',
    label: 'HRV',
    value: hrvValue,
    unit: 'ms',
    mean: hrvBaseline.mean,
    sd: hrvBaseline.sd,
    z: zHrv,
    contribution: hrvContribution,
    direction: directionFromZ(zHrv),
    note:
      hrvValue == null
        ? 'No HRV reading for this day.'
        : `${Math.round(hrvValue)} ms, ${zHrv >= 0 ? '+' : ''}${round1(zHrv)} sd ${
            zHrv >= 0 ? 'above' : 'below'
          } your baseline${
            directionFromZ(zHrv) === 'flat' ? ', near baseline' : zHrv > 0 ? ', lifting recovery' : ', pulling recovery down'
          }.`,
  }

  // --- RHR (higher is worse, so contribution uses -z) ---
  const rhrBaseline = priorBaseline(days, i, (d) => d.restingHr)
  const rhrValue = day.restingHr
  const zRhr = rhrValue == null ? 0 : (rhrValue - rhrBaseline.mean) / rhrBaseline.sd
  const rhrContribution = RECOVERY_WEIGHTS.rhr * -zRhr
  const rhrDriver: Driver = {
    key: 'rhr',
    label: 'Resting HR',
    value: rhrValue,
    unit: 'bpm',
    mean: rhrBaseline.mean,
    sd: rhrBaseline.sd,
    z: zRhr,
    contribution: rhrContribution,
    direction: directionFromZ(-zRhr),
    note:
      rhrValue == null
        ? 'No resting heart rate reading for this day.'
        : directionFromZ(zRhr) === 'flat'
          ? `${Math.round(rhrValue)} bpm, near baseline.`
          : zRhr > 0
            ? `${Math.round(rhrValue)} bpm, ${round1(zRhr)} sd above your baseline, pulling recovery down.`
            : `${Math.round(rhrValue)} bpm, ${round1(Math.abs(zRhr))} sd below your baseline, lifting recovery.`,
  }

  // --- Respiratory rate (only elevated rate penalizes) ---
  const respBaseline = priorBaseline(days, i, (d) => d.respiratoryRate)
  const respValue = day.respiratoryRate
  const zResp = respValue == null ? 0 : (respValue - respBaseline.mean) / respBaseline.sd
  const respPenalty = Math.max(0, zResp)
  const respContribution = RECOVERY_WEIGHTS.resp * -respPenalty
  const respDriver: Driver = {
    key: 'respiratory',
    label: 'Respiratory rate',
    value: respValue,
    unit: 'breaths/min',
    mean: respBaseline.mean,
    sd: respBaseline.sd,
    z: zResp,
    contribution: respContribution,
    direction: directionFromZ(-respPenalty),
    note:
      respValue == null
        ? 'No respiratory rate reading for this day.'
        : respPenalty <= FLAT_Z_THRESHOLD
          ? `${round1(respValue)} breaths/min, near baseline.`
          : `${round1(respValue)} breaths/min, ${round1(respPenalty)} sd above your baseline, pulling recovery down.`,
  }

  // --- Sleep performance, mapped the same way computeRecovery does ---
  const performance = day.sleep?.performance ?? null
  const sleepZ = performance == null ? 0 : (performance - 0.85) / 0.15
  const sleepContribution = RECOVERY_WEIGHTS.sleep * sleepZ
  const sleepDriver: Driver = {
    key: 'sleep',
    label: 'Sleep',
    value: performance == null ? null : Math.round(performance * 100),
    unit: '%',
    mean: 85,
    sd: 15,
    z: sleepZ,
    contribution: sleepContribution,
    direction: directionFromZ(sleepZ),
    note:
      performance == null
        ? 'No sleep data for this day.'
        : `Slept ${Math.round(performance * 100)}% of your need.`,
  }

  return [hrvDriver, rhrDriver, sleepDriver, respDriver]
}

// ---------------------------------------------------------------------------
// 2. Readiness
// ---------------------------------------------------------------------------

export interface Readiness {
  headline: 'Primed' | 'Balanced' | 'Strained' | 'Run down'
  tone: 'positive' | 'warning' | 'critical' | 'sleep'
  note: string
  signals: { label: string; status: 'good' | 'ok' | 'warn'; note: string }[]
}

// Tunable thresholds for readiness classification.
export const READINESS_THRESHOLDS = {
  acwrOptimalLow: 0.8,
  acwrOptimalHigh: 1.5,
  acwrHighRisk: 1.5,
  monotonyHigh: 2,
} as const

function hrvSignal(days: DayView[], i: number): { label: string; status: 'good' | 'ok' | 'warn'; note: string } {
  const baseline = priorBaseline(days, i, (d) => d.hrvMs)
  const value = days[i].hrvMs
  if (value == null) return { label: 'HRV', status: 'ok', note: 'No HRV reading today.' }
  const z = (value - baseline.mean) / baseline.sd
  const status: 'good' | 'ok' | 'warn' = z > FLAT_Z_THRESHOLD ? 'good' : z < -FLAT_Z_THRESHOLD ? 'warn' : 'ok'
  const note =
    status === 'good'
      ? `${Math.round(value)} ms, above your baseline.`
      : status === 'warn'
        ? `${Math.round(value)} ms, below your baseline.`
        : `${Math.round(value)} ms, near your baseline.`
  return { label: 'HRV', status, note }
}

function rhrSignal(days: DayView[], i: number): { label: string; status: 'good' | 'ok' | 'warn'; note: string } {
  const baseline = priorBaseline(days, i, (d) => d.restingHr)
  const value = days[i].restingHr
  if (value == null) return { label: 'Resting HR', status: 'ok', note: 'No resting HR reading today.' }
  const z = (value - baseline.mean) / baseline.sd // higher is worse, so invert for status
  const status: 'good' | 'ok' | 'warn' = z < -FLAT_Z_THRESHOLD ? 'good' : z > FLAT_Z_THRESHOLD ? 'warn' : 'ok'
  const note =
    status === 'good'
      ? `${Math.round(value)} bpm, below your baseline.`
      : status === 'warn'
        ? `${Math.round(value)} bpm, above your baseline.`
        : `${Math.round(value)} bpm, near your baseline.`
  return { label: 'Resting HR', status, note }
}

function loadSignal(day: DayView): { label: string; status: 'good' | 'ok' | 'warn'; note: string } {
  const acwr = day.load.acwr
  const status: 'good' | 'ok' | 'warn' =
    acwr > READINESS_THRESHOLDS.acwrHighRisk
      ? 'warn'
      : acwr >= READINESS_THRESHOLDS.acwrOptimalLow && acwr <= READINESS_THRESHOLDS.acwrOptimalHigh
        ? 'good'
        : 'ok'
  const note =
    status === 'warn'
      ? `ACWR ${round1(acwr)}, your recent training is ramping up faster than your body has adapted to.`
      : status === 'good'
        ? `ACWR ${round1(acwr)}, your training load is well balanced.`
        : `ACWR ${round1(acwr)}, slightly outside your optimal range.`
  return { label: 'Training load (ACWR)', status, note }
}

function monotonySignal(day: DayView): { label: string; status: 'good' | 'ok' | 'warn'; note: string } {
  const monotony = day.load.monotony
  const status: 'good' | 'ok' | 'warn' = monotony > READINESS_THRESHOLDS.monotonyHigh ? 'warn' : 'good'
  const note =
    status === 'warn'
      ? `Monotony ${round1(monotony)}, your training has been very repetitive with little day-to-day variation.`
      : `Monotony ${round1(monotony)}, your training has healthy day-to-day variation.`
  return { label: 'Monotony', status, note }
}

/** Synthesizes a single training-readiness headline + signal breakdown for
 * day `i`, combining recovery band, HRV/RHR drift, and load (ACWR/monotony). */
export function readiness(days: DayView[], i: number): Readiness {
  const day = days[i]
  const band = day.recovery?.band ?? null
  const acwr = day.load.acwr
  const monotony = day.load.monotony

  const acwrOk = acwr >= READINESS_THRESHOLDS.acwrOptimalLow && acwr <= READINESS_THRESHOLDS.acwrOptimalHigh
  const acwrHighRisk = acwr > READINESS_THRESHOLDS.acwrHighRisk
  const monotonyHigh = monotony > READINESS_THRESHOLDS.monotonyHigh

  let headline: Readiness['headline']
  let tone: Readiness['tone']
  let note: string

  if (band == null) {
    // Load-only fallback when there's no overnight recovery reading.
    if (acwrHighRisk || monotonyHigh) {
      headline = 'Strained'
      tone = 'warning'
      note = 'No overnight recovery reading today, but your training load looks elevated, so take it easy.'
    } else if (acwrOk) {
      headline = 'Balanced'
      tone = 'positive'
      note = 'No overnight recovery reading today, but your training load is well balanced.'
    } else {
      headline = 'Balanced'
      tone = 'positive'
      note = 'No overnight recovery reading today. Train to feel.'
    }
  } else if (band === 'green' && acwrOk) {
    headline = 'Primed'
    tone = 'positive'
    note = 'Your recovery is strong and your training load is well balanced. Good day to push.'
  } else if (band === 'red' && (acwrHighRisk || monotonyHigh)) {
    headline = 'Run down'
    tone = 'critical'
    note = 'Recovery is low and your training load is elevated. Prioritize rest and easy movement today.'
  } else if (band === 'red' || acwrHighRisk) {
    headline = 'Strained'
    tone = 'warning'
    note =
      band === 'red'
        ? 'Recovery is low today, so favor an easy session and protect tonight\'s sleep.'
        : 'Your training load is ramping up faster than your body has adapted to. Consider an easier day.'
  } else {
    headline = 'Balanced'
    tone = 'sleep'
    note = 'You are in a balanced state, so train to feel rather than to a number.'
  }

  const signals = [hrvSignal(days, i), rhrSignal(days, i), loadSignal(day), monotonySignal(day)]

  return { headline, tone, note, signals }
}

// ---------------------------------------------------------------------------
// 3. Sleep architecture
// ---------------------------------------------------------------------------

export interface StagePart {
  stage: 'Deep' | 'Core' | 'REM' | 'Awake'
  minutes: number
  pct: number
  healthyLow: number
  healthyHigh: number
  inRange: boolean
}

const HEALTHY_RANGES: Record<StagePart['stage'], { low: number; high: number }> = {
  Deep: { low: 13, high: 23 },
  Core: { low: 45, high: 55 },
  REM: { low: 20, high: 25 },
  Awake: { low: 0, high: 10 },
}

/** Breaks a single day's sleep into Deep/Core/REM/Awake stages, each with its
 * share of total asleep time (Awake is relative to time in bed) and whether
 * that share falls in a healthy range. */
export function sleepArchitecture(day: DayView): { parts: StagePart[]; restorativePct: number; asleepMinutes: number } {
  const asleep = day.asleepMinutes ?? 0
  const deep = day.deepMinutes ?? 0
  const core = day.coreMinutes ?? 0
  const rem = day.remMinutes ?? 0
  const awake = day.awakeMinutes ?? 0
  const inBed = day.inBedMinutes ?? asleep + awake

  const pctOfAsleep = (minutes: number) => (asleep > 0 ? (minutes / asleep) * 100 : 0)
  const pctOfInBed = (minutes: number) => (inBed > 0 ? (minutes / inBed) * 100 : 0)

  const build = (stage: StagePart['stage'], minutes: number, pct: number): StagePart => {
    const range = HEALTHY_RANGES[stage]
    return {
      stage,
      minutes,
      pct,
      healthyLow: range.low,
      healthyHigh: range.high,
      inRange: pct >= range.low && pct <= range.high,
    }
  }

  const parts: StagePart[] = [
    build('Deep', deep, pctOfAsleep(deep)),
    build('Core', core, pctOfAsleep(core)),
    build('REM', rem, pctOfAsleep(rem)),
    build('Awake', awake, pctOfInBed(awake)),
  ]

  const restorativePct = asleep > 0 ? ((deep + rem) / asleep) * 100 : 0

  return { parts, restorativePct, asleepMinutes: asleep }
}

// ---------------------------------------------------------------------------
// 4. Sleep debt
// ---------------------------------------------------------------------------

const SLEEP_DEBT_CAP_HOURS = 10

/** Sums max(0, needHours - asleepHours) over the last `lookback` days ending
 * at index `i` (inclusive), capped at SLEEP_DEBT_CAP_HOURS. */
export function sleepDebtHours(days: DayView[], i: number, lookback = 7): number {
  let debt = 0
  const start = Math.max(0, i - lookback + 1)
  for (let k = start; k <= i; k++) {
    const day = days[k]
    const needHours = day.sleep?.needHours
    if (needHours == null) continue
    const asleepHours = (day.asleepMinutes ?? 0) / 60
    debt += Math.max(0, needHours - asleepHours)
  }
  return Math.min(debt, SLEEP_DEBT_CAP_HOURS)
}

// ---------------------------------------------------------------------------
// 5. Guidance
// ---------------------------------------------------------------------------

/** One or two plain-language guidance sentences for a given metric, derived
 * from the interpretive helpers above. */
export function guidanceFor(kind: 'recovery' | 'sleep' | 'strain' | 'load', days: DayView[], i: number): string {
  const day = days[i]

  if (kind === 'recovery') {
    const drivers = recoveryDrivers(days, i)
    const top = [...drivers].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0]
    const band = day.recovery?.band
    if (band == null) return 'No overnight recovery reading yet. Wear your tracker overnight to unlock this view.'
    const bandSentence =
      band === 'green'
        ? 'Your recovery is strong today.'
        : band === 'amber'
          ? 'Your recovery is balanced today.'
          : 'Your recovery is low today, so favor an easy day.'
    return `${bandSentence} ${top.label} is the biggest factor right now: ${top.note}`
  }

  if (kind === 'sleep') {
    const { restorativePct } = sleepArchitecture(day)
    const debt = sleepDebtHours(days, i)
    const perf = day.sleep ? Math.round(day.sleep.performance * 100) : null
    const perfSentence = perf == null ? 'No sleep data for this day.' : `You met ${perf}% of your sleep need.`
    const debtSentence =
      debt > 1
        ? `You are carrying about ${round1(debt)} hours of sleep debt over the last week, so prioritize an earlier night soon.`
        : 'You are not carrying meaningful sleep debt right now.'
    return `${perfSentence} Restorative sleep (deep plus REM) made up ${Math.round(restorativePct)}% of your night. ${debtSentence}`
  }

  if (kind === 'strain') {
    const strain = day.strain.strain
    const sessions = day.strain.sessions.length
    if (sessions === 0) return 'No tracked sessions today. Light movement is fine on a rest day.'
    const intensity = strain >= 14 ? 'a high-strain' : strain >= 8 ? 'a moderate-strain' : 'a light'
    return `Today was ${intensity} day with a strain of ${round1(strain)} across ${sessions} session${sessions === 1 ? '' : 's'}. Match tomorrow's effort to how you feel, especially if recovery is suppressed.`
  }

  // kind === 'load'
  const { acwr, monotony, band } = day.load
  const acwrSentence =
    band === 'high-risk'
      ? `Your acute to chronic load ratio is ${round1(acwr)}, which is in the high-risk range for injury. Consider easing off for a few days.`
      : band === 'caution'
        ? `Your acute to chronic load ratio is ${round1(acwr)}, slightly elevated. Keep an eye on how your body responds.`
        : band === 'detraining'
          ? `Your acute to chronic load ratio is ${round1(acwr)}, indicating your training volume has dropped recently.`
          : `Your acute to chronic load ratio is ${round1(acwr)}, a well-balanced training load.`
  const monotonySentence =
    monotony > READINESS_THRESHOLDS.monotonyHigh
      ? ` Your training has also been quite repetitive lately (monotony ${round1(monotony)}); adding variety can reduce injury risk.`
      : ''
  return `${acwrSentence}${monotonySentence}`
}
