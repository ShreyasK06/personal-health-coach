import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SportLoad } from './SportLoad'
import { generateDemoPayloads } from '../demo/generateDemo'
import { buildDayViews } from '../lib/firebase'

const NOW = new Date(2026, 5, 20, 12, 0, 0)
const noop = () => {}

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
    expect(html).toMatch(/Tennis|Pickleball|Cricket|Running|Walking|Evening sport|Other|Strength/)
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
