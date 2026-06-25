// Sleep detail body: need vs actual + sleep debt, a per-stage breakdown table
// with healthy-range pills, restorative/efficiency/consistency readouts, a
// 30-day sleep-score trend, and guidance. Rendered inside MetricDetailSheet by
// App.tsx; this component renders only the body (no header/back/date-nav).
import type { DayView } from '../../lib/firebase'
import { sleepArchitecture, sleepDebtHours, guidanceFor } from '../../lib/detail'
import type { StagePart } from '../../lib/detail'
import { SectionLabel } from '../../components/SectionLabel'
import { StatePill } from '../../components/StatePill'
import { InteractiveChart } from '../../components/InteractiveChart'
import { hoursMinutes } from '../../lib/uiHelpers'

function rangeTone(part: StagePart): { label: string; tone: 'positive' | 'warning' | 'critical' } {
  if (part.inRange) return { label: 'In range', tone: 'positive' }
  if (part.pct < part.healthyLow) return { label: 'Low', tone: 'warning' }
  return { label: 'High', tone: 'critical' }
}

export function SleepDetail({ days, index }: { days: DayView[]; index: number }) {
  const day = days[index]
  const sleep = day.sleep

  if (!sleep) {
    return (
      <div className="flex flex-col">
        <SectionLabel>Sleep</SectionLabel>
        <div
          className="rounded-[18px] border p-4 text-center text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-mut)' }}
        >
          No sleep data for this night.
        </div>
        <SectionLabel>30-day trend</SectionLabel>
        <InteractiveChart
          values={days.map((d) => d.sleep?.score ?? null)}
          dates={days.map((d) => d.date)}
          color="var(--sleep)"
          unit="of 100"
        />
      </div>
    )
  }

  const { parts, restorativePct, asleepMinutes } = sleepArchitecture(day)
  const debt = sleepDebtHours(days, index)
  const actualHours = asleepMinutes / 60
  const efficiencyPct = Math.round(sleep.efficiency * 100)
  const consistencyPct = Math.round(sleep.consistency * 100)

  return (
    <div className="flex flex-col">
      <SectionLabel>Need vs actual</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label" style={{ color: 'var(--gold)' }}>
            Need
          </span>
          <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
            {sleep.needHours.toFixed(1)}h
          </div>
        </div>
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label" style={{ color: 'var(--sleep)' }}>
            Actual
          </span>
          <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
            {actualHours.toFixed(1)}h
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--text-mut)' }}>
        {debt > 1
          ? `Carrying about ${debt.toFixed(1)} hours of sleep debt over the last week.`
          : 'No meaningful sleep debt over the last week.'}
      </p>

      <SectionLabel>Stage breakdown</SectionLabel>
      <div className="flex flex-col gap-3">
        {parts.map((p) => {
          const r = rangeTone(p)
          return (
            <div
              key={p.stage}
              className="flex items-center justify-between gap-3 rounded-[18px] border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {p.stage}
                </span>
                <span className="tabnum text-xs" style={{ color: 'var(--text-mut)' }}>
                  {hoursMinutes(p.minutes)}, {Math.round(p.pct)}%
                </span>
              </div>
              <StatePill tone={r.tone}>{r.label}</StatePill>
            </div>
          )
        })}
      </div>

      <SectionLabel>Quality</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Restorative</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {Math.round(restorativePct)}%
          </div>
        </div>
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Efficiency</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {efficiencyPct}%
          </div>
        </div>
        <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="section-label">Consistency</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {consistencyPct}%
          </div>
        </div>
      </div>

      <SectionLabel>30-day trend</SectionLabel>
      <InteractiveChart
        values={days.map((d) => d.sleep?.score ?? null)}
        dates={days.map((d) => d.date)}
        color="var(--sleep)"
        unit="of 100"
      />

      <SectionLabel>Guidance</SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {guidanceFor('sleep', days, index)}
        </p>
      </div>
    </div>
  )
}
