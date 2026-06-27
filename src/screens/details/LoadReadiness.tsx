// Load & Readiness detail body: the headline readiness verdict, its signal
// breakdown (HRV, RHR, ACWR, monotony), an ACWR readout with a safe-zone bar,
// acute vs chronic load and monotony figures, a 30-day daily-load trend, and
// guidance. Rendered inside MetricDetailSheet by App.tsx; this component
// renders only the body (no header/back/date-nav).
import type { DayView } from '../../lib/firebase'
import { readiness, guidanceFor } from '../../lib/detail'
import { SectionLabel } from '../../components/SectionLabel'
import { StatePill } from '../../components/StatePill'
import { InteractiveChart } from '../../components/InteractiveChart'
import { LOAD_BAND } from '../../lib/uiHelpers'

const TONE_COLOR: Record<'positive' | 'warning' | 'critical' | 'sleep', string> = {
  positive: 'var(--positive)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  sleep: 'var(--sleep)',
}

const SIGNAL_DOT: Record<'good' | 'ok' | 'warn', string> = {
  good: 'var(--positive)',
  ok: 'var(--text-mut)',
  warn: 'var(--warning)',
}

const ACWR_SAFE_LOW = 0.8
const ACWR_SAFE_HIGH = 1.5
const ACWR_SCALE_MAX = 2.2

export function LoadReadiness({ days, index }: { days: DayView[]; index: number }) {
  const day = days[index]
  const r = readiness(days, index)
  const { acwr, acute, chronic, monotony, band } = day.load
  const headlineColor = TONE_COLOR[r.tone]

  const safeLowPct = (ACWR_SAFE_LOW / ACWR_SCALE_MAX) * 100
  const safeHighPct = (ACWR_SAFE_HIGH / ACWR_SCALE_MAX) * 100
  const markerPct = Math.min(100, (acwr / ACWR_SCALE_MAX) * 100)
  const markerColor = acwr > ACWR_SAFE_HIGH ? 'var(--critical)' : acwr < ACWR_SAFE_LOW ? 'var(--text-mut)' : 'var(--positive)'

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col items-center gap-2 rounded-[18px] border p-6 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <span className="font-display text-[28px] font-black" style={{ color: headlineColor }}>
          {r.headline}
        </span>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {r.note}
        </p>
      </div>

      <SectionLabel>Signals</SectionLabel>
      <div className="flex flex-col gap-3">
        {r.signals.map((s) => (
          <div
            key={s.label}
            className="flex items-start gap-3 rounded-[18px] border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SIGNAL_DOT[s.status] }} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {s.label}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-mut)' }}>
                {s.note}
              </span>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel right={<StatePill tone={LOAD_BAND[band].tone}>{LOAD_BAND[band].label}</StatePill>}>
        Acute to chronic load ratio
      </SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <span className="font-display tabnum text-[28px] font-black" style={{ color: 'var(--text)' }}>
          {acwr.toFixed(2)}
        </span>
        <div className="relative mt-4 h-2 w-full rounded-full" style={{ background: 'var(--surface-2)' }}>
          <div
            className="absolute top-0 h-2 rounded-full"
            style={{
              left: `${safeLowPct}%`,
              width: `${safeHighPct - safeLowPct}%`,
              background: 'color-mix(in srgb, var(--positive) 35%, transparent)',
            }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-full"
            style={{ left: `${markerPct}%`, background: markerColor }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px]" style={{ color: 'var(--text-mut)' }}>
          <span>0</span>
          <span>0.8 to 1.5 safe zone</span>
          <span>{ACWR_SCALE_MAX.toFixed(1)}</span>
        </div>
      </div>

      <SectionLabel>Load &amp; monotony</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Acute</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {Math.round(acute)}
          </div>
        </div>
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Chronic</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {Math.round(chronic)}
          </div>
        </div>
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Monotony</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {monotony.toFixed(1)}
          </div>
        </div>
      </div>

      <SectionLabel>30-day daily load</SectionLabel>
      <InteractiveChart
        values={days.map((d) => d.strain.dayTrimp)}
        dates={days.map((d) => d.date)}
        color="var(--strain)"
        unit="TRIMP"
      />

      <SectionLabel>Guidance</SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {guidanceFor('load', days, index)}
        </p>
      </div>
    </div>
  )
}
