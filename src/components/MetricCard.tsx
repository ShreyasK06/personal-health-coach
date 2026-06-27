// Richer stat card: a lucide icon in a tinted rounded chip, a small uppercase
// label, a big bold tabular-numeral value + unit, an optional delta rendered
// via the existing StatePill, an optional embedded mini-sparkline, a gradient
// accent edge, and a subtle glow tinted to the metric color. Optionally
// behaves as an accessible button (keyboard activation + hover lift).
//
// Two ways to show a delta pill: the legacy free-form `delta`/`deltaTone`
// (caller-formatted string, e.g. "+4%"), or the newer `dayDelta` -- a
// structured day-over-day delta straight from `metricDelta()` -- which this
// component formats and colors by direction itself. `dayDelta` takes
// priority when both are supplied. Existing callers using only
// `delta`/`deltaTone` keep working unchanged.
import type { LucideIcon } from 'lucide-react'
import { Sparkline } from './Sparkline'
import { StatePill, type PillTone } from './StatePill'

export interface MetricCardDelta {
  abs: number
  pct: number
  direction: 'up' | 'down' | 'flat'
}

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  unit?: string
  accent: string
  gradFrom?: string
  gradTo?: string
  delta?: string | number
  deltaTone?: PillTone
  /** Structured day-over-day delta (from `metricDelta()`). When provided,
   * renders as a formatted, direction-colored pill instead of `delta`. Pass
   * `invert` for metrics where "up" should read as unfavorable (e.g.
   * resting heart rate, where a rise is a bad sign). */
  dayDelta?: MetricCardDelta | null
  invert?: boolean
  series?: (number | null)[]
  onClick?: () => void
}

const DELTA_TONE: Record<'up' | 'down' | 'flat', PillTone> = {
  up: 'positive',
  down: 'critical',
  flat: 'neutral',
}

function formatDayDelta(d: MetricCardDelta, invert: boolean): { text: string; tone: PillTone } {
  if (d.direction === 'flat') return { text: '–', tone: 'neutral' }
  const sign = d.abs > 0 ? '+' : '-'
  const magnitude = Math.round(Math.abs(d.pct))
  const text = `${sign}${magnitude}%`
  const effectiveDirection = invert ? (d.direction === 'up' ? 'down' : 'up') : d.direction
  return { text, tone: DELTA_TONE[effectiveDirection] }
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  gradFrom,
  gradTo,
  delta,
  deltaTone = 'neutral',
  dayDelta,
  invert = false,
  series,
  onClick,
}: MetricCardProps) {
  const interactive = onClick != null
  const displayValue = typeof value === 'number' ? Math.round(value) : value
  const formattedDayDelta = dayDelta != null ? formatDayDelta(dayDelta, invert) : null

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] border p-4 transition-transform"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        cursor: interactive ? 'pointer' : undefined,
        boxShadow: `0 0 24px -8px color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseEnter={
        interactive
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }
          : undefined
      }
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${gradFrom ?? accent}, ${gradTo ?? accent})` }}
        aria-hidden
      />

      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)` }}
        >
          <Icon size={18} color={accent} strokeWidth={2.25} />
        </div>
        {formattedDayDelta ? (
          <StatePill tone={formattedDayDelta.tone} dot={formattedDayDelta.tone === 'positive' || formattedDayDelta.tone === 'critical'}>
            {formattedDayDelta.text}
          </StatePill>
        ) : (
          delta != null && (
            <StatePill tone={deltaTone} dot={deltaTone === 'positive' || deltaTone === 'critical'}>
              {delta}
            </StatePill>
          )
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="section-label" style={{ color: 'var(--text-mut)' }}>
          {label}
        </span>
        <div className="flex items-end gap-1.5">
          <span className="font-display tabnum text-[28px] font-black leading-none" style={{ color: 'var(--text)' }}>
            {displayValue}
          </span>
          {unit && (
            <span className="mb-1 text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
              {unit}
            </span>
          )}
        </div>
      </div>

      {series && series.length > 0 && (
        <div className="mt-1">
          <Sparkline values={series} color={accent} width={150} height={32} />
        </div>
      )}
    </div>
  )
}
