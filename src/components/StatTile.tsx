// Dark rounded stat tile: a tiny uppercase gold label, a big bold tabular
// number with a muted unit, an optional state/delta pill, and a 14-day
// sparkline along the bottom. Arranged in the Today screen's 2-column grid.
import { Sparkline } from './Sparkline'
import { StatePill, type PillTone } from './StatePill'

interface StatTileProps {
  label: string
  value: string
  unit?: string
  series?: (number | null)[]
  sparkColor?: string
  pill?: { text: string; tone: PillTone }
  state?: string // small state word under the number
  stateColor?: string
  onClick?: () => void
}

export function StatTile({
  label,
  value,
  unit,
  series,
  sparkColor = 'var(--gold)',
  pill,
  state,
  stateColor = 'var(--text-mut)',
  onClick,
}: StatTileProps) {
  const interactive = onClick != null

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
        <span className="section-label" style={{ color: 'var(--gold)' }}>
          {label}
        </span>
        {pill && (
          <StatePill tone={pill.tone} dot={pill.tone === 'positive' || pill.tone === 'critical'}>
            {pill.text}
          </StatePill>
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
