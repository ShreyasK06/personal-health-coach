// Sleep screen: a DateNav pill for stepping between nights, the selected
// night rendered as a semicircle performance Gauge (sleep.score / Optimal),
// a sleep debt card, a sub-scores row (Performance / Consistency /
// Restorative / Efficiency), an asleep -> wake time row, a colored stage
// breakdown bar (deep / core / rem / awake, zero-minute stages filtered
// out), a sleep score trend wrapped in a ChartCard, and a closing guidance
// line. Reads the days array and the currently selected index passed by
// App. Tapping the Gauge opens the in-depth Sleep detail sheet via
// onOpenDetail. Every section is gated behind data presence so a sparse
// night produces a short page, not a long scroll of empty placeholders.
import type { DayView, DetailKind } from '../lib/firebase'
import { Gauge } from '../components/Gauge'
import { GradientHero } from '../components/GradientHero'
import { AreaChart } from '../components/AreaChart'
import { ChartCard } from '../components/ChartCard'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { SectionLabel } from '../components/SectionLabel'
import { DateNav } from '../components/DateNav'
import { sleepDebtHours, guidanceFor } from '../lib/detail'
import { clockOf, hoursMinutes, longDate } from '../lib/uiHelpers'

const SLEEP_GAUGE_SIZE = 200

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

const SUB_SCORES: { key: 'performance' | 'consistency' | 'restorative' | 'efficiency'; label: string }[] = [
  { key: 'performance', label: 'Performance' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'restorative', label: 'Restorative' },
  { key: 'efficiency', label: 'Efficiency' },
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
  })).filter((s) => s.minutes > 0)
  const total = stageValues.reduce((a, s) => a + s.minutes, 0)

  const asleep = clockOf(day.bedTime)
  const wake = clockOf(day.wakeTime)

  const debt = sleepDebtHours(days, selectedIndex)
  const scoreValues = days.map((d) => d.sleep?.score ?? null)
  const dates = days.map((d) => d.date)

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <GradientHero title="Sleep" subtitle={`${isLatest ? 'Last night, ' : ''}${longDate(day.date)}`}>
        <DateNav
          date={day.date}
          isLatest={isLatest}
          canGoBack={selectedIndex > 0}
          canGoForward={selectedIndex < days.length - 1}
          onBack={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          onForward={() => onSelectIndex(Math.min(days.length - 1, selectedIndex + 1))}
        />
      </GradientHero>

      {sleep ? (
        <div className="flex justify-center">
          <Gauge
            value={sleep.score}
            max={100}
            color="var(--sleep)"
            label="of 100"
            caption={sleepWord(sleep.score)}
            size={SLEEP_GAUGE_SIZE}
            onClick={() => onOpenDetail('sleep', selectedIndex)}
          />
        </div>
      ) : (
        <EmptyState message="No sleep data for last night" />
      )}

      {sleep && (
        <>
          {debt > 0.1 && (
            <Card tone="surface">
              <div className="flex flex-col gap-1">
                <span className="text-label" style={{ color: 'var(--text-mut)' }}>
                  Sleep debt
                </span>
                <span className="font-display tabnum text-display-sm" style={{ color: 'var(--sleep)' }}>
                  {debt.toFixed(1)}h debt over 7 nights
                </span>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <SectionLabel>Sub-scores</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {SUB_SCORES.map((s) => (
                <Card key={s.key} tone="surface">
                  <div className="flex flex-col gap-1">
                    <span className="text-label" style={{ color: 'var(--text-mut)' }}>
                      {s.label}
                    </span>
                    <span className="font-display tabnum text-display-sm" style={{ color: 'var(--text)' }}>
                      {Math.round(sleep[s.key] * 100)}%
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {(asleep || wake) && (
            <div className="flex flex-col gap-3">
              <SectionLabel>Schedule</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Card tone="surface">
                  <span className="section-label" style={{ color: 'var(--sleep)' }}>
                    Asleep
                  </span>
                  <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
                    {asleep ?? '--'}
                  </div>
                </Card>
                <Card tone="surface">
                  <span className="section-label" style={{ color: 'var(--gold)' }}>
                    Wake
                  </span>
                  <div className="font-display tabnum mt-2 text-[28px] font-black" style={{ color: 'var(--text)' }}>
                    {wake ?? '--'}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {stageValues.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionLabel right={`${hoursMinutes(day.asleepMinutes)} asleep`}>Stage breakdown</SectionLabel>
              <Card tone="surface">
                <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  {stageValues.map((s) => (
                    <div key={s.label} style={{ width: `${(s.minutes / total) * 100}%`, background: s.color }} />
                  ))}
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
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <SectionLabel>Sleep score trend</SectionLabel>
            <ChartCard minBodyHeight={220}>
              <AreaChart
                values={scoreValues}
                dates={dates}
                color="var(--sleep)"
                gradFrom="var(--sleep-grad-from)"
                gradTo="var(--sleep-grad-to)"
                unit="of 100"
              />
            </ChartCard>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-mut)' }}>
            {guidanceFor('sleep', days, selectedIndex)}
          </p>
        </>
      )}
    </div>
  )
}
