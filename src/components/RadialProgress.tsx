// Single donut ring with a gradient stroke and glow, a big tabular-numeral
// center value, and a small uppercase label underneath. A simpler sibling of
// RecoveryRing for arbitrary value/goal metrics (e.g. steps, water, calories).
import { useEffect, useId, useState } from 'react'

interface RadialProgressProps {
  value: number
  goal: number
  color: string
  gradFrom: string
  gradTo: string
  label: string
  unit?: string
  size?: number
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function RadialProgress({ value, goal, color, gradFrom, gradTo, label, unit, size = 160 }: RadialProgressProps) {
  const uid = useId().replace(/:/g, '')
  const animate = !useReducedMotion()

  const stroke = size * 0.1
  const r = (size - stroke) / 2
  const cx = size / 2
  const c = 2 * Math.PI * r
  const frac = goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0
  const target = c * (1 - frac)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={size * 0.02} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {frac > 0.001 && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={`url(#${uid}-grad)`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={animate ? c : target}
              filter={`url(#${uid}-glow)`}
              style={
                animate
                  ? ({
                      animation: 'ringSweep 1.1s cubic-bezier(0.22, 1, 0.36, 1) both',
                      '--ring-circumference': c,
                      '--ring-offset': target,
                    } as React.CSSProperties)
                  : undefined
              }
            />
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabnum font-black leading-none" style={{ fontSize: size * 0.2, color: 'var(--text)' }}>
          {Math.round(value)}
          {unit && (
            <span className="align-top" style={{ fontSize: size * 0.08, color: 'var(--text-mut)' }}>
              {' '}
              {unit}
            </span>
          )}
        </span>
        <span
          className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
