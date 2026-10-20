// Optional HTTP coach. POSTs { context, question } (computed numbers and
// labels only) to a server the user runs. Any failure -- network error,
// timeout, non-2xx, malformed body, non-string reply -- silently falls back to
// the supplied adapter. No API key is ever read or sent from the client.
import type { CoachAdapter, CoachContext } from './adapter'
import { toWireContext } from './adapter'

export function createHttpAdapter(endpoint: string, fallback: CoachAdapter, timeoutMs = 8000): CoachAdapter {
  async function remote(ctx: CoachContext, question: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: toWireContext(ctx), question }),
        signal: controller.signal,
      })
      if (!res.ok) return null
      const data: unknown = await res.json()
      const reply = (data as { reply?: unknown } | null)?.reply
      return typeof reply === 'string' && reply.trim() !== '' ? reply : null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async brief(ctx) {
      return (await remote(ctx, '')) ?? fallback.brief(ctx)
    },
    async ask(ctx, question) {
      return (await remote(ctx, question)) ?? fallback.ask(ctx, question)
    },
  }
}
