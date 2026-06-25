// Richer stat card: a lucide icon in a tinted rounded chip, a small uppercase
// label, a big bold tabular-numeral value + unit, an optional delta rendered
// via the existing StatePill, an optional embedded mini-sparkline, a gradient
// accent edge, and a subtle glow tinted to the metric color. Optionally
// behaves as an accessible button (keyboard activation + hover lift).
import type { LucideIcon } from 'lucide-react'
import { Sparkline } from './Sparkline'
import { StatePill, type PillTone } from './StatePill'

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
  series?: (number | null)[]
  onClick?: () => void
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
  series,
  onClick,
}: MetricCardProps) {
  const interactive = onClick != null
  const displayValue = typeof value === 'number' ? Math.round(value) : value

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
        {delta != null && (
          <StatePill tone={deltaTone} dot={deltaTone === 'positive' || deltaTone === 'critical'}>
            {delta}
          </StatePill>
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
