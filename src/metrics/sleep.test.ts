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
