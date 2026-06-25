// Parser for Health Auto Export's REST/Firebase JSON payloads.
// Each payload is one export POST body: { data: { metrics: [...], workouts?: [...] } }.
// This file maps that wire format into the same NightSample/SleepInput/WorkoutInput
// shapes the CSV parser in healthExport.ts produces, so the existing scoring engines
// can be reused unchanged.
import type { NightSample, SleepInput, WorkoutInput } from '../metrics/types'
import type { ActivityDay } from './firebase'

interface MetricPoint {
  date: string
  qty?: number
  Min?: number
  Max?: number
  Avg?: number
  // sleep_analysis fields
  totalSleep?: number
  core?: number
  deep?: number
  rem?: number
  awake?: number
  asleep?: number
  inBed?: number
  inBedStart?: string
  inBedEnd?: string
  sleepStart?: string
  sleepEnd?: string
  source?: string
  [key: string]: unknown
}

interface Metric {
  name: string
  units?: string
  data?: MetricPoint[]
  [key: string]: unknown
}

interface RawWorkout {
  name?: string
  workoutActivityType?: string
  start?: string
  end?: string
  duration?: number | { qty?: number }
  avgHeartRate?: number | { qty?: number }
  maxHeartRate?: number | { qty?: number }
  [key: string]: unknown
}

interface HaePayload {
  data?: {
    metrics?: Metric[]
    workouts?: RawWorkout[]
  }
  metrics?: Metric[]
  workouts?: RawWorkout[]
  [key: string]: unknown
}

/** First 10 chars of a date-time string, e.g. "2026-06-20 07:00:00 -0400" -> "2026-06-20". */
function dayOf(point: { date?: unknown }): string {
  return String(point?.date ?? '').slice(0, 10)
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Extracts a numeric value that may be a plain number, an object with .qty, or missing. */
function readNumericField(value: unknown): number | null {
  if (isFiniteNumber(value)) return value
  if (value != null && typeof value === 'object' && 'qty' in (value as Record<string, unknown>)) {
    const qty = (value as Record<string, unknown>).qty
    if (isFiniteNumber(qty)) return qty
  }
  return null
}

/** Minutes between two date-time strings; null if either is missing/unparseable. */
function minutesBetween(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  return (endMs - startMs) / 60000
}

function getMetrics(payload: HaePayload): Metric[] {
  return payload?.data?.metrics ?? payload?.metrics ?? []
}

function getWorkouts(payload: HaePayload): RawWorkout[] {
  return payload?.data?.workouts ?? payload?.workouts ?? []
}

/** Sums qty across a day's points; null if no points are present. */
function sumQty(points: MetricPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null
  const values = points.filter((p) => isFiniteNumber(p.qty)).map((p) => p.qty as number)
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0)
}

/** Aggregates Apple activity metrics (steps, calories, exercise, stand, distance,
 * flights, heart rate, etc.) per day, keyed by YYYY-MM-DD. */
