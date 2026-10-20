import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSportTags, setSportTag } from './sportTags'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sportTags', () => {
  it('round-trips a tag', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    setSportTag('2026-06-20T18:30:00', 'Cricket')
    setSportTag('2026-06-21T07:00:00', 'Tennis')
    expect(getSportTags()).toEqual({
      '2026-06-20T18:30:00': 'Cricket',
      '2026-06-21T07:00:00': 'Tennis',
    })
  })

  it('returns {} for corrupt JSON', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'phc.sportTags': '{not json' }))
    expect(getSportTags()).toEqual({})
  })

  it('returns {} and does not throw when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      get getItem(): never {
        throw new Error('denied')
      },
      get setItem(): never {
        throw new Error('denied')
      },
    })
    expect(getSportTags()).toEqual({})
    expect(() => setSportTag('x', 'Tennis')).not.toThrow()
  })
})
