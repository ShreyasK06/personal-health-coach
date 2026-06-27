import { describe, it, expect } from 'vitest'
import {
  recoveryDrivers,
  readiness,
  sleepArchitecture,
  sleepDebtHours,
  guidanceFor,
  hrvTrend,
  weeklyLoad,
  metricDelta,
  calibration,
  intensityTarget,
} from './detail'
import type { DayView } from './firebase'

// Builds a minimal synthetic DayView. Callers override only the fields they
// care about for a given test.
function makeDay(overrides: Partial<DayView> & { date: string }): DayView {
  return {
    date: overrides.date,
    recovery:
      'recovery' in overrides ? overrides.recovery! : { score: 70, band: 'green', zHrv: 0, zRhr: 0, respPenalty: 0 },
    sleep:
      overrides.sleep ??
      ({ score: 80, needHours: 8, performance: 0.9, efficiency: 0.9, consistency: 0.9, restorative: 0.9 } as DayView['sleep']),
    strain: overrides.strain ?? { sessions: [], dayTrimp: 0, strain: 0 },
    load: overrides.load ?? { acute: 100, chronic: 100, acwr: 1.0, monotony: 1.0, trainingStrain: 100, band: 'optimal' },
    hrvMs: 'hrvMs' in overrides ? overrides.hrvMs! : 60,
    restingHr: overrides.restingHr ?? 55,
    respiratoryRate: overrides.respiratoryRate ?? 14,
    asleepMinutes: overrides.asleepMinutes ?? 420,
    inBedMinutes: overrides.inBedMinutes ?? 460,
    deepMinutes: overrides.deepMinutes ?? 80,
    remMinutes: overrides.remMinutes ?? 95,
    coreMinutes: overrides.coreMinutes ?? 230,
    awakeMinutes: overrides.awakeMinutes ?? 40,
    bedTime: overrides.bedTime ?? '2026-06-19T23:00:00-04:00',
    wakeTime: overrides.wakeTime ?? '2026-06-20T06:30:00-04:00',
    activity: overrides.activity ?? {
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
    },
  }
}

// A short run of "baseline" prior days, all with HRV=60, RHR=55, resp=14.
function priorDays(n: number, date0 = '2026-06-01'): DayView[] {
  const start = new Date(`${date0}T00:00:00Z`).getTime()
  const days: DayView[] = []
  for (let k = 0; k < n; k++) {
    const d = new Date(start + k * 86_400_000).toISOString().slice(0, 10)
    days.push(makeDay({ date: d, hrvMs: 60, restingHr: 55, respiratoryRate: 14 }))
  }
  return days
}

describe('recoveryDrivers', () => {
  it('returns 4 drivers with positive HRV z-score when HRV is above the prior baseline', () => {
    const days = [...priorDays(10), makeDay({ date: '2026-06-11', hrvMs: 90, restingHr: 55, respiratoryRate: 14 })]
    const drivers = recoveryDrivers(days, days.length - 1)
    expect(drivers).toHaveLength(4)
    const hrv = drivers.find((d) => d.key === 'hrv')!
    expect(hrv.z).toBeGreaterThan(0)
    expect(hrv.direction).toBe('up')
    expect(hrv.contribution).toBeGreaterThan(0)
  })

  it('returns negative HRV z-score when HRV is below the prior baseline', () => {
    const days = [...priorDays(10), makeDay({ date: '2026-06-11', hrvMs: 30, restingHr: 55, respiratoryRate: 14 })]
    const drivers = recoveryDrivers(days, days.length - 1)
    const hrv = drivers.find((d) => d.key === 'hrv')!
    expect(hrv.z).toBeLessThan(0)
    expect(hrv.direction).toBe('down')
    expect(hrv.contribution).toBeLessThan(0)
  })

  it('all driver keys are present exactly once', () => {
    const days = [...priorDays(5), makeDay({ date: '2026-06-06' })]
    const drivers = recoveryDrivers(days, days.length - 1)
    const keys = drivers.map((d) => d.key).sort()
    expect(keys).toEqual(['hrv', 'respiratory', 'rhr', 'sleep'])
  })
})