export function parseActivity(payloads: unknown[]): Map<string, ActivityDay> {
  const stepsByDate = new Map<string, MetricPoint[]>()
  const activeEnergyByDate = new Map<string, MetricPoint[]>()
  const basalEnergyByDate = new Map<string, MetricPoint[]>()
  const exerciseByDate = new Map<string, MetricPoint[]>()
  const standHoursByDate = new Map<string, MetricPoint[]>()
  const standMinutesByDate = new Map<string, MetricPoint[]>()
  const flightsByDate = new Map<string, MetricPoint[]>()
  const distanceByDate = new Map<string, MetricPoint[]>()
  let distanceUnits: string | undefined
  const physicalEffortByDate = new Map<string, number[]>()
  const avgHrByDate = new Map<string, number[]>()
  const maxHrByDate = new Map<string, number[]>()
  const noiseByDate = new Map<string, number[]>()

  function pushPoint(map: Map<string, MetricPoint[]>, date: string, point: MetricPoint) {
    const arr = map.get(date) ?? []
    arr.push(point)
    map.set(date, arr)
  }

  for (const raw of payloads) {
    const payload = (raw ?? {}) as HaePayload
    const metrics = getMetrics(payload)

    for (const metric of metrics) {
      const points = metric?.data ?? []
      if (metric?.name === 'step_count') {
        for (const point of points) pushPoint(stepsByDate, dayOf(point), point)
      } else if (metric?.name === 'active_energy') {
        for (const point of points) pushPoint(activeEnergyByDate, dayOf(point), point)
      } else if (metric?.name === 'basal_energy_burned') {
        for (const point of points) pushPoint(basalEnergyByDate, dayOf(point), point)
      } else if (metric?.name === 'apple_exercise_time') {
        for (const point of points) pushPoint(exerciseByDate, dayOf(point), point)
      } else if (metric?.name === 'apple_stand_hour') {
        for (const point of points) pushPoint(standHoursByDate, dayOf(point), point)
      } else if (metric?.name === 'apple_stand_time') {
        for (const point of points) pushPoint(standMinutesByDate, dayOf(point), point)
      } else if (metric?.name === 'flights_climbed') {
        for (const point of points) pushPoint(flightsByDate, dayOf(point), point)
      } else if (metric?.name === 'walking_running_distance') {
        if (metric?.units) distanceUnits = metric.units
        for (const point of points) pushPoint(distanceByDate, dayOf(point), point)
      } else if (metric?.name === 'physical_effort') {
        for (const point of points) {
          if (!isFiniteNumber(point.qty)) continue
          const date = dayOf(point)
          const arr = physicalEffortByDate.get(date) ?? []
          arr.push(point.qty)
          physicalEffortByDate.set(date, arr)
        }
      } else if (metric?.name === 'heart_rate') {
        for (const point of points) {
          const date = dayOf(point)
          if (isFiniteNumber(point.Avg)) {
            const arr = avgHrByDate.get(date) ?? []
            arr.push(point.Avg)
            avgHrByDate.set(date, arr)
          }
          if (isFiniteNumber(point.Max)) {
            const arr = maxHrByDate.get(date) ?? []
            arr.push(point.Max)
            maxHrByDate.set(date, arr)
          }
        }
      } else if (metric?.name === 'environmental_audio_exposure') {
        for (const point of points) {
          if (!isFiniteNumber(point.qty)) continue
          const date = dayOf(point)
          const arr = noiseByDate.get(date) ?? []
          arr.push(point.qty)
          noiseByDate.set(date, arr)
        }
      }
    }
  }

  const distanceMultiplier = distanceUnits?.toLowerCase().includes('mi')
    ? 1.60934
    : 1

  const allDates = new Set<string>([
    ...stepsByDate.keys(),
    ...activeEnergyByDate.keys(),
    ...basalEnergyByDate.keys(),
    ...exerciseByDate.keys(),
    ...standHoursByDate.keys(),
    ...standMinutesByDate.keys(),
    ...flightsByDate.keys(),
    ...distanceByDate.keys(),
    ...physicalEffortByDate.keys(),
    ...avgHrByDate.keys(),
    ...maxHrByDate.keys(),
    ...noiseByDate.keys(),
  ])

  const activityByDate = new Map<string, ActivityDay>()
  for (const date of allDates) {
    const activeEnergy = sumQty(activeEnergyByDate.get(date))
    const basalEnergy = sumQty(basalEnergyByDate.get(date))
    const totalEnergy =
      activeEnergy == null && basalEnergy == null
        ? null
        : (activeEnergy ?? 0) + (basalEnergy ?? 0)
    const rawDistance = sumQty(distanceByDate.get(date))

    activityByDate.set(date, {
      steps: sumQty(stepsByDate.get(date)),
      activeEnergy,
      basalEnergy,
      totalEnergy,
      exerciseMinutes: sumQty(exerciseByDate.get(date)),
      standHours: sumQty(standHoursByDate.get(date)),
      standMinutes: sumQty(standMinutesByDate.get(date)),
      flights: sumQty(flightsByDate.get(date)),
      distanceKm: rawDistance == null ? null : rawDistance * distanceMultiplier,
      physicalEffort: mean(physicalEffortByDate.get(date) ?? []),
      avgHr: mean(avgHrByDate.get(date) ?? []),
      maxHr: maxHrByDate.has(date) ? Math.max(...(maxHrByDate.get(date) ?? [])) : null,
      noiseDb: mean(noiseByDate.get(date) ?? []),
    })
  }

  return activityByDate
}

