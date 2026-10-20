import { describe, it, expect } from 'vitest'
import { classifySport, sportBreakdown, loadGuard } from './sport'
import type { WorkoutInput, LoadResult } from './types'
import type { DayView } from '../lib/firebase'

function workout(over: Partial<WorkoutInput> = {}): WorkoutInput {
  return {
    start: '2026-06-20T07:00:00',
    end: '2026-06-20T08:00:00',
    type: 'Other',
    avgHr: 140,
    maxHr: 170,
    durationMin: 60,
    ...over,
  }
}

function load(over: Partial<LoadResult> = {}): LoadResult {
  return { acute: 100, chronic: 100, acwr: 1, monotony: 1.2, trainingStrain: 800, band: 'optimal', ...over }
}

// Minimal DayView: only the fields the sport engine reads.
function day(workouts: WorkoutInput[], trimps: number[], loadOver: Partial<LoadResult> = {}): DayView {
  return {
    date: '2026-06-20',
    workouts,
    strain: {
      sessions: workouts.map((w, i) => ({ type: w.sportTag ?? w.type, trimp: trimps[i] })),
      dayTrimp: trimps.reduce((a, b) => a + b, 0),
      strain: 10,
    },
    load: load(loadOver),
  } as unknown as DayView
}

describe('classifySport', () => {
  it('keeps Tennis as Tennis', () => {
    expect(classifySport(workout({ type: 'Tennis' }))).toBe('Tennis')
  })

  it('labels an evening Other workout as Evening sport', () => {
    expect(classifySport(workout({ start: '2026-06-20T18:30:00' }))).toBe('Evening sport')
  })

  it('leaves a morning Other workout as Other', () => {
    expect(classifySport(workout({ start: '2026-06-20T07:00:00' }))).toBe('Other')
  })

  it('manual sportTag wins over the Apple type', () => {
    expect(classifySport(workout({ sportTag: 'Cricket' }))).toBe('Cricket')
  })
})

describe('sportBreakdown', () => {
  const days = [
    day([workout({ type: 'Tennis' })], [50]),
    day([workout({ type: 'Traditional Strength Training' }), workout({ type: 'Tennis' })], [100, 50]),
  ]

  it('shares sum to 1 and are sorted by trimp desc', () => {
    const slices = sportBreakdown(days, 1)
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1)
    expect(slices.map((s) => s.sport)).toEqual(['Tennis', 'Traditional Strength Training'])
    expect(slices[0]).toMatchObject({ sessions: 2, minutes: 120, trimp: 100 })
    expect(slices[0].trimp).toBeGreaterThanOrEqual(slices[1].trimp)
  })

  it('respects the window', () => {
    const slices = sportBreakdown(days, 1, 1)
    expect(slices.reduce((a, s) => a + s.sessions, 0)).toBe(2)
  })

  it('returns [] when there are no workouts', () => {
    expect(sportBreakdown([day([], []), day([], [])], 1)).toEqual([])
  })
})

describe('loadGuard', () => {
  it('flags ACWR 1.6 as high-risk', () => {
    const g = loadGuard(day([], [], { acwr: 1.6, band: 'high-risk' }), 20)
    expect(g.band).toBe('high-risk')
    expect(g.acwr).toBe(1.6)
    expect(g.monotony).toBe(1.2)
  })

  it('is insufficient with zero chronic load and returns null ratios', () => {
    const g = loadGuard(day([], [], { chronic: 0, acwr: 0, monotony: 0 }), 20)
    expect(g.band).toBe('insufficient')
    expect(g.acwr).toBeNull()
    expect(g.monotony).toBeNull()
  })

  it('is insufficient with under 14 days of history', () => {
    const g = loadGuard(day([], []), 13)
    expect(g.band).toBe('insufficient')
    expect(g.acwr).toBeNull()
    expect(loadGuard(day([], []), 14).band).toBe('optimal')
  })
})
