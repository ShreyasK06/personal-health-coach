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