export function parseFirebaseExports(payloads: unknown[]): {
  nights: NightSample[]
  sleeps: SleepInput[]
  workoutsByDate: Map<string, WorkoutInput[]>
} {
  const hrvByDate = new Map<string, number[]>()
  const rhrByDate = new Map<string, number[]>()
  const respByDate = new Map<string, number[]>()
  const sleepPointsByDate = new Map<string, MetricPoint[]>()

  for (const raw of payloads) {
    const payload = (raw ?? {}) as HaePayload
    const metrics = getMetrics(payload)

    for (const metric of metrics) {
      const points = metric?.data ?? []
      if (metric?.name === 'heart_rate_variability') {
        for (const point of points) {
          if (!isFiniteNumber(point.qty)) continue
          const date = dayOf(point)
          const arr = hrvByDate.get(date) ?? []
          arr.push(point.qty)
          hrvByDate.set(date, arr)
        }
      } else if (metric?.name === 'resting_heart_rate') {
        for (const point of points) {
          if (!isFiniteNumber(point.qty)) continue
          const date = dayOf(point)
          const arr = rhrByDate.get(date) ?? []
          arr.push(point.qty)
          rhrByDate.set(date, arr)
        }
      } else if (metric?.name === 'respiratory_rate') {
        for (const point of points) {
          if (!isFiniteNumber(point.qty)) continue
          const date = dayOf(point)
          const arr = respByDate.get(date) ?? []
          arr.push(point.qty)
          respByDate.set(date, arr)
        }
      } else if (metric?.name === 'sleep_analysis') {
        for (const point of points) {
          const date = dayOf(point)
          const arr = sleepPointsByDate.get(date) ?? []
          arr.push(point)
          sleepPointsByDate.set(date, arr)
        }
      }
    }
  }

  const allDates = new Set<string>([
    ...hrvByDate.keys(),
    ...rhrByDate.keys(),
    ...respByDate.keys(),
    ...sleepPointsByDate.keys(),
  ])

  const nights: NightSample[] = Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      hrvMs: mean(hrvByDate.get(date) ?? []),
      restingHr: mean(rhrByDate.get(date) ?? []),
      respiratoryRate: mean(respByDate.get(date) ?? []),
    }))

  const sleeps: SleepInput[] = Array.from(sleepPointsByDate.keys())
    .sort()
    .map((date) => {
      const points = sleepPointsByDate.get(date) ?? []
      // If multiple sleep points fall on the same day, keep the one with the
      // largest totalSleep (the most complete/primary sleep session).
      let best = points[0]
      for (const point of points) {
        if ((point.totalSleep ?? 0) > (best.totalSleep ?? 0)) best = point
      }

      const totalSleepHours = best.totalSleep ?? 0
      const core = best.core ?? 0
      const deep = best.deep ?? 0
      const rem = best.rem ?? 0
      const awake = best.awake ?? 0
      const asleepHours = totalSleepHours > 0 ? totalSleepHours : core + deep + rem

      const asleepMinutes = asleepHours * 60
      const deepMinutes = deep * 60
      const remMinutes = rem * 60
      const coreMinutes = core * 60
      const awakeMinutes = awake * 60

      const inBedMinutes =
        (best.inBed ?? 0) > 0
          ? (best.inBed as number) * 60
          : minutesBetween(best.inBedStart, best.inBedEnd) ?? asleepMinutes + awakeMinutes

      const bedTime = best.inBedStart || best.sleepStart || ''
      const wakeTime = best.sleepEnd || best.inBedEnd || ''

      return {
        date,
        asleepMinutes,
        inBedMinutes,
        deepMinutes,
        remMinutes,
        coreMinutes,
        awakeMinutes,
        bedTime,
        wakeTime,
      }
    })

  const workoutsByDate = new Map<string, WorkoutInput[]>()
  for (const raw of payloads) {
    const payload = (raw ?? {}) as HaePayload
    const rawWorkouts = getWorkouts(payload)

    for (const w of rawWorkouts) {
      const start = w?.start || ''
      const end = w?.end || ''
      const type = w?.name || w?.workoutActivityType || 'Workout'

      let durationMin = 0
      const durationValue = readNumericField(w?.duration)
      if (durationValue != null) {
        durationMin = durationValue > 180 ? durationValue / 60 : durationValue
      }

      const avgHr = readNumericField(w?.avgHeartRate)
      const maxHr = readNumericField(w?.maxHeartRate)

      const workout: WorkoutInput = {
        start,
        end,
        type,
        avgHr,
        maxHr,
        durationMin,
      }

      const date = dayOf({ date: start })
      const existing = workoutsByDate.get(date)
      if (existing) existing.push(workout)
      else workoutsByDate.set(date, [workout])
    }
  }

  return { nights, sleeps, workoutsByDate }
}
