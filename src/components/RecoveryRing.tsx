// Titanium recovery ring: a large circular gauge whose stroke is colored by
// recovery band (low/mid/high) with a soft glow and a bright endpoint dot, the
// big % in the center, a small gold "RECOVERY" label, and a state word
// (LOW / BALANCED / PRIMED). Rendered as the hero on the Today screen.

interface RecoveryRingProps {
  score: number
  band: 'red' | 'amber' | 'green'
  size?: number
}

const BAND_COLOR: Record<RecoveryRingProps['band'], string> = {
  red: 'var(--rec-low)',
  amber: 'var(--rec-mid)',
  green: 'var(--rec-high)',
}

const BAND_STATE: Record<RecoveryRingProps['band'], string> = {
  red: 'LOW',
  amber: 'BALANCED',
  green: 'PRIMED',
}

export function RecoveryRing({ score, band, size = 232 }: RecoveryRingProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = BAND_COLOR[band]
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = c * (1 - clamped / 100)
  const cx = size / 2
  // endpoint angle: ring starts at 12 o'clock (-90deg) and sweeps clockwise
  const frac = clamped / 100
  const angle = -Math.PI / 2 + frac * 2 * Math.PI
  const dotX = cx + r * Math.cos(angle)
  const dotY = cx + r * Math.sin(angle)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={target}
            filter="url(#ringGlow)"
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </g>
        {/* bright endpoint dot */}
        <circle cx={dotX} cy={dotY} r={stroke / 2 + 1.5} fill={color} filter="url(#ringGlow)" />
        <circle cx={dotX} cy={dotY} r={stroke / 2 - 2.5} fill="#fff" opacity={0.92} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="section-label" style={{ color: 'var(--gold)', letterSpacing: '0.16em' }}>
          Recovery
        </span>
        <span
          className="font-display tabnum mt-1 font-black leading-none"
          style={{ fontSize: size * 0.31, color: 'var(--text)' }}
        >
          {Math.round(clamped)}
          <span className="align-top" style={{ fontSize: size * 0.12, color: 'var(--text-mut)' }}>
            %
          </span>
        </span>
        <span
          className="mt-1.5 text-sm font-bold uppercase tracking-[0.18em]"
          style={{ color }}
        >
          {BAND_STATE[band]}
        </span>
      </div>
    </div>
  )
}
