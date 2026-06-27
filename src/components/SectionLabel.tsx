/** Tiny uppercase letter-spaced label that sits above a group of cards,
 * e.g. "AT A GLANCE" / "MARKERS". Rendered by the Today/Sleep/Trends/Activity
 * screens and the detail sheets. Lightweight by design -- no baked-in top
 * margin. Vertical rhythm between sections is now owned by the page itself
 * (each screen's root wraps content in `flex flex-col gap-6`), not by this
 * label, so it composes cleanly with ChartCard/Card groups. */
export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-label" style={{ color: 'var(--text-mut)' }}>
        {children}
      </span>
      {right ? (
        <span className="text-label" style={{ color: 'var(--text-mut)' }}>
          {right}
        </span>
      ) : null}
    </div>
  )
}
