// Activity screen: GradientHero header + DateNav, a hero ActivityRings
// (move/exercise/stand vs ACTIVITY_GOALS) with the three values labeled below,
// and a 2-column grid of tappable MetricCards (Steps, Active cal, Total cal,
// Exercise, Stand, Distance, Flights) each with a 14-day sparkline. Reads the
// days array and the currently selected index passed by App. Every card opens
// the matching in-depth ActivityDetail sheet via onOpenDetail.
import { Flame, Footprints, Timer, CircleDot, Route, ArrowUpToLine, Zap } from 'lucide-react'
import type { DayView, DetailKind } from '../lib/firebase'
import { ACTIVITY_GOALS } from '../lib/firebase'
import { ActivityRings } from '../components/ActivityRings'
import { GradientHero } from '../components/GradientHero'
import { SectionLabel } from '../components/SectionLabel'
import { MetricCard } from '../components/MetricCard'
import { DateNav } from '../components/DateNav'
import { Heatmap } from '../components/Heatmap'
import { series, longDate } from '../lib/uiHelpers'

export function Activity({
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
  const a = day.activity

  const move = a.activeEnergy ?? 0
  const exercise = a.exerciseMinutes ?? 0
  const stand = a.standHours ?? 0

  return (
    <div className="animate-fade-up flex flex-col gap-1">
      <GradientHero title="Activity" subtitle={longDate(day.date)}>
        <DateNav
          date={day.date}
          isLatest={isLatest}
          canGoBack={selectedIndex > 0}
          canGoForward={selectedIndex < days.length - 1}
          onBack={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          onForward={() => onSelectIndex(Math.min(days.length - 1, selectedIndex + 1))}
        />
      </GradientHero>

      <div className="glow-move glass my-4 flex flex-col items-center gap-4 px-4 py-6">
        <ActivityRings
          move={move}
          moveGoal={ACTIVITY_GOALS.moveKcal}
          exercise={exercise}
          exerciseGoal={ACTIVITY_GOALS.exerciseMin}
          stand={stand}
          standGoal={ACTIVITY_GOALS.standHours}
          size={220}
        />
        <div className="flex w-full justify-around">
          <div className="flex flex-col items-center gap-0.5">
            <span className="section-label" style={{ color: 'var(--move)' }}>
              Move
            </span>
            <span className="font-display tabnum text-lg font-black" style={{ color: 'var(--text)' }}>
              {Math.round(move)}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
                / {ACTIVITY_GOALS.moveKcal} kcal
              </span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="section-label" style={{ color: 'var(--exercise)' }}>
              Exercise
            </span>
            <span className="font-display tabnum text-lg font-black" style={{ color: 'var(--text)' }}>
              {Math.round(exercise)}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
                / {ACTIVITY_GOALS.exerciseMin} min
              </span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="section-label" style={{ color: 'var(--stand)' }}>
              Stand
            </span>
            <span className="font-display tabnum text-lg font-black" style={{ color: 'var(--text)' }}>
              {Math.round(stand)}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
                / {ACTIVITY_GOALS.standHours} hr
              </span>
            </span>
          </div>
        </div>
      </div>

      <SectionLabel>Metrics</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Footprints}
          label="Steps"
          value={a.steps != null ? Math.round(a.steps) : '--'}
          accent="var(--steps)"
          gradFrom="var(--steps-grad-from)"
          gradTo="var(--steps-grad-to)"
          series={series(days, (d) => d.activity.steps)}
          onClick={() => onOpenDetail('steps', selectedIndex)}
        />
        <MetricCard
          icon={Flame}
          label="Active cal"
          value={a.activeEnergy != null ? Math.round(a.activeEnergy) : '--'}
          unit="kcal"
          accent="var(--move)"
          gradFrom="var(--move-grad-from)"
          gradTo="var(--move-grad-to)"
          series={series(days, (d) => d.activity.activeEnergy)}
          onClick={() => onOpenDetail('activeEnergy', selectedIndex)}
        />
        <MetricCard
          icon={Zap}
          label="Total cal"
          value={a.totalEnergy != null ? Math.round(a.totalEnergy) : '--'}
          unit="kcal"
          accent="var(--move)"
          gradFrom="var(--move-grad-from)"
          gradTo="var(--move-grad-to)"
          series={series(days, (d) => d.activity.totalEnergy)}
          onClick={() => onOpenDetail('totalEnergy', selectedIndex)}
        />
        <MetricCard
          icon={Timer}
          label="Exercise"
          value={a.exerciseMinutes != null ? Math.round(a.exerciseMinutes) : '--'}
          unit="min"
          accent="var(--exercise)"
          gradFrom="var(--exercise-grad-from)"
          gradTo="var(--exercise-grad-to)"
          series={series(days, (d) => d.activity.exerciseMinutes)}
          onClick={() => onOpenDetail('exerciseMinutes', selectedIndex)}
        />
        <MetricCard
          icon={CircleDot}
          label="Stand"
          value={a.standHours != null ? Math.round(a.standHours) : '--'}
          unit="hr"
          accent="var(--stand)"
          gradFrom="var(--stand-grad-from)"
          gradTo="var(--stand-grad-to)"
          series={series(days, (d) => d.activity.standHours)}
          onClick={() => onOpenDetail('standHours', selectedIndex)}
        />
        <MetricCard
          icon={Route}
          label="Distance"
          value={a.distanceKm != null ? a.distanceKm.toFixed(1) : '--'}
          unit="km"
          accent="var(--distance)"
          gradFrom="var(--distance-grad-from)"
          gradTo="var(--distance-grad-to)"
          series={series(days, (d) => d.activity.distanceKm)}
          onClick={() => onOpenDetail('distanceKm', selectedIndex)}
        />
        <MetricCard
          icon={ArrowUpToLine}
          label="Flights"
          value={a.flights != null ? Math.round(a.flights) : '--'}
          accent="var(--flights)"
          gradFrom="var(--flights-grad-from)"
          gradTo="var(--flights-grad-to)"
          series={series(days, (d) => d.activity.flights)}
          onClick={() => onOpenDetail('flights', selectedIndex)}
        />
      </div>

      <SectionLabel>Steps history</SectionLabel>
      <div className="glass p-4">
        <Heatmap
          values={series(days, (d) => d.activity.steps, days.length)}
          dates={days.map((d) => d.date)}
          color="var(--steps)"
        />
      </div>
    </div>
  )
}
