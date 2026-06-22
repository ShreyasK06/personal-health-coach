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