describe('readiness', () => {
  it('returns Strained or Run down when ACWR is above 1.5', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 70, band: 'amber', zHrv: 0, zRhr: 0, respPenalty: 0 },
        load: { acute: 200, chronic: 100, acwr: 1.8, monotony: 1.0, trainingStrain: 200, band: 'high-risk' },
      }),
    ]
    const r = readiness(days, 0)
    expect(['Strained', 'Run down']).toContain(r.headline)
  })

  it('returns Run down when recovery is red and ACWR is high-risk', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 20, band: 'red', zHrv: -1, zRhr: 1, respPenalty: 0 },
        load: { acute: 200, chronic: 100, acwr: 1.8, monotony: 1.0, trainingStrain: 200, band: 'high-risk' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).toBe('Run down')
    expect(r.tone).toBe('critical')
  })

  it('returns Primed for a green-recovery day with ACWR near 1.0', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 85, band: 'green', zHrv: 1, zRhr: -1, respPenalty: 0 },
        load: { acute: 100, chronic: 100, acwr: 1.0, monotony: 1.0, trainingStrain: 100, band: 'optimal' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).toBe('Primed')
    expect(r.tone).toBe('positive')
    expect(r.signals).toHaveLength(4)
  })

  it('caps headline at Strained for a green-recovery day with ACWR 1.8 (not Primed)', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 90, band: 'green', zHrv: 1.5, zRhr: -1.5, respPenalty: 0 },
        load: { acute: 180, chronic: 100, acwr: 1.8, monotony: 1.0, trainingStrain: 180, band: 'high-risk' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).not.toBe('Primed')
    expect(r.headline).toBe('Strained')
  })

  it('caps headline at Balanced for a green-recovery, non-red day with high monotony', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 90, band: 'green', zHrv: 1.5, zRhr: -1.5, respPenalty: 0 },
        load: { acute: 100, chronic: 100, acwr: 1.0, monotony: 2.5, trainingStrain: 250, band: 'optimal' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).not.toBe('Primed')
    expect(r.headline).toBe('Balanced')
  })

  it('still returns Primed for a green-recovery day with ACWR ok and monotony low', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: { score: 90, band: 'green', zHrv: 1.5, zRhr: -1.5, respPenalty: 0 },
        load: { acute: 100, chronic: 100, acwr: 1.0, monotony: 1.2, trainingStrain: 100, band: 'optimal' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).toBe('Primed')
  })

  it('falls back to load-only signals when recovery is null', () => {
    const days = [
      makeDay({
        date: '2026-06-11',
        recovery: null,
        load: { acute: 100, chronic: 100, acwr: 1.0, monotony: 1.0, trainingStrain: 100, band: 'optimal' },
      }),
    ]
    const r = readiness(days, 0)
    expect(r.headline).toBe('Balanced')
    expect(r.signals).toHaveLength(4)
  })
})

describe('sleepArchitecture', () => {
  it('computes stage percentages that sum close to 100% of asleep time for non-Awake stages', () => {
    const day = makeDay({
      date: '2026-06-11',
      asleepMinutes: 400,
      deepMinutes: 80, // 20%
      coreMinutes: 200, // 50%
      remMinutes: 100, // 25%
      awakeMinutes: 20,
      inBedMinutes: 420,
    })
    const { parts, restorativePct, asleepMinutes } = sleepArchitecture(day)
    expect(asleepMinutes).toBe(400)
    const deep = parts.find((p) => p.stage === 'Deep')!
    const core = parts.find((p) => p.stage === 'Core')!
    const rem = parts.find((p) => p.stage === 'REM')!
    const awake = parts.find((p) => p.stage === 'Awake')!

    expect(deep.pct).toBeCloseTo(20, 5)
    expect(core.pct).toBeCloseTo(50, 5)
    expect(rem.pct).toBeCloseTo(25, 5)
    expect(deep.pct + core.pct + rem.pct).toBeCloseTo(95, 5)

    expect(deep.inRange).toBe(true) // 13-23
    expect(core.inRange).toBe(true) // 45-55
    expect(rem.inRange).toBe(true) // 20-25
    expect(awake.inRange).toBe(true) // awake% of in-bed time, 20/420 ~4.8%, within 0-10

    expect(restorativePct).toBeCloseTo(((80 + 100) / 400) * 100, 5)
  })

  it('guards against divide-by-zero when asleepMinutes is 0', () => {
    const day = makeDay({ date: '2026-06-11', asleepMinutes: 0, deepMinutes: 0, coreMinutes: 0, remMinutes: 0, awakeMinutes: 0, inBedMinutes: 0 })
    const { parts, restorativePct, asleepMinutes } = sleepArchitecture(day)
    expect(asleepMinutes).toBe(0)
    expect(restorativePct).toBe(0)
    for (const p of parts) {
      expect(Number.isFinite(p.pct)).toBe(true)
    }
  })

  it('flags out-of-range stages', () => {
    const day = makeDay({
      date: '2026-06-11',
      asleepMinutes: 400,
      deepMinutes: 20, // 5%, below healthy 13-23
      coreMinutes: 300, // 75%, above healthy 45-55
      remMinutes: 80, // 20%, in range
      awakeMinutes: 40,
      inBedMinutes: 440,
    })
    const { parts } = sleepArchitecture(day)
    const deep = parts.find((p) => p.stage === 'Deep')!
    const core = parts.find((p) => p.stage === 'Core')!
    expect(deep.inRange).toBe(false)
    expect(core.inRange).toBe(false)
  })
})

