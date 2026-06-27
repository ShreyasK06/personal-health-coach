// Dark rounded stat tile: a tiny uppercase muted label, a big bold tabular
// number with a muted unit, an optional state/delta pill, and a 14-day
// sparkline along the bottom. Arranged in the Today screen's 2-column grid.
//
// `dayDelta` is a structured day-over-day delta (from `metricDelta()`); when
// provided it renders as a formatted, direction-colored pill next to the
// label, taking priority over the legacy free-form `pill` prop. Pass
// `invert` for metrics where "up" should read as unfavorable.
import { Sparkline } from './Sparkline'
import { StatePill, type PillTone } from './StatePill'

export interface StatTileDelta {
  abs: number
  pct: number
  direction: 'up' | 'down' | 'flat'
}

const DELTA_TONE: Record<'up' | 'down' | 'flat', PillTone> = {
  up: 'positive',
  down: 'critical',
  flat: 'neutral',
}

function formatDayDelta(d: StatTileDelta, invert: boolean): { text: string; tone: PillTone } {
  if (d.direction === 'flat') return { text: '–', tone: 'neutral' }
  const sign = d.abs > 0 ? '+' : '-'
  const magnitude = Math.round(Math.abs(d.pct))
  const effectiveDirection = invert ? (d.direction === 'up' ? 'down' : 'up') : d.direction
  return { text: `${sign}${magnitude}%`, tone: DELTA_TONE[effectiveDirection] }
}

interface StatTileProps {
  label: string
  value: string
  unit?: string
  series?: (number | null)[]
  sparkColor?: string
  pill?: { text: string; tone: PillTone }
  dayDelta?: StatTileDelta | null
  invert?: boolean
  state?: string // small state word under the number
  stateColor?: string
  onClick?: () => void
}

export function StatTile({
  label,
  value,
  unit,
  series,
  sparkColor = 'var(--accent)',
  pill,
  dayDelta,
  invert = false,
  state,
  stateColor = 'var(--text-mut)',
  onClick,
}: StatTileProps) {
  const interactive = onClick != null
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
      className="flex flex-col justify-between gap-3 rounded-[18px] border p-4 transition-colors"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        cursor: interactive ? 'pointer' : undefined,
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseEnter={
        interactive
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <span className="section-label" style={{ color: 'var(--text-mut)' }}>
          {label}
        </span>
        {formattedDayDelta ? (
          <StatePill tone={formattedDayDelta.tone} dot={formattedDayDelta.tone === 'positive' || formattedDayDelta.tone === 'critical'}>
            {formattedDayDelta.text}
          </StatePill>
        ) : (
          pill && (
            <StatePill tone={pill.tone} dot={pill.tone === 'positive' || pill.tone === 'critical'}>
              {pill.text}
            </StatePill>
          )
        )}
      </div>

      <div className="flex items-end gap-1.5">
        <span className="font-display tabnum text-[32px] font-black leading-none" style={{ color: 'var(--text)' }}>
          {value}
        </span>
        {unit && (
          <span className="mb-1 text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
            {unit}
          </span>
        )}
      </div>

      {state && (
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: stateColor }}>
          {state}
        </span>
      )}

      {series && series.length > 0 && (
        <div className="mt-1">
          <Sparkline values={series} color={sparkColor} width={150} height={34} />
        </div>
      )}
    </div>
  )
}
