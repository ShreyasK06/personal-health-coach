interface RecoveryRingProps {
  score: number
  band: 'red' | 'amber' | 'green'
}

const BAND_COLORS: Record<RecoveryRingProps['band'], string> = {
  red: '#ff3b3b',
  amber: '#ffb020',
  green: '#16c47a',
}

const SIZE = 220
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function RecoveryRing({ score, band }: RecoveryRingProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = BAND_COLORS[band]
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#23262d"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tracking-tight" style={{ color: '#e8eaed' }}>
          {Math.round(clamped)}
          <span className="text-2xl align-top">%</span>
        </span>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest" style={{ color: '#8b8f98' }}>
          Recovery
        </span>
      </div>
    </div>
  )
}
