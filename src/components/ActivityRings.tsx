// Apple-Watch-style three concentric activity rings: outer = Move (active
// kcal), middle = Exercise (minutes), inner = Stand (hours). Each ring uses
// its own gradient + glow and sweeps in on mount via stroke-dashoffset
// (skipped under prefers-reduced-motion). Rounded line caps, matching the
// RecoveryRing/Gauge glow-filter convention.
import { useEffect, useId, useState } from 'react'

interface ActivityRingsProps {
  move: number
  moveGoal: number
  exercise: number
  exerciseGoal: number
  stand: number
  standGoal: number
  size?: number
}

interface RingSpec {
  key: string
  value: number
  goal: number
  gradFrom: string
  gradTo: string
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

function Ring({
  cx,
  cy,
  r,
  stroke,
  frac,
  gradientId,
  filterId,
  animate,
  delay,
}: {
  cx: number
  cy: number
  r: number
  stroke: number
  frac: number
  gradientId: string
  filterId: string
  animate: boolean
  delay: number
}) {
  const c = 2 * Math.PI * r
  const target = c * (1 - frac)

  return (
    <g transform={`rotate(-90 ${cx} ${cy})`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      {frac > 0.001 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={animate ? c : target}
          filter={`url(#${filterId})`}
          style={
            animate
              ? ({
                  animation: `ringSweep 1.1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
                  '--ring-circumference': c,
                  '--ring-offset': target,
                } as React.CSSProperties)
              : undefined
          }
        />
      )}
    </g>
  )
}

export function ActivityRings({
  move,
  moveGoal,
  exercise,
  exerciseGoal,
  stand,
  standGoal,
  size = 200,
}: ActivityRingsProps) {
  const uid = useId().replace(/:/g, '')
  const reducedMotion = useReducedMotion()
  const animate = !reducedMotion

  const stroke = size * 0.09
  const gap = size * 0.018
  const rOuter = size / 2 - stroke / 2
  const rMid = rOuter - stroke - gap
  const rInner = rMid - stroke - gap
  const cx = size / 2

  const rings: RingSpec[] = [
    { key: 'move', value: move, goal: moveGoal, gradFrom: 'var(--move-grad-from)', gradTo: 'var(--move-grad-to)' },
    { key: 'exercise', value: exercise, goal: exerciseGoal, gradFrom: 'var(--exercise-grad-from)', gradTo: 'var(--exercise-grad-to)' },
    { key: 'stand', value: stand, goal: standGoal, gradFrom: 'var(--stand-grad-from)', gradTo: 'var(--stand-grad-to)' },
  ]
  const radii = [rOuter, rMid, rInner]

  const moveFrac = moveGoal > 0 ? Math.max(0, Math.min(1, move / moveGoal)) : 0
  const allGoalsHit = rings.every((ring) => ring.goal > 0 && ring.value >= ring.goal)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {rings.map((ring) => (
            <linearGradient key={ring.key} id={`${uid}-grad-${ring.key}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={ring.gradFrom} />
              <stop offset="100%" stopColor={ring.gradTo} />
            </linearGradient>
          ))}
          {rings.map((ring) => (
            <filter key={ring.key} id={`${uid}-glow-${ring.key}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={size * 0.018} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>
        {rings.map((ring, i) => (
          <Ring
            key={ring.key}
            cx={cx}
            cy={cx}
            r={radii[i]}
            stroke={stroke}
            frac={ring.goal > 0 ? Math.max(0, Math.min(1, ring.value / ring.goal)) : 0}
            gradientId={`${uid}-grad-${ring.key}`}
            filterId={`${uid}-glow-${ring.key}`}
            animate={animate}
            delay={i * 0.12}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabnum font-black leading-none" style={{ fontSize: size * 0.16, color: 'var(--text)' }}>
          {Math.round(moveFrac * 100)}
          <span className="align-top" style={{ fontSize: size * 0.07, color: 'var(--text-mut)' }}>
            %
          </span>
        </span>
        <span
          className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: allGoalsHit ? 'var(--positive)' : 'var(--text-mut)' }}
        >
          {allGoalsHit ? 'Closed' : 'Move'}
        </span>
      </div>
    </div>
  )
}
