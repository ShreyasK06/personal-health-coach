import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SportLoad } from './SportLoad'
import { withTag } from '../lib/sportTags'
import { generateDemoPayloads } from '../demo/generateDemo'
import { buildDayViews } from '../lib/firebase'

const NOW = new Date(2026, 5, 20, 12, 0, 0)
const noop = () => {}

describe('withTag', () => {
  it('sets a tag and removes the key (never stores an empty string) for Auto', () => {
    const set = withTag({ a: 'Tennis' }, 'b', 'Cricket')
    expect(set).toEqual({ a: 'Tennis', b: 'Cricket' })
    const cleared = withTag(set, 'b', '')
    expect(cleared).toEqual({ a: 'Tennis' })
    expect('b' in cleared).toBe(false)
  })
})

describe('SportLoad', () => {
  const days = buildDayViews(generateDemoPayloads(45, 7, NOW))
  const last = days.length - 1

  it('renders title, a sport name and an ACWR value for demo days', () => {
    const html = renderToString(<SportLoad days={days} selectedIndex={last} onSelectIndex={noop} />)
    expect(html).toContain('Sport load')
    expect(html).toMatch(/ACWR \d+\.\d{2}/)
    const ratio = /ACWR (\d+\.\d{2})/.exec(html)![1]
    // The big gauge number is the ratio itself, not a 100x rounded value.
    expect(html).toContain(`>${ratio}</span>`)
    expect(html).not.toContain(`>${Math.round(Number(ratio) * 100)}</span>`)
    expect(html).toContain('Auto (')
    // Sport names inside the "By sport" bar rows (not the <option> labels).
    const barNames = [...html.matchAll(/min-w-0 truncate text-sm font-semibold"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1])
    expect(barNames.length).toBeGreaterThan(0)
    expect(barNames.join(' ')).toMatch(/Tennis|Pickleball|Cricket|Running|Walking|Evening sport|Other|Strength/)
    expect(html).toContain('Tag sessions')
    expect(html).not.toMatch(/NaN|Infinity/)
  })

  it('shows a not-enough-history note early in the window', () => {
    const html = renderToString(<SportLoad days={days} selectedIndex={3} onSelectIndex={noop} />)
    expect(html).toContain('Not enough history yet')
    expect(html).not.toMatch(/NaN|Infinity/)
  })

  it('renders the empty state with no NaN when there are no workouts', () => {
    const empty = days.map((d) => ({ ...d, workouts: [] }))
    const html = renderToString(<SportLoad days={empty} selectedIndex={last} onSelectIndex={noop} />)
    expect(html).toContain('once your export includes')
    expect(html).not.toMatch(/NaN|Infinity|null/)
  })
})
