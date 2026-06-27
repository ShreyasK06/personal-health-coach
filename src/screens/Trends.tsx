// Trends screen: full-history line charts of recovery, strain, sleep, and HRV
// over every available day. Each metric gets a tappable card with its latest
// value, an average, and a wide SVG line built from the Sparkline component;
// tapping a card opens that metric's in-depth detail sheet at the latest day.
// Reads the days array passed by App.
import type { DayView, DetailKind } from '../lib/firebase'
import { GradientHero } from '../components/GradientHero'
import { AreaChart } from '../components/AreaChart'
import { Heatmap } from '../components/Heatmap'
import { SectionLabel } from '../components/SectionLabel'

interface TrendDef {
  label: string
  color: string
  gradFrom: string
  gradTo: string
  unit: string
  pick: (d: DayView) => number | null
  decimals: number
  kind: DetailKind
}

const TRENDS: TrendDef[] = [
  {
    label: 'Recovery',
    color: 'var(--rec-high)',
    gradFrom: 'var(--rec-high-grad-from)',
    gradTo: 'var(--rec-high-grad-to)',
    unit: 'of 100',
    pick: (d) => d.recovery?.score ?? null,
    decimals: 0,
    kind: 'recovery',
  },
  {
    label: 'Strain',
    color: 'var(--strain)',
    gradFrom: 'var(--strain-grad-from)',
    gradTo: 'var(--strain-grad-to)',
    unit: 'of 21',
    pick: (d) => d.strain.strain,
    decimals: 1,
    kind: 'strain',
  },
  {
    label: 'Sleep',
    color: 'var(--sleep)',
    gradFrom: 'var(--sleep-grad-from)',
    gradTo: 'var(--sleep-grad-to)',
    unit: 'of 100',
    pick: (d) => d.sleep?.score ?? null,
    decimals: 0,
    kind: 'sleep',
  },
  {
    label: 'HRV',
    color: 'var(--gold)',
    gradFrom: 'var(--gold-grad-from)',
    gradTo: 'var(--gold-grad-to)',
    unit: 'ms',
    pick: (d) => d.hrvMs,
    decimals: 0,
    kind: 'hrv',
  },
]

function avg(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (present.length === 0) return null
  return present.reduce((a, v) => a + v, 0) / present.length
}

function latest(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

export function Trends({
  days,
  onOpenDetail,
}: {
  days: DayView[]
  onOpenDetail: (kind: DetailKind, index: number) => void
}) {
  const span = days.length
  const latestIndex = days.length - 1
  const dates = days.map((d) => d.date)
  const recoveryValues = days.map((d) => d.recovery?.score ?? null)

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <GradientHero title="Trends" subtitle={`Last ${span} ${span === 1 ? 'day' : 'days'} of data`} />

      <SectionLabel>History</SectionLabel>
      <div className="flex flex-col gap-3">
        {TRENDS.map((t) => {
          const values = days.map(t.pick)
          const last = latest(values)
          const mean = avg(values)
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => onOpenDetail(t.kind, latestIndex)}
              className="glass w-full p-4 text-left transition-colors"
              style={{ boxShadow: `0 0 20px -8px color-mix(in srgb, ${t.color} 50%, transparent)` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <span className="section-label" style={{ color: t.color }}>
                    {t.label}
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className="font-display tabnum text-[28px] font-black leading-none"
                      style={{ color: 'var(--text)' }}
                    >
                      {last != null ? last.toFixed(t.decimals) : '--'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-mut)' }}>
                      {t.unit}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="section-label">Average</div>
                  <div className="tabnum mt-1 text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>
                    {mean != null ? mean.toFixed(t.decimals) : '--'}
                  </div>
                </div>
              </div>
              <AreaChart
                values={values}
                dates={dates}
                color={t.color}
                gradFrom={t.gradFrom}
                gradTo={t.gradTo}
                unit={t.unit}
              />
            </button>
          )
        })}
      </div>

      <SectionLabel>Recovery history</SectionLabel>
      <div className="glow-exercise glass p-4">
        <Heatmap values={recoveryValues} dates={dates} color="var(--rec-high)" />
      </div>
    </div>
  )
}
