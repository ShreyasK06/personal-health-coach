// Coach overlay opened from the Today "Morning brief" card. Same overlay
// shell as MetricDetailSheet (absolute, full-bleed, sticky header with a back
// button) but simpler: no DateNav. Shows the coach's brief on open, then a
// short chat (message list + input + send). While a reply is pending, send is
// disabled. Adapter failures never surface raw: the user sees one friendly
// line. Footer always states this is general guidance, not medical advice.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { DayView } from '../lib/firebase'
import type { CoachAdapter } from '../coach/adapter'
import { buildCoachContext } from '../coach/adapter'
import { getCoach } from '../coach'
import { Card } from './Card'
import { SectionLabel } from './SectionLabel'

const ERROR_TEXT = 'The coach could not answer just now. Please try again.'

interface Message {
  role: 'user' | 'coach'
  text: string
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CoachSheet({
  days,
  index,
  onClose,
  coach,
}: {
  days: DayView[]
  index: number
  onClose: () => void
  coach?: CoachAdapter
}) {
  const adapter = useMemo(() => coach ?? getCoach(), [coach])
  const ctx = useMemo(() => buildCoachContext(days, index), [days, index])
  const [brief, setBrief] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    adapter
      .brief(ctx)
      .then((t) => alive.current && setBrief(t))
      .catch(() => alive.current && setBrief(ERROR_TEXT))
    return () => {
      alive.current = false
    }
  }, [adapter, ctx])

  async function send(e: FormEvent) {
    e.preventDefault()
    const q = draft.trim()
    if (q === '' || pending) return
    setDraft('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setPending(true)
    let reply: string
    try {
      reply = await adapter.ask(ctx, q)
    } catch {
      reply = ERROR_TEXT
    }
    if (!alive.current) return
    setMessages((m) => [...m, { role: 'coach', text: reply }])
    setPending(false)
  }

  return (
    <div
      className="animate-fade-up absolute inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ background: 'var(--bg)' }}
      role="dialog"
      aria-label="Coach"
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close coach"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ color: 'var(--text-dim)', background: 'var(--surface)' }}
        >
          <BackIcon />
        </button>
        <h2 className="font-display flex-1 truncate text-lg font-bold" style={{ color: 'var(--text)' }}>
          Coach
        </h2>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <section aria-label="Morning brief" className="flex flex-col gap-3">
          <SectionLabel>Morning brief</SectionLabel>
          <Card tone="hero">
            <p className="whitespace-pre-line text-sm" style={{ color: 'var(--text)' }}>
              {brief ?? 'Preparing your brief...'}
            </p>
          </Card>
        </section>

        <ul aria-label="Conversation" aria-live="polite" className="flex flex-col gap-3">
          {messages.map((m, k) => (
            <li
              key={k}
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'self-end' : 'self-start'}`}
              style={{
                background: m.role === 'user' ? 'var(--surface)' : 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              {m.text}
            </li>
          ))}
          {pending && (
            <li className="self-start text-sm" style={{ color: 'var(--text-mut)' }}>
              Coach is thinking...
            </li>
          )}
        </ul>
      </div>

      <div
        className="sticky bottom-0 flex flex-col gap-2 border-t px-5 py-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <form onSubmit={send} className="flex items-center gap-2">
          <label htmlFor="coach-question" className="sr-only">
            Ask the coach a question
          </label>
          <input
            id="coach-question"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about training or sleep"
            className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={pending || draft.trim() === ''}
            className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Send
          </button>
        </form>
        <p className="text-center text-xs" style={{ color: 'var(--text-mut)' }}>
          General guidance, not medical advice
        </p>
      </div>
    </div>
  )
}
