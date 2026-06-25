// Trends screen: full-history line charts of recovery, strain, sleep, and HRV
// over every available day. Each metric gets a card with its latest value, an
// average, and a wide SVG line built from the Sparkline component. Reads the
// days array passed by App.
import type { DayView } from '../lib/firebase'
import { Sparkline } from '../components/Sparkline'
import { SectionLabel } from '../components/SectionLabel'

interface TrendDef {
  label: string
  color: string
  unit: string
  pick: (d: DayView) => number | null
  decimals: number
}

const TRENDS: TrendDef[] = [
  { label: 'Recovery', color: 'var(--rec-high)', unit: 'of 100', pick: (d) => d.recovery?.score ?? null, decimals: 0 },
  { label: 'Strain', color: 'var(--strain)', unit: 'of 21', pick: (d) => d.strain.strain, decimals: 1 },
  { label: 'Sleep', color: 'var(--sleep)', unit: 'of 100', pick: (d) => d.sleep?.score ?? null, decimals: 0 },
  { label: 'HRV', color: 'var(--gold)', unit: 'ms', pick: (d) => d.hrvMs, decimals: 0 },
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

export function Trends({ days }: { days: DayView[] }) {
  const span = days.length

  return (
    <div className="animate-fade-up flex flex-col">
      <header className="mb-2">
        <h1 className="font-display text-[34px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          Trends
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-mut)' }}>
          Last {span} {span === 1 ? 'day' : 'days'} of data
        </p>
      </header>

      <SectionLabel>History</SectionLabel>
      <div className="flex flex-col gap-3">
        {TRENDS.map((t) => {
          const values = days.map(t.pick)
          const last = latest(values)
          const mean = avg(values)
          return (
            <div
              key={t.label}
              className="rounded-[18px] border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
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
              <Sparkline values={values} color={t.color} width={388} height={64} strokeWidth={2.2} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
