// SSR render test for the CoachSheet initial markup.
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { DayView } from '../lib/firebase'
import { rulesAdapter } from '../coach/rulesAdapter'
import { CoachSheet } from './CoachSheet'

const day = {
  date: '2026-01-10',
  recovery: { score: 70, band: 'green', zHrv: 0, zRhr: 0, respPenalty: 0 },
  sleep: { score: 80, performance: 0.9, needHours: 8 },
  load: { acwr: 1.1, monotony: 1.2, chronic: 100, acute: 110, band: 'optimal' },
  hrvMs: 60,
  restingHr: 52,
  asleepMinutes: 450,
  workouts: [],
} as unknown as DayView

// Escape-to-close and focus move/restore need a DOM; not testable without
// jsdom (intentionally not added), so only markup is asserted here.
describe('CoachSheet', () => {
  it('renders brief region, labelled input, send button and disclaimer', () => {
    const html = renderToString(<CoachSheet days={[day, day]} index={1} onClose={() => {}} coach={rulesAdapter} />)
    expect(html).toContain('aria-label="Morning brief"')
    expect(html).toContain('for="coach-question"')
    expect(html).toContain('aria-label="Send question"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Coach"')
    expect(html).toContain('General guidance, not medical advice')
  })
})
