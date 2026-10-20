import { describe, it, expect } from 'vitest'
import { generateDemoPayloads } from './generateDemo'
import { buildDayViews } from '../lib/firebase'

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
})