describe('sleepDebtHours', () => {
  it('accumulates debt from a run of short nights', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(
        makeDay({
          date: `2026-06-0${k + 1}`,
          asleepMinutes: 5 * 60, // 5h asleep
          sleep: { score: 50, needHours: 8, performance: 0.6, efficiency: 0.9, consistency: 0.9, restorative: 0.5 },
        }),
      )
    }
    const debt = sleepDebtHours(days, days.length - 1, 7)
    // 3 hours short per night * 7 nights = 21, capped at 10.
    expect(debt).toBe(10)
  })

  it('returns near zero when sleep consistently meets need', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(
        makeDay({
          date: `2026-06-0${k + 1}`,
          asleepMinutes: 8 * 60,
          sleep: { score: 90, needHours: 8, performance: 1, efficiency: 0.9, consistency: 0.9, restorative: 0.5 },
        }),
      )
    }
    const debt = sleepDebtHours(days, days.length - 1, 7)
    expect(debt).toBeCloseTo(0, 5)
  })
})

describe('guidanceFor', () => {
  const days = [...priorDays(5), makeDay({ date: '2026-06-06' })]
  const i = days.length - 1

  it('returns a non-empty string for recovery', () => {
    expect(guidanceFor('recovery', days, i).length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for sleep', () => {
    expect(guidanceFor('sleep', days, i).length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for strain', () => {
    expect(guidanceFor('strain', days, i).length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for load', () => {
    expect(guidanceFor('load', days, i).length).toBeGreaterThan(0)
  })
})

describe('hrvTrend', () => {
  it('detects a rising trend on a steadily increasing HRV series', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-0${k + 1}`, hrvMs: 50 + k * 5 })) // 50..80
    }
    const trend = hrvTrend(days, days.length - 1, 7)
    expect(trend.direction).toBe('rising')
    expect(trend.slopePerDay).toBeGreaterThan(0)
    expect(trend.changePct).toBeGreaterThan(0)
  })

  it('detects a falling trend on a steadily decreasing HRV series', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-0${k + 1}`, hrvMs: 80 - k * 5 })) // 80..50
    }
    const trend = hrvTrend(days, days.length - 1, 7)
    expect(trend.direction).toBe('falling')
    expect(trend.slopePerDay).toBeLessThan(0)
    expect(trend.changePct).toBeLessThan(0)
  })

  it('returns steady for a flat HRV series', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-0${k + 1}`, hrvMs: 60 }))
    }
    const trend = hrvTrend(days, days.length - 1, 7)
    expect(trend.direction).toBe('steady')
  })

  it('skips null days and still computes a trend, and handles <2 readings', () => {
    const days: DayView[] = [
      makeDay({ date: '2026-06-01', hrvMs: null }),
      makeDay({ date: '2026-06-02', hrvMs: 50 }),
    ]
    const trend = hrvTrend(days, 1, 7)
    // Only one non-null reading: not enough to compute a slope.
    expect(trend.direction).toBe('steady')
    expect(trend.slopePerDay).toBe(0)
  })
})

describe('weeklyLoad', () => {
  it('reports up when this week carries more strain than last week', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-0${k + 1}`, strain: { sessions: [], dayTrimp: 50, strain: 5 } }))
    }
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-${k + 8}`, strain: { sessions: [], dayTrimp: 150, strain: 10 } }))
    }
    const result = weeklyLoad(days, days.length - 1)
    expect(result.lastWeek).toBeCloseTo(350, 5)
    expect(result.thisWeek).toBeCloseTo(1050, 5)
    expect(result.direction).toBe('up')
    expect(result.changePct).toBeGreaterThan(0)
  })

  it('reports down when this week carries less strain than last week', () => {
    const days: DayView[] = []
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-0${k + 1}`, strain: { sessions: [], dayTrimp: 150, strain: 10 } }))
    }
    for (let k = 0; k < 7; k++) {
      days.push(makeDay({ date: `2026-06-${k + 8}`, strain: { sessions: [], dayTrimp: 50, strain: 5 } }))
    }
    const result = weeklyLoad(days, days.length - 1)
    expect(result.direction).toBe('down')
    expect(result.changePct).toBeLessThan(0)
  })

  it('reports flat when load is unchanged week over week', () => {
    const days: DayView[] = []
    for (let k = 0; k < 14; k++) {
      days.push(makeDay({ date: `2026-06-${(k + 1).toString().padStart(2, '0')}`, strain: { sessions: [], dayTrimp: 100, strain: 8 } }))
    }
    const result = weeklyLoad(days, days.length - 1)
    expect(result.direction).toBe('flat')
  })
})

