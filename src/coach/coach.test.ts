// Tests for the coach: offline rules adapter and the optional HTTP adapter.
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { DayView } from '../lib/firebase'
import { buildCoachContext, effortNote, toWireContext } from './adapter'
import { rulesAdapter } from './rulesAdapter'
import { createHttpAdapter } from './httpAdapter'
import { getCoach } from './index'
import { generateDemoPayloads } from '../demo/generateDemo'
import { buildDayViews } from '../lib/firebase'

function mkDay(band: 'green' | 'amber' | 'red' | null, score = 82): DayView {
  return {
    date: '2026-01-10',
    recovery: band ? { score, band, zHrv: 0, zRhr: 0, respPenalty: 0 } : null,
    sleep: { score: 80, performance: 0.9, needHours: 8 },
    load: { acwr: 1.1, monotony: 1.2, chronic: 100, acute: 110, band: 'optimal' },
    strain: { strain: 9, sessions: [], dayTrimp: 50 },
    hrvMs: 62,
    restingHr: 52,
    respiratoryRate: 14,
    asleepMinutes: 450,
    workouts: [{ type: 'Soccer', start: '2026-01-09T18:00:00Z', durationMin: 60 }],
  } as unknown as DayView
}

function ctxFor(band: 'green' | 'amber' | 'red' | null, score?: number) {
  const days = [mkDay('amber', 60), mkDay(band, score)]
  return buildCoachContext(days, 1)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('rulesAdapter', () => {
  it('brief on a green day quotes Zone 4-5 and recovery', async () => {
    const text = await rulesAdapter.brief(ctxFor('green', 82))
    expect(text).toContain('Zone 4-5')
    expect(text).toContain('82')
  })

  it('brief with null recovery mentions baseline and has no %', async () => {
    const text = await rulesAdapter.brief(ctxFor(null))
    expect(text.toLowerCase()).toContain('baseline')
    expect(text).not.toContain('%')
  })

  it('red day training question gives Zone 1-2', async () => {
    const text = await rulesAdapter.ask(ctxFor('red', 20), 'should I play hard tonight?')
    expect(text).toContain('Zone 1-2')
  })

  it('empty question returns the brief', async () => {
    const c = ctxFor('green', 82)
    expect(await rulesAdapter.ask(c, '   ')).toBe(await rulesAdapter.brief(c))
  })

  it('training intent wins over sleep intent', async () => {
    const text = await rulesAdapter.ask(ctxFor('green', 82), 'I am tired, should I train hard?')
    expect(text).toContain('Zone 4-5')
  })

  it('sleep question gives sleep advice', async () => {
    const text = await rulesAdapter.ask(ctxFor('amber', 60), 'how is my sleep?')
    // Sleep-branch wording only; the fallback nudge never mentions sleep debt or a steady bedtime.
    expect(text).toMatch(/Sleep debt is low|h of sleep debt/)
    expect(text).toContain('steady bedtime')
    expect(text).not.toContain('You can ask me about')
  })

  it.each(['green', 'amber', 'red'] as const)('never diagnoses (%s)', async (band) => {
    const text = await rulesAdapter.brief(ctxFor(band, 50))
    expect(text.toLowerCase()).not.toMatch(/diagnos|disease|illness/)
  })
})

// >= 20 days so loadGuard is not 'insufficient'; the last day carries the scenario.
function loadCtx(acwr: number, band: 'optimal' | 'high-risk') {
  const base = mkDay('green', 82)
  const days = Array.from({ length: 21 }, () => base)
  days[20] = { ...base, load: { ...base.load, acwr, band } } as DayView
  return buildCoachContext(days, 20)
}

describe('high-load day never says push hard', () => {
  const ctx = loadCtx(1.6, 'high-risk')

  it('guard is active, not insufficient', () => {
    expect(ctx.load.band).toBe('high-risk')
    expect(ctx.readiness.headline).toBe('Strained')
  })

  it('brief and effortNote avoid push hard / Zone 4-5 and mention easing off', async () => {
    const text = await rulesAdapter.brief(ctx)
    expect(text).not.toMatch(/push hard|Zone 4-5/)
    expect(text.toLowerCase()).toContain('easier day')
    expect(effortNote(ctx)).not.toMatch(/push hard|Zone 4-5/)
  })

  it('"should I play hard tonight?" is not self-contradicting', async () => {
    const text = await rulesAdapter.ask(ctx, 'should I play hard tonight?')
    expect(text).not.toMatch(/push hard|Zone 4-5/)
    expect(text.toLowerCase()).toContain('easier day')
  })

  it('green recovery with optimal load still says Zone 4-5', async () => {
    const ok = loadCtx(1.1, 'optimal')
    expect(ok.load.band).toBe('optimal')
    expect(await rulesAdapter.brief(ok)).toContain('Zone 4-5')
    expect(await rulesAdapter.ask(ok, 'should I play hard tonight?')).toContain('Zone 4-5')
    expect(effortNote(ok)).toContain('push hard')
  })
})

describe('toWireContext', () => {
  it('rounds acwr and monotony to 2 decimals', () => {
    const c = ctxFor('green', 82)
    c.load = { ...c.load, band: 'optimal', acwr: 1.23456, monotony: 1.98765 }
    const w = toWireContext(c)
    expect(w.acwr).toBe(1.23)
    expect(w.monotony).toBe(1.99)
  })
})

describe('createHttpAdapter', () => {
  const c = ctxFor('green', 82)

  it.each([
    ['reject', () => Promise.reject(new Error('net'))],
    ['500', () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })],
    ['non-string reply', () => Promise.resolve({ ok: true, status: 200, json: async () => ({ reply: 5 }) })],
    ['bad json', () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error('x') } })],
  ])('falls back on %s', async (_n, impl) => {
    vi.stubGlobal('fetch', vi.fn(impl))
    const a = createHttpAdapter('https://example.test/coach', rulesAdapter)
    expect(await a.ask(c, 'should I train?')).toBe(await rulesAdapter.ask(c, 'should I train?'))
    expect(await a.brief(c)).toBe(await rulesAdapter.brief(c))
  })

  it('warns once per failure without leaking the question or context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('net'))))
    const a = createHttpAdapter('https://example.test/coach', rulesAdapter)
    expect(await a.ask(c, 'secret question')).toBe(await rulesAdapter.ask(c, 'secret question'))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe('[coach] endpoint failed, using offline coach:')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret question')
    warn.mockRestore()
  })

  it('warns on a non-ok response', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    await createHttpAdapter('https://example.test/coach', rulesAdapter).ask(c, 'hi')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('falls back on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new Error('aborted')))
        }),
      ),
    )
    const a = createHttpAdapter('https://example.test/coach', rulesAdapter, 10)
    const answer = await a.ask(c, 'train?')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(answer).toBe(await rulesAdapter.ask(c, 'train?'))
  })

  it('returns reply on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ reply: 'ok' }) })))
    const a = createHttpAdapter('https://example.test/coach', rulesAdapter)
    expect(await a.ask(c, 'hi')).toBe('ok')
  })

  it('request body has only computed numbers and the question', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ reply: 'ok' }) }))
    vi.stubGlobal('fetch', f)
    const a = createHttpAdapter('https://example.test/coach', rulesAdapter)
    await a.ask(c, 'hi')
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    const body = String(init.body)
    const parsed = JSON.parse(body)
    expect(parsed.question).toBe('hi')
    expect(Object.keys(parsed).sort()).toEqual(['context', 'question'])
    for (const bad of ['payload', 'raw', 'workouts', 'start', 'source', 'device', '2026-01-09T']) {
      expect(body).not.toContain(bad)
    }
  })
})

describe('getCoach', () => {
  it('returns rulesAdapter when VITE_COACH_ENDPOINT is unset', () => {
    vi.stubEnv('VITE_COACH_ENDPOINT', '')
    expect(getCoach()).toBe(rulesAdapter)
  })

  it('returns an http adapter when set', async () => {
    vi.stubEnv('VITE_COACH_ENDPOINT', 'https://example.test/coach')
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ reply: 'remote' }) }))
    vi.stubGlobal('fetch', f)
    const coach = getCoach()
    expect(coach).not.toBe(rulesAdapter)
    expect(await coach.ask(ctxFor('green', 82), 'hi')).toBe('remote')
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('buildCoachContext history', () => {
  const days = buildDayViews(generateDemoPayloads(45, 7, new Date('2026-03-01T12:00:00Z')))
  it('passes historyDays = i to loadGuard', () => {
    expect(buildCoachContext(days, 3).load.band).toBe('insufficient')
    expect(buildCoachContext(days, 20).load.band).not.toBe('insufficient')
  })
})
