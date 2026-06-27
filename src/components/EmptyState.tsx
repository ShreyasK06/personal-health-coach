// Compact one-line "not enough data yet" card (~64px tall), used wherever a
// chart/section lacks data instead of rendering an empty full-size chart --
// this is part of the page-length fix: empty charts used to reserve their
// full height with no content, making pages much longer than their actual
// content.
export function EmptyState({ message = 'Not enough data yet' }: { message?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[20px] border px-4 text-center"
      style={{
        minHeight: 64,
        height: 64,
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-mut)',
      }}
    >
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}
