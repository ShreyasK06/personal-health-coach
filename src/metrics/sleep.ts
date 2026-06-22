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
