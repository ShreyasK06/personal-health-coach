// Strain detail body: hero Gauge of the day's strain (0..21), a per-session
// TRIMP breakdown (or an empty-state card), a 30-day strain trend, and
// guidance. Rendered inside MetricDetailSheet by App.tsx; this component
// renders only the body (no header/back/date-nav).
import type { DayView } from '../../lib/firebase'
import { guidanceFor } from '../../lib/detail'
import { Gauge } from '../../components/Gauge'
import { SectionLabel } from '../../components/SectionLabel'
import { InteractiveChart } from '../../components/InteractiveChart'

const STRAIN_MAX = 21

export function StrainDetail({ days, index }: { days: DayView[]; index: number }) {
  const day = days[index]
  const sessions = day.strain.sessions

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col items-center rounded-[18px] border px-4 py-6"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <Gauge value={day.strain.strain} max={STRAIN_MAX} color="var(--strain)" label={`of ${STRAIN_MAX}`} size={264} />
      </div>

      <SectionLabel>Sessions</SectionLabel>
      {sessions.length === 0 ? (
        <div
          className="rounded-[18px] border p-4 text-center text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-mut)' }}
        >
          No workouts recorded. Enable Workouts in Health Auto Export to score your sessions.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s, i) => (
            <div
              key={`${s.type}-${i}`}
              className="flex items-center justify-between rounded-[18px] border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {s.type}
              </span>
              <span className="tabnum text-sm font-bold" style={{ color: 'var(--strain)' }}>
                {Math.round(s.trimp)} TRIMP
              </span>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>30-day trend</SectionLabel>
      <InteractiveChart
        values={days.map((d) => d.strain.strain)}
        dates={days.map((d) => d.date)}
        color="var(--strain)"
        unit={`of ${STRAIN_MAX}`}
      />

      <SectionLabel>Guidance</SectionLabel>
      <div className="rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {guidanceFor('strain', days, index)}
        </p>
      </div>
    </div>
  )
}
