/** Tiny SVG sparkline. Renders a smoothed-ish polyline from a numeric series,
 * colored per domain. Used by StatTile (14-day) and the Trends screen. */
export function Sparkline({
  values,
  color = 'var(--gold)',
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
}: {
  values: (number | null)[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
  fill?: boolean
}) {
  const clean = values.map((v) => (v == null || !Number.isFinite(v) ? null : v))
  const present = clean.filter((v): v is number => v != null)

  if (present.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line
          x1={0}
          y1={height - strokeWidth}
          x2={width}
          y2={height - strokeWidth}
          stroke="var(--border-strong)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const min = Math.min(...present)
  const max = Math.max(...present)
  const span = max - min || 1
  const pad = strokeWidth + 1
  const usableH = height - pad * 2
  const n = clean.length

  const xAt = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width)
  const yAt = (v: number) => pad + usableH - ((v - min) / span) * usableH

  // Build a path that skips nulls (breaks the line at gaps).
  let d = ''
  let started = false
  const pts: { x: number; y: number }[] = []
  clean.forEach((v, i) => {
    if (v == null) {
      started = false
      return
    }
    const x = xAt(i)
    const y = yAt(v)
    pts.push({ x, y })
    d += `${started ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `
    started = true
  })

  const gradId = `spark-${Math.abs(hash(color + values.length + (present[0] ?? 0)))}`
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${d}L${width} ${height} L0 ${height} Z`}
            fill={`url(#${gradId})`}
            stroke="none"
          />
        </>
      )}
      <path
        d={d.trim()}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && <circle cx={last.x} cy={last.y} r={strokeWidth + 0.5} fill={color} />}
    </svg>
  )
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}
