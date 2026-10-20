// Tests for the coach: offline rules adapter and the optional HTTP adapter.
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { DayView } from '../lib/firebase'
import { buildCoachContext } from './adapter'
import { rulesAdapter } from './rulesAdapter'
import { createHttpAdapter } from './httpAdapter'

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

afterEach(() => vi.unstubAllGlobals())

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
    expect(text.toLowerCase()).toContain('sleep')
  })

  it('never diagnoses', async () => {
    const text = await rulesAdapter.brief(ctxFor('red', 20))
    expect(text.toLowerCase()).not.toMatch(/diagnos|disease|illness/)
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
    expect(await a.ask(c, 'train?')).toBe(await rulesAdapter.ask(c, 'train?'))
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
