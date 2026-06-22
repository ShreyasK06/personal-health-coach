import { describe, it, expect } from 'vitest'
import { computeRecovery } from './recovery'
import type { Baseline, NightSample } from './types'

const hrvBaseline: Baseline = { mean: 60, sd: 10, n: 30 }
const rhrBaseline: Baseline = { mean: 55, sd: 4, n: 30 }
const respBaseline: Baseline = { mean: 14, sd: 1, n: 30 }

describe('computeRecovery', () => {
  it('high HRV, low RHR, good sleep -> green, high score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 80, restingHr: 50, respiratoryRate: 14 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.95 })
    expect(r.score).toBeGreaterThan(66)
    expect(r.band).toBe('green')
  })

  it('low HRV, high RHR, poor sleep -> red, low score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 40, restingHr: 63, respiratoryRate: 16 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.5 })
    expect(r.score).toBeLessThan(34)
    expect(r.band).toBe('red')
  })

  it('at baseline with average sleep -> mid score', () => {
    const today: NightSample = { date: '2026-06-21', hrvMs: 60, restingHr: 55, respiratoryRate: 14 }
    const r = computeRecovery({ today, hrvBaseline, rhrBaseline, respBaseline, sleepPerformance: 0.85 })
    expect(r.score).toBeGreaterThanOrEqual(34)
    expect(r.score).toBeLessThanOrEqual(80)
  })
})