describe('metricDelta', () => {
  it('computes a delta against the most recent prior non-null day', () => {
    const days = [
      makeDay({ date: '2026-06-01', hrvMs: 50 }),
      makeDay({ date: '2026-06-02', hrvMs: null }),
      makeDay({ date: '2026-06-03', hrvMs: 60 }),
    ]
    const delta = metricDelta(days, 2, (d) => d.hrvMs)
    expect(delta).not.toBeNull()
    expect(delta!.abs).toBeCloseTo(10, 5)
    expect(delta!.pct).toBeCloseTo(20, 5)
    expect(delta!.direction).toBe('up')
  })

  it('returns null when today is null', () => {
    const days = [makeDay({ date: '2026-06-01', hrvMs: 50 }), makeDay({ date: '2026-06-02', hrvMs: null })]
    expect(metricDelta(days, 1, (d) => d.hrvMs)).toBeNull()
  })

  it('returns null when there is no prior non-null value', () => {
    const days = [makeDay({ date: '2026-06-01', hrvMs: null }), makeDay({ date: '2026-06-02', hrvMs: 50 })]
    expect(metricDelta(days, 1, (d) => d.hrvMs)).toBeNull()
  })

  it('returns null for the first day (no prior day at all)', () => {
    const days = [makeDay({ date: '2026-06-01', hrvMs: 50 })]
    expect(metricDelta(days, 0, (d) => d.hrvMs)).toBeNull()
  })
})

describe('calibration', () => {
  it('returns building for fewer than 7 days of data', () => {
    const days = priorDays(5)
    const c = calibration(days, days.length - 1)
    expect(c.level).toBe('building')
    expect(c.daysOfData).toBe(5)
  })

  it('returns calibrating between 7 and 20 days of data', () => {
    const days = priorDays(15)
    const c = calibration(days, days.length - 1)
    expect(c.level).toBe('calibrating')
    expect(c.daysOfData).toBe(15)
    expect(c.label).toContain('15')
  })

  it('returns dialed at 21+ days of data', () => {
    const days = priorDays(25)
    const c = calibration(days, days.length - 1)
    expect(c.level).toBe('dialed')
    expect(c.daysOfData).toBe(25)
  })
})

describe('intensityTarget', () => {
  it('suggests a hard zone for green recovery', () => {
    const day = makeDay({ date: '2026-06-11', recovery: { score: 90, band: 'green', zHrv: 1, zRhr: -1, respPenalty: 0 } })
    expect(intensityTarget(day)?.note).toContain('push hard')
  })

  it('suggests a moderate zone for amber recovery', () => {
    const day = makeDay({ date: '2026-06-11', recovery: { score: 60, band: 'amber', zHrv: 0, zRhr: 0, respPenalty: 0 } })
    expect(intensityTarget(day)?.note).toContain('train to feel')
  })

  it('suggests an easy zone for red recovery', () => {
    const day = makeDay({ date: '2026-06-11', recovery: { score: 20, band: 'red', zHrv: -1, zRhr: 1, respPenalty: 0 } })
    expect(intensityTarget(day)?.note).toContain('keep it easy')
  })

  it('returns null when there is no recovery reading', () => {
    const day = makeDay({ date: '2026-06-11', recovery: null })
    expect(intensityTarget(day)).toBeNull()
  })
})
