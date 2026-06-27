// Simple metric detail body shared by HRV, Resting HR, and Respiratory: the
// day's value, a vs-baseline readout (mean + z-score), a 30-day trend chart,
// and a short interpretation line drawn from the matching recovery Driver.
// Rendered inside MetricDetailSheet by App.tsx; this component renders only
// the body (no header/back/date-nav).
import type { DayView } from '../../lib/firebase'
import { recoveryDrivers } from '../../lib/detail'
import type { Driver } from '../../lib/detail'
import { SectionLabel } from '../../components/SectionLabel'
import { InteractiveChart } from '../../components/InteractiveChart'

type SimpleMetric = 'hrv' | 'rhr' | 'respiratory'

const DRIVER_KEY: Record<SimpleMetric, Driver['key']> = {
  hrv: 'hrv',
  rhr: 'rhr',
  respiratory: 'respiratory',
}

const METRIC_LABEL: Record<SimpleMetric, string> = {
  hrv: 'HRV',
  rhr: 'Resting HR',
  respiratory: 'Respiratory rate',
}

const METRIC_COLOR: Record<SimpleMetric, string> = {
  hrv: 'var(--rec-high)',
  rhr: 'var(--rec-mid)',
  respiratory: 'var(--gold)',
}

function pick(metric: SimpleMetric, d: DayView): number | null {
  if (metric === 'hrv') return d.hrvMs
  if (metric === 'rhr') return d.restingHr
  return d.respiratoryRate
}

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '--'
  return unit === 'ms' || unit === 'bpm' ? Math.round(value).toString() : value.toFixed(1)
}

function interpretation(driver: Driver, metric: SimpleMetric): string {
  if (driver.value == null) return `No ${METRIC_LABEL[metric].toLowerCase()} reading for this day.`
  if (driver.direction === 'flat') return `${METRIC_LABEL[metric]} is near your baseline today.`
  if (metric === 'rhr' || metric === 'respiratory') {
    return driver.z > 0
      ? `${METRIC_LABEL[metric]} is elevated today, which can be a sign of incomplete recovery.`
      : `${METRIC_LABEL[metric]} is lower than usual today, a good sign for recovery.`
  }
  return driver.z > 0
    ? `${METRIC_LABEL[metric]} is above your baseline today, supporting recovery.`
    : `${METRIC_LABEL[metric]} is below your baseline today, which can suppress recovery.`
}

export function SimpleMetricDetail({
  days,
  index,
  metric,
}: {
  days: DayView[]
  index: number
  metric: SimpleMetric
}) {
  const drivers = recoveryDrivers(days, index)
  const driver = drivers.find((d) => d.key === DRIVER_KEY[metric])!
  const color = METRIC_COLOR[metric]

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col items-center gap-1 rounded-[18px] border p-6 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <span className="section-label" style={{ color }}>
          {METRIC_LABEL[metric]}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display tabnum text-[40px] font-black leading-none" style={{ color: 'var(--text)' }}>
            {formatValue(driver.value, driver.unit)}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
            {driver.unit}
          </span>
        </div>
        {driver.mean != null && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-mut)' }}>
            vs baseline {formatValue(driver.mean, driver.unit)} {driver.unit}, {driver.z >= 0 ? '+' : ''}
            {driver.z.toFixed(1)} sd
          </p>
        )}
      </div>

      <SectionLabel>30-day trend</SectionLabel>
      <InteractiveChart
        values={days.map((d) => pick(metric, d))}
        dates={days.map((d) => d.date)}
        color={color}
        unit={driver.unit}
      />

      <SectionLabel>What this means</SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {interpretation(driver, metric)}
        </p>
      </div>
    </div>
  )
}
