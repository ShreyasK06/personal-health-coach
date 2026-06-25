// Pill-shaped date navigator with left/right chevrons, matching the reference
// screenshots ("< Today / 14 Jun >"). Lets the user step through the days
// array one day at a time; chevrons disable at the array bounds. Rendered by
// the Today and Sleep screens.
import { shortDate } from '../lib/uiHelpers'

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DateNav({
  date,
  isLatest,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  date: string
  isLatest: boolean
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
}) {
  return (
    <div
      className="mt-3 inline-flex items-center gap-3 self-center rounded-full border px-2 py-1.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Previous day"
        className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
        style={{ color: 'var(--text-dim)' }}
      >
        <ChevronIcon direction="left" />
      </button>
      <span className="tabnum text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {isLatest ? 'Today' : shortDate(date)}
      </span>
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Next day"
        className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
        style={{ color: 'var(--text-dim)' }}
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  )
}
