/** Small rounded status pill with semantic fill. Used in StatTile, the
 * RecoveryRing header area, and the Sleep/Today screens. */
export type PillTone = 'gold' | 'positive' | 'warning' | 'critical' | 'neutral' | 'sleep'

const TONES: Record<PillTone, { color: string; bg: string }> = {
  gold: { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 16%, transparent)' },
  positive: { color: 'var(--positive)', bg: 'color-mix(in srgb, var(--positive) 16%, transparent)' },
  warning: { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 16%, transparent)' },
  critical: { color: 'var(--critical)', bg: 'color-mix(in srgb, var(--critical) 16%, transparent)' },
  sleep: { color: 'var(--sleep)', bg: 'color-mix(in srgb, var(--sleep) 16%, transparent)' },
  neutral: { color: 'var(--text-mut)', bg: 'var(--surface-2)' },
}

export function StatePill({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: React.ReactNode
  tone?: PillTone
  dot?: boolean
}) {
  const t = TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide tabnum"
      style={{ color: t.color, background: t.bg }}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
      ) : null}
      {children}
    </span>
  )
}
