import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREBASE_DB_URL, buildDayViews, isDemoData, loadHealthData } from './firebase'
import { generateDemoPayloads } from '../demo/generateDemo'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadHealthData', () => {
  it('returns demo days and never calls fetch when ?demo=1', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('location', { search: '?demo=1' })
    expect(isDemoData()).toBe(true)
    const days = await loadHealthData()
    expect(days.length).toBe(45)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the live database once without ?demo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => null })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('location', { search: '' })
    expect(isDemoData()).toBe(false)
    await loadHealthData()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${FIREBASE_DB_URL}/health_raw.json`)
  })
})

describe('buildDayViews workouts', () => {
  it('exposes a workouts array on every day, with at least one two-workout day', () => {
    const now = new Date(2026, 5, 20, 12, 0, 0)
    const days = buildDayViews(generateDemoPayloads(10, 7, now))
    expect(days.length).toBeGreaterThan(0)
    for (const d of days) expect(Array.isArray(d.workouts)).toBe(true)
    expect(days.some((d) => d.workouts.length === 2)).toBe(true)
  })

  it('yields an empty array (not undefined) for days with no workouts', () => {
    const now = new Date(2026, 5, 20, 12, 0, 0)
    const payloads = generateDemoPayloads(10, 7, now) as { data: { workouts: unknown[] } }[]
    for (const p of payloads) p.data.workouts = []
    const days = buildDayViews(payloads)
    expect(days.length).toBeGreaterThan(0)
    for (const d of days) expect(d.workouts).toEqual([])
  })
})
