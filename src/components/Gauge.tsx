// Semicircle arc gauge with a glowing endpoint dot. Used for Sleep performance
// (score / Optimal) on the Sleep screen and reusable for Strain. Renders a
// 180-degree track from left to right with the value arc on top, the big number
// in the middle, and an optional caption underneath.

interface GaugeProps {
  value: number
  max: number
  color?: string
  trackColor?: string
  label?: string // caption under the number, e.g. "of 100"
  caption?: string // small state word, e.g. "Optimal"
  size?: number
  thickness?: number
  onClick?: () => void
}

export function Gauge({
  value,
  max,
  color = 'var(--sleep)',
  trackColor = 'var(--surface-2)',
  label,
  caption,
  size = 260,
  thickness = 16,
  onClick,
}: GaugeProps) {
  const interactive = onClick != null

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  // Semicircle: 180deg (left, pi) -> 0deg (right). We sweep across the top.
  const startA = Math.PI
  const endA = startA - frac * Math.PI
  const pt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) })
  const start = pt(Math.PI)
  const full = pt(0)
  const end = pt(endA)
  const height = size / 2 + thickness

  const arc = (from: { x: number; y: number }, to: { x: number; y: number }, large: number) =>
    `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`

  return (
    <div
      className="flex flex-col items-center rounded-[18px] transition-opacity"
      style={{ width: size, cursor: interactive ? 'pointer' : undefined }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseEnter={
        interactive
          ? (e) => {
              e.currentTarget.style.opacity = '0.92'
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              e.currentTarget.style.opacity = '1'
            }
          : undefined
      }
    >
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        <defs>
          <filter id="gaugeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={arc(start, full, 0)} fill="none" stroke={trackColor} strokeWidth={thickness} strokeLinecap="round" />
        {frac > 0.001 && (
          <path
            d={arc(start, end, 0)}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
          />
        )}
        {frac > 0.001 && (
          <>
            <circle cx={end.x} cy={end.y} r={thickness / 2 + 1.5} fill={color} filter="url(#gaugeGlow)" />
            <circle cx={end.x} cy={end.y} r={thickness / 2 - 3} fill="#fff" opacity={0.92} />
          </>
        )}
      </svg>
      <div className="flex flex-col items-center" style={{ marginTop: -size * 0.34 }}>
        <span className="font-display tabnum font-black leading-none" style={{ fontSize: size * 0.2, color: 'var(--text)' }}>
          {Math.round(value)}
        </span>
        {label && <span className="mt-1 text-xs" style={{ color: 'var(--text-mut)' }}>{label}</span>}
        {caption && (
          <span className="mt-0.5 text-sm font-bold uppercase tracking-[0.16em]" style={{ color }}>
            {caption}
          </span>
        )}
      </div>
    </div>
  )
}
