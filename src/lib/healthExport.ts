import { parseCsv } from './csv'
import { rollingBaseline } from '../metrics/baseline'
import { computeSleep } from '../metrics/sleep'
import { computeRecovery } from '../metrics/recovery'
import { hrMax, computeStrain } from '../metrics/strain'
import { computeLoad } from '../metrics/load'
import type {
  NightSample,
  SleepInput,
  WorkoutInput,
  Profile,
  RecoveryResult,
  SleepResult,
  StrainResult,
  LoadResult,
} from '../metrics/types'

export const DEFAULT_PROFILE: Profile = {
  birthYear: 2000,
  sex: 'male',
  sleepNeedBaseHours: 8,
}

export interface DailyResult {
  date: string
  recovery: RecoveryResult | null
  sleep: SleepResult | null
  strain: StrainResult
  load: LoadResult
}

/** First 10 chars of a date-time string, e.g. "2026-06-20 07:00:00 +0000" -> "2026-06-20". */
function dateOnly(dateTime: string): string {
  return dateTime.slice(0, 10)
}

/** Parses a number cell; returns null for empty/missing/non-numeric values. */
function toNumberOrNull(cell: string | undefined): number | null {
  if (cell == null || cell.trim() === '') return null
  const n = Number(cell)
  return Number.isFinite(n) ? n : null
}

/** Parses an hours cell to minutes; missing/empty cells become 0 minutes. */
function hoursToMinutes(cell: string | undefined): number {
  if (cell == null || cell.trim() === '') return 0
  const n = Number(cell)
  return Number.isFinite(n) ? n * 60 : 0
}

export function parseDailyCsv(text: string): { nights: NightSample[]; sleeps: SleepInput[] } {
  const rows = parseCsv(text)
  const nights: NightSample[] = []
  const sleeps: SleepInput[] = []

  for (const row of rows) {
    const dateTime = row['Date/Time']
    if (!dateTime) continue
    const date = dateOnly(dateTime)

    nights.push({
      date,
      hrvMs: toNumberOrNull(row['Heart Rate Variability (ms)']),
      restingHr: toNumberOrNull(row['Resting Heart Rate (bpm)']),
      respiratoryRate: toNumberOrNull(row['Respiratory Rate (count/min)']),
    })

    sleeps.push({
      date,
      asleepMinutes: hoursToMinutes(row['Sleep Analysis [Asleep] (hr)']),
      inBedMinutes: hoursToMinutes(row['Sleep Analysis [In Bed] (hr)']),
      deepMinutes: hoursToMinutes(row['Sleep Analysis [Deep] (hr)']),
      remMinutes: hoursToMinutes(row['Sleep Analysis [REM] (hr)']),
      coreMinutes: hoursToMinutes(row['Sleep Analysis [Core] (hr)']),
      awakeMinutes: hoursToMinutes(row['Sleep Analysis [Awake] (hr)']),
      bedTime: '',
      wakeTime: '',
    })
  }

  return { nights, sleeps }
}

/** Parses "Duration" as either HH:MM:SS or a plain number of minutes. */
function parseDurationMinutes(cell: string | undefined): number {
  if (cell == null || cell.trim() === '') return 0
  const trimmed = cell.trim()
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => Number(p))
    if (parts.some((p) => !Number.isFinite(p))) return 0
    if (parts.length === 3) {
      const [h, m, s] = parts
      return h * 60 + m + s / 60
    }
    if (parts.length === 2) {
      const [m, s] = parts
      return m + s / 60
    }
    return 0
  }
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : 0
}

