// Overlay shell for the "in-depth detail" views: covers the app column with
// the dark canvas, slides/fades in above the screen content, and gives every
// detail view (Recovery drivers, Sleep architecture, Strain sessions, etc.) a
// consistent sticky header with a back chevron, a title, and the existing
// DateNav so the user can step days while inside the detail. Body renders
// arbitrary children with comfortable padding.
import { DateNav } from './DateNav'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface MetricDetailSheetProps {
  title: string
  date: string
  isLatest: boolean
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onClose: () => void
  children: React.ReactNode
}

export function MetricDetailSheet({
  title,
  date,
  isLatest,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onClose,
  children,
}: MetricDetailSheetProps) {
  return (
    <div
      className="animate-fade-up absolute inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ background: 'var(--bg)' }}
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ color: 'var(--text-dim)', background: 'var(--surface)' }}
        >
          <BackIcon />
        </button>
        <h2 className="font-display flex-1 truncate text-lg font-bold" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
        <DateNav
          date={date}
          isLatest={isLatest}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={onBack}
          onForward={onForward}
        />
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">{children}</div>
    </div>
  )
}
