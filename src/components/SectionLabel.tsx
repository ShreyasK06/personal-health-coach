/** Tiny uppercase letter-spaced label that sits above a group of cards,
 * e.g. "AT A GLANCE" / "MARKERS". Rendered by the Today/Sleep/Trends screens. */
export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between first:mt-0">
      <span className="section-label">{children}</span>
      {right ? <span className="section-label">{right}</span> : null}
    </div>
  )
}