export function parseWorkoutsCsv(text: string): Map<string, WorkoutInput[]> {
  const rows = parseCsv(text)
  const byDate = new Map<string, WorkoutInput[]>()

  for (const row of rows) {
    const start = row['Start']
    if (!start) continue
    const date = dateOnly(start)

    const workout: WorkoutInput = {
      start,
      end: row['End'] ?? '',
      type: row['Workout Type'] ?? '',
      avgHr: toNumberOrNull(row['Avg. Heart Rate (bpm)']),
      maxHr: toNumberOrNull(row['Max. Heart Rate (bpm)']),
      durationMin: parseDurationMinutes(row['Duration']),
    }

    const existing = byDate.get(date)
    if (existing) existing.push(workout)
    else byDate.set(date, [workout])
  }

  return byDate
}

export function computeDailyResults(
  nights: NightSample[],
  sleeps: SleepInput[],
  workoutsByDate: Map<string, WorkoutInput[]>,
  profile: Profile,
  currentYear: number,
): DailyResult[] {
  const sortedDates = Array.from(
    new Set([...nights.map((n) => n.date), ...sleeps.map((s) => s.date)]),
  ).sort()

  const nightsByDate = new Map(nights.map((n) => [n.date, n]))
  const sleepsByDate = new Map(sleeps.map((s) => [s.date, s]))

  const computedHrMax = hrMax(profile, currentYear)

  // Running history of prior days' values, in date order, for baselines.
  const hrvHistory: number[] = []
  const rhrHistory: number[] = []
  const respHistory: number[] = []

  // Running daily loads (date + dayTrimp) accumulated as we go, for computeLoad.
  const dailyLoads: { date: string; load: number }[] = []

  let prevStrain = 0
  const results: DailyResult[] = []

  for (const date of sortedDates) {
    const night = nightsByDate.get(date) ?? null
    const sleepInput = sleepsByDate.get(date) ?? null

    // --- sleep ---
    let sleep: SleepResult | null = null
    if (sleepInput) {
      sleep = computeSleep(sleepInput, {
        profile,
        sleepDebtHours: 0,
        yesterdayStrain: prevStrain,
        recentBedMinutesOfDay: [],
        recentWakeMinutesOfDay: [],
      })
    }

    // --- strain ---
    const workouts = workoutsByDate.get(date) ?? []
    const hrRest = night?.restingHr ?? profile.hrRest ?? 55
    const strain = computeStrain(workouts, { hrRest, hrMax: computedHrMax, sex: profile.sex })

    // --- recovery ---
    let recovery: RecoveryResult | null = null
    if (night) {
      const hrvBaseline =
        night.hrvMs != null
          ? hrvHistory.length > 0
            ? rollingBaseline(hrvHistory, 30)
            : { mean: night.hrvMs, sd: 1e-6, n: 1 }
          : { mean: 0, sd: 1e-6, n: 0 }
      const rhrBaseline =
        night.restingHr != null
          ? rhrHistory.length > 0
            ? rollingBaseline(rhrHistory, 30)
            : { mean: night.restingHr, sd: 1e-6, n: 1 }
          : { mean: 0, sd: 1e-6, n: 0 }
      const respBaseline =
        night.respiratoryRate != null
          ? respHistory.length > 0
            ? rollingBaseline(respHistory, 30)
            : { mean: night.respiratoryRate, sd: 1e-6, n: 1 }
          : { mean: 0, sd: 1e-6, n: 0 }

      recovery = computeRecovery({
        today: night,
        hrvBaseline,
        rhrBaseline,
        respBaseline,
        sleepPerformance: sleep?.performance ?? 0.85,
      })
    }

    // --- load ---
    dailyLoads.push({ date, load: strain.dayTrimp })
    const load = computeLoad(dailyLoads, date)

    results.push({ date, recovery, sleep, strain, load })

    // Update history AFTER computing today's results, so baselines only see prior days.
    if (night?.hrvMs != null) hrvHistory.push(night.hrvMs)
    if (night?.restingHr != null) rhrHistory.push(night.restingHr)
    if (night?.respiratoryRate != null) respHistory.push(night.respiratoryRate)
    prevStrain = strain.strain
  }

  return results
}
