// Recovery detail body: hero RecoveryRing (or a null-state when there is no
// overnight reading for the selected day), the four recovery drivers as
// DriverBars, a 30-day trend chart with the recovery band zones shaded, and a
// short guidance card. Rendered inside MetricDetailSheet by App.tsx, which
// supplies the header/back/date-nav; this component renders only the body.
import type { DayView } from '../../lib/firebase'
import { recoveryDrivers, guidanceFor } from '../../lib/detail'
import { RecoveryRing } from '../../components/RecoveryRing'
import { SectionLabel } from '../../components/SectionLabel'
import { DriverBar } from '../../components/DriverBar'
import { InteractiveChart } from '../../components/InteractiveChart'

export function RecoveryDetail({ days, index }: { days: DayView[]; index: number }) {
  const day = days[index]
  const rec = day.recovery
  const drivers = recoveryDrivers(days, index)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        {rec ? (
          <RecoveryRing score={rec.score} band={rec.band} />
        ) : (
          <div
            className="flex h-[232px] w-[232px] flex-col items-center justify-center rounded-full border text-center"
            style={{ borderColor: 'var(--border)', color: 'var(--text-mut)' }}
          >
            <span className="section-label">Recovery</span>
            <span className="mt-2 text-sm">No overnight data</span>
          </div>
        )}
      </div>

      <SectionLabel>What&apos;s driving it</SectionLabel>
      <div className="flex flex-col gap-3">
        {drivers.map((d) => (
          <DriverBar key={d.key} driver={d} />
        ))}
      </div>

      <SectionLabel>30-day trend</SectionLabel>
      <InteractiveChart
        values={days.map((d) => d.recovery?.score ?? null)}
        dates={days.map((d) => d.date)}
        color="var(--rec-high)"
        unit="of 100"
        bands={[
          { from: 0, to: 34, color: 'var(--rec-low)' },
          { from: 34, to: 67, color: 'var(--rec-mid)' },
          { from: 67, to: 100, color: 'var(--rec-high)' },
        ]}
      />

      <SectionLabel>Guidance</SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {guidanceFor('recovery', days, index)}
        </p>
      </div>
    </div>
  )
}
