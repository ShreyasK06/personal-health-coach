import { describe, it, expect } from 'vitest'
import { computeLoad } from './load'

function days(values: number[], end: string): { date: string; load: number }[] {
  // values oldest -> newest, ending on `end`
  const endDate = new Date(end + 'T00:00:00Z')
  return values.map((load, i) => {
    const d = new Date(endDate)
    d.setUTCDate(endDate.getUTCDate() - (values.length - 1 - i))
    return { date: d.toISOString().slice(0, 10), load }
  })
}

describe('computeLoad', () => {
  it('steady load gives ACWR near 1 and optimal band', () => {
    const hist = days(Array(28).fill(100), '2026-06-21')
    const r = computeLoad(hist, '2026-06-21')
    expect(r.acwr).toBeCloseTo(1, 2)
    expect(r.band).toBe('optimal')
  })

  it('a sudden spike pushes ACWR high-risk', () => {
    const hist = days([...Array(21).fill(50), ...Array(7).fill(150)], '2026-06-21')
    const r = computeLoad(hist, '2026-06-21')
    expect(r.acwr).toBeGreaterThan(1.5)
    expect(r.band).toBe('high-risk')
  })

  it('handles empty chronic window without dividing by zero', () => {
    const r = computeLoad([], '2026-06-21')
    expect(r.acwr).toBe(0)
    expect(r.band).toBe('detraining')
  })
})
