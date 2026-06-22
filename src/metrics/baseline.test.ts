import { describe, it, expect } from 'vitest'
import { mean, stdDev, ewma, rollingBaseline } from './baseline'

describe('baseline stats', () => {
  it('mean averages the values', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })

  it('stdDev is the sample standard deviation', () => {
    expect(stdDev([2, 4, 6])).toBeCloseTo(2, 5)
  })

  it('stdDev returns 0 for fewer than two values', () => {
    expect(stdDev([5])).toBe(0)
    expect(stdDev([])).toBe(0)
  })

  it('ewma weights recent values more', () => {
    // oldest -> newest; high alpha leans toward the last value
    expect(ewma([10, 20], 0.9)).toBeCloseTo(19, 5)
  })

  it('rollingBaseline uses only the last windowDays values and floors sd', () => {
    const b = rollingBaseline([100, 1, 2, 3], 3) // last 3 -> [1,2,3]
    expect(b.mean).toBe(2)
    expect(b.n).toBe(3)
    expect(b.sd).toBeGreaterThan(0)
  })
})
