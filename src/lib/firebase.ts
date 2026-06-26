// Loads Health Auto Export payloads from the Firebase Realtime Database and
// turns them into per-day views the UI can render directly, reusing the
// existing scoring engines via computeDailyResults.
import { parseFirebaseExports, parseActivity } from './parseHaeJson'
import { computeDailyResults, DEFAULT_PROFILE } from './healthExport'
import type { DailyResult } from './healthExport'

export const FIREBASE_DB_URL = 'https://health-coach-76bf2-default-rtdb.firebaseio.com'

/** Identifies which "in-depth detail" sheet to open for a tapped metric. */
export type DetailKind =
  | 'recovery'
  | 'sleep'
  | 'strain'
  | 'load'
  | 'hrv'
  | 'rhr'
  | 'respiratory'
  | 'steps'
  | 'activeEnergy'
  | 'totalEnergy'
  | 'exerciseMinutes'
  | 'standHours'
  | 'distanceKm'
  | 'flights'

/** Per-day Apple activity metrics (steps, calories, exercise, stand, distance, etc.). */
export interface ActivityDay {
  steps: number | null
  activeEnergy: number | null // kcal
  basalEnergy: number | null // kcal
  totalEnergy: number | null // active + basal (null if both null)
  exerciseMinutes: number | null
  standHours: number | null
  standMinutes: number | null
  flights: number | null
  distanceKm: number | null
  physicalEffort: number | null
  avgHr: number | null
  maxHr: number | null
  noiseDb: number | null
}

export const ACTIVITY_GOALS = { moveKcal: 500, exerciseMin: 30, standHours: 12 } as const

const EMPTY_ACTIVITY_DAY: ActivityDay = {
  steps: null,
  activeEnergy: null,
  basalEnergy: null,
  totalEnergy: null,
  exerciseMinutes: null,
  standHours: null,
  standMinutes: null,
  flights: null,
  distanceKm: null,
  physicalEffort: null,
  avgHr: null,
  maxHr: null,
  noiseDb: null,
}

export interface DayView extends DailyResult {
  hrvMs: number | null
  restingHr: number | null
  respiratoryRate: number | null
  asleepMinutes: number | null
  inBedMinutes: number | null
  deepMinutes: number | null
  remMinutes: number | null
  coreMinutes: number | null
  awakeMinutes: number | null
  bedTime: string | null
  wakeTime: string | null
  activity: ActivityDay
}

/** Builds per-day views from raw Health Auto Export payloads, merging the
 * computed daily scores with that day's raw night/sleep fields. */
export function buildDayViews(payloads: unknown[]): DayView[] {
  const { nights, sleeps, workoutsByDate } = parseFirebaseExports(payloads)
  const activityByDate = parseActivity(payloads)

  const dailyResults = computeDailyResults(
    nights,
    sleeps,
    workoutsByDate,
    DEFAULT_PROFILE,
    new Date().getFullYear(),
  )

  const nightsByDate = new Map(nights.map((n) => [n.date, n]))
  const sleepsByDate = new Map(sleeps.map((s) => [s.date, s]))

  const dayViews: DayView[] = dailyResults.map((result) => {
    const night = nightsByDate.get(result.date) ?? null
    const sleep = sleepsByDate.get(result.date) ?? null

    return {
      ...result,
      hrvMs: night?.hrvMs ?? null,
      restingHr: night?.restingHr ?? null,
      respiratoryRate: night?.respiratoryRate ?? null,
      asleepMinutes: sleep?.asleepMinutes ?? null,
      inBedMinutes: sleep?.inBedMinutes ?? null,
      deepMinutes: sleep?.deepMinutes ?? null,
      remMinutes: sleep?.remMinutes ?? null,
      coreMinutes: sleep?.coreMinutes ?? null,
      awakeMinutes: sleep?.awakeMinutes ?? null,
      bedTime: sleep?.bedTime ?? null,
      wakeTime: sleep?.wakeTime ?? null,
      activity: activityByDate.get(result.date) ?? EMPTY_ACTIVITY_DAY,
    }
  })

  return dayViews.sort((a, b) => a.date.localeCompare(b.date))
}

/** Fetches all Health Auto Export payloads from the Realtime Database and
 * returns them as sorted per-day views. */
export async function loadHealthData(): Promise<DayView[]> {
  const res = await fetch(`${FIREBASE_DB_URL}/health_raw.json`)
  if (!res.ok) throw new Error(`Failed to load health data: ${res.status} ${res.statusText}`)
  const obj = await res.json()
  return buildDayViews(obj ? Object.values(obj) : [])
}
