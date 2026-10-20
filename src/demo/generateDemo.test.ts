import { describe, it, expect } from 'vitest'
import { generateDemoPayloads } from './generateDemo'
import { buildDayViews } from '../lib/firebase'
import { LOAD_BANDS } from '../metrics/load'

const NOW = new Date(2026, 5, 20, 12, 0, 0)

describe('generateDemoPayloads', () => {
  it('is deterministic for a given (days, seed, now)', () => {
    expect(generateDemoPayloads(45, 7, NOW)).toEqual(generateDemoPayloads(45, 7, NOW))
  })

  it('differs across seeds', () => {
    expect(generateDemoPayloads(45, 7, NOW)).not.toEqual(generateDemoPayloads(45, 8, NOW))
  })

  it('flows through buildDayViews as 45 days ending today', () => {
    const days = buildDayViews(generateDemoPayloads(45, 7, NOW))
    expect(days).toHaveLength(45)
    expect(days[days.length - 1].date).toBe('2026-06-20')
    const withRecovery = days.filter((d) => d.recovery != null)
    expect(withRecovery.length).toBeGreaterThan(0)
    for (const d of withRecovery) expect(['red', 'amber', 'green']).toContain(d.recovery!.band)
    expect(days.some((d) => d.activity.steps != null && d.asleepMinutes != null)).toBe(true)
  })

  it('contains no real names or database URLs', () => {
    const json = JSON.stringify(generateDemoPayloads(45, 7, NOW))
    expect(json).not.toContain('Shreyas')
    expect(json).not.toContain('firebaseio')
  })

  it('has recovery on the last day and on a majority of days', () => {
    const days = buildDayViews(generateDemoPayloads(45, 7, NOW))
    const last = days[days.length - 1]
    expect(last.recovery).not.toBeNull()
    expect(['red', 'amber', 'green']).toContain(last.recovery!.band)
    expect(days.filter((d) => d.recovery != null).length).toBeGreaterThan(days.length / 2)
  })

  it('ends in a hard-load week with ACWR outside the optimal band', () => {
    const days = buildDayViews(generateDemoPayloads(45, 7, NOW))
    const last = days[days.length - 1]
    expect(last.load.acwr).toBeGreaterThanOrEqual(LOAD_BANDS.optimalBelow)
    expect(last.load.band).not.toBe('optimal')
  })

  it('includes strength, Tennis and Other workouts', () => {
    const payloads = generateDemoPayloads(45, 7, NOW) as { data: { workouts: { name: string }[] } }[]
    const names = new Set(payloads.flatMap((p) => p.data.workouts.map((w) => w.name)))
    expect(names).toContain('Traditional Strength Training')
    expect(names).toContain('Tennis')
    expect(names).toContain('Other')
  })

  it('handles days=0 without throwing', () => {
    expect(buildDayViews(generateDemoPayloads(0, 7, NOW))).toEqual([])
  })
})
