import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIREBASE_DB_URL, isDemoData, loadHealthData } from './firebase'

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
