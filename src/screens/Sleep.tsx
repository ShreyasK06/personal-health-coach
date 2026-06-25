// Sleep screen: a DateNav pill for stepping between nights, the selected
// night rendered as a semicircle performance Gauge (sleep.score / Optimal),
// an asleep -> wake time row, a colored stage breakdown bar (deep / core /
// rem / awake) with total asleep time, and the efficiency percentage. Reads
// the days array and the currently selected index passed by App. Tapping the
// Gauge opens the in-depth Sleep detail sheet via onOpenDetail.
import type { DayView, DetailKind } from '../lib/firebase'
import { Gauge } from '../components/Gauge'
import { SectionLabel } from '../components/SectionLabel'
import { StatePill } from '../components/StatePill'
import { DateNav } from '../components/DateNav'
import { clockOf, hoursMinutes, longDate } from '../lib/uiHelpers'

function sleepWord(score: number): string {
  if (score >= 85) return 'Optimal'
  if (score >= 70) return 'Sufficient'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

const STAGES: {
  key: keyof Pick<DayView, 'deepMinutes' | 'coreMinutes' | 'remMinutes' | 'awakeMinutes'>
  label: string
  color: string
}[] = [
  { key: 'deepMinutes', label: 'Deep', color: 'var(--sleep-deep)' },
  { key: 'coreMinutes', label: 'Core', color: 'var(--sleep)' },
  { key: 'remMinutes', label: 'REM', color: 'var(--sleep-rem)' },
  { key: 'awakeMinutes', label: 'Awake', color: 'var(--text-mut)' },
]

export function Sleep({
  days,
  selectedIndex,
  onSelectIndex,
  onOpenDetail,
}: {
  days: DayView[]
  selectedIndex: number
  onSelectIndex: (i: number) => void
  onOpenDetail: (kind: DetailKind, index: number) => void
}) {
  const day = days[selectedIndex]
  const isLatest = selectedIndex === days.length - 1
  const sleep = day.sleep

  const stageValues = STAGES.map((s) => ({
    label: s.label,
    color: s.color,
    minutes: Math.max(0, day[s.key] ?? 0),
  }))
  const total = stageValues.reduce((a, s) => a + s.minutes, 0)

  const asleep = clockOf(day.bedTime)
  const wake = clockOf(day.wakeTime)
  const efficiencyPct = sleep ? Math.round(sleep.efficiency * 100) : null

  return (
    <div className="animate-fade-up flex flex-col">
      <header className="mb-2 flex flex-col">
        <h1 className="font-display text-[34px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          Sleep
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-mut)' }}>
          {isLatest ? 'Last night, ' : ''}
          {longDate(day.date)}
        </p>
        <DateNav
          date={day.date}
          isLatest={isLatest}
          canGoBack={selectedIndex > 0}
          canGoForward={selectedIndex < days.length - 1}
          onBack={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          onForward={() => onSelectIndex(Math.min(days.length - 1, selectedIndex + 1))}
        />
      </header>

      <SectionLabel>Sleep performance</SectionLabel>
      <div
        className="flex flex-col items-center rounded-[18px] border px-4 py-6"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {sleep ? (
          <Gauge
            value={sleep.score}
            max={100}
            color="var(--sleep)"
            label="of 100"
            caption={sleepWord(sleep.score)}
            size={264}
            onClick={() => onOpenDetail('sleep', selectedIndex)}
          />
        ) : (
          <div className="py-12 text-sm" style={{ color: 'var(--text-mut)' }}>
            No sleep data for last night.
          </div>
        )}
      </div>

      {sleep && (
        <>
          <SectionLabel>Schedule</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-[18px] border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <span className="section-label" style={{ color: 'var(--sleep)' }}>
                Asleep
              </span>
              <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
                {asleep ?? '--'}
              </div>
            </div>
            <div
              className="rounded-[18px] border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <span className="section-label" style={{ color: 'var(--gold)' }}>
                Wake
              </span>
              <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
                {wake ?? '--'}
              </div>
            </div>
          </div>

          <SectionLabel right={`${hoursMinutes(day.asleepMinutes)} asleep`}>Stage breakdown</SectionLabel>
          <div
            className="rounded-[18px] border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
              {total > 0 &&
                stageValues.map((s) =>
                  s.minutes > 0 ? (
                    <div key={s.label} style={{ width: `${(s.minutes / total) * 100}%`, background: s.color }} />
                  ) : null,
                )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-3">
              {stageValues.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
                    {s.label}
                  </span>
                  <span className="tabnum ml-auto mr-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {hoursMinutes(s.minutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <SectionLabel>Efficiency</SectionLabel>
          <div
            className="flex items-center justify-between rounded-[18px] border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="font-display tabnum text-[32px] font-black" style={{ color: 'var(--text)' }}>
                {efficiencyPct ?? '--'}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-mut)' }}>
                % time asleep in bed
              </span>
            </div>
            {efficiencyPct != null && (
              <StatePill tone={efficiencyPct >= 90 ? 'positive' : efficiencyPct >= 80 ? 'sleep' : 'warning'}>
                {efficiencyPct >= 90 ? 'Solid' : efficiencyPct >= 80 ? 'Good' : 'Restless'}
              </StatePill>
            )}
          </div>
        </>
      )}
    </div>
  )
}
