// Activity metric detail body shared by all activity DetailKinds (steps,
// activeEnergy, totalEnergy, exerciseMinutes, standHours, distanceKm,
// flights): the day's big value, a BarChart (counts/calories/flights) or
// AreaChart (distance/stand) trend with a range selector, a Heatmap over
// time, and summary stats (today, 7-day avg, 30-day total/avg, best day).
// Rendered inside MetricDetailSheet by App.tsx; this component renders only
// the body (no header/back/date-nav).
import type { DayView, DetailKind } from '../../lib/firebase'
import { SectionLabel } from '../../components/SectionLabel'
import { BarChart } from '../../components/BarChart'
import { AreaChart } from '../../components/AreaChart'
import { Heatmap } from '../../components/Heatmap'

type ActivityMetric = Extract<
  DetailKind,
  'steps' | 'activeEnergy' | 'totalEnergy' | 'exerciseMinutes' | 'standHours' | 'distanceKm' | 'flights'
>

interface MetricSpec {
  label: string
  unit?: string
  color: string
  gradFrom: string
  gradTo: string
  chart: 'bar' | 'area'
  decimals: number
  pick: (d: DayView) => number | null
}

const SPECS: Record<ActivityMetric, MetricSpec> = {
  steps: {
    label: 'Steps',
    color: 'var(--steps)',
    gradFrom: 'var(--steps-grad-from)',
    gradTo: 'var(--steps-grad-to)',
    chart: 'bar',
    decimals: 0,
    pick: (d) => d.activity.steps,
  },
  activeEnergy: {
    label: 'Active calories',
    unit: 'kcal',
    color: 'var(--move)',
    gradFrom: 'var(--move-grad-from)',
    gradTo: 'var(--move-grad-to)',
    chart: 'bar',
    decimals: 0,
    pick: (d) => d.activity.activeEnergy,
  },
  totalEnergy: {
    label: 'Total calories',
    unit: 'kcal',
    color: 'var(--move)',
    gradFrom: 'var(--move-grad-from)',
    gradTo: 'var(--move-grad-to)',
    chart: 'bar',
    decimals: 0,
    pick: (d) => d.activity.totalEnergy,
  },
  exerciseMinutes: {
    label: 'Exercise',
    unit: 'min',
    color: 'var(--exercise)',
    gradFrom: 'var(--exercise-grad-from)',
    gradTo: 'var(--exercise-grad-to)',
    chart: 'bar',
    decimals: 0,
    pick: (d) => d.activity.exerciseMinutes,
  },
  standHours: {
    label: 'Stand',
    unit: 'hr',
    color: 'var(--stand)',
    gradFrom: 'var(--stand-grad-from)',
    gradTo: 'var(--stand-grad-to)',
    chart: 'area',
    decimals: 0,
    pick: (d) => d.activity.standHours,
  },
  distanceKm: {
    label: 'Distance',
    unit: 'km',
    color: 'var(--distance)',
    gradFrom: 'var(--distance-grad-from)',
    gradTo: 'var(--distance-grad-to)',
    chart: 'area',
    decimals: 1,
    pick: (d) => d.activity.distanceKm,
  },
  flights: {
    label: 'Flights',
    color: 'var(--flights)',
    gradFrom: 'var(--flights-grad-from)',
    gradTo: 'var(--flights-grad-to)',
    chart: 'bar',
    decimals: 0,
    pick: (d) => d.activity.flights,
  },
}

function formatStat(v: number | null, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return '--'
  return v.toFixed(decimals)
}

export function ActivityDetail({ days, index, metric }: { days: DayView[]; index: number; metric: ActivityMetric }) {
  const spec = SPECS[metric]
  const values = days.map(spec.pick)
  const dates = days.map((d) => d.date)
  const today = values[index]

  const present = values.filter((v): v is number => v != null && Number.isFinite(v))
  const last7 = values.slice(Math.max(0, index - 6), index + 1).filter((v): v is number => v != null)
  const last30 = values.slice(Math.max(0, index - 29), index + 1).filter((v): v is number => v != null)

  const avg7 = last7.length ? last7.reduce((a, v) => a + v, 0) / last7.length : null
  const total30 = last30.length ? last30.reduce((a, v) => a + v, 0) : null
  const avg30 = last30.length ? total30! / last30.length : null
  const best = present.length ? Math.max(...present) : null

  return (
    <div className="flex flex-col gap-6">
      <div
        className="glass flex flex-col items-center gap-1 p-6 text-center"
        style={{ boxShadow: `0 0 28px -6px color-mix(in srgb, ${spec.color} 50%, transparent)` }}
      >
        <span className="section-label" style={{ color: spec.color }}>
          {spec.label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display tabnum text-[40px] font-black leading-none" style={{ color: 'var(--text)' }}>
            {formatStat(today, spec.decimals)}
          </span>
          {spec.unit && (
            <span className="text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
              {spec.unit}
            </span>
          )}
        </div>
      </div>

      <SectionLabel>Trend</SectionLabel>
      {spec.chart === 'bar' ? (
        <BarChart
          values={values}
          dates={dates}
          color={spec.color}
          gradFrom={spec.gradFrom}
          gradTo={spec.gradTo}
          unit={spec.unit}
        />
      ) : (
        <AreaChart
          values={values}
          dates={dates}
          color={spec.color}
          gradFrom={spec.gradFrom}
          gradTo={spec.gradTo}
          unit={spec.unit}
        />
      )}

      <SectionLabel>History</SectionLabel>
      <div className="glass p-4">
        <Heatmap values={values} dates={dates} color={spec.color} />
      </div>

      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <span className="section-label">Today</span>
          <div className="font-display tabnum mt-2 text-[24px] font-black" style={{ color: 'var(--text)' }}>
            {formatStat(today, spec.decimals)}
          </div>
        </div>
        <div className="glass p-4">
          <span className="section-label">7-day avg</span>
          <div className="font-display tabnum mt-2 text-[24px] font-black" style={{ color: 'var(--text)' }}>
            {formatStat(avg7, spec.decimals)}
          </div>
        </div>
        <div className="glass p-4">
          <span className="section-label">30-day total</span>
          <div className="font-display tabnum mt-2 text-[24px] font-black" style={{ color: 'var(--text)' }}>
            {formatStat(total30, spec.decimals)}
          </div>
        </div>
        <div className="glass p-4">
          <span className="section-label">30-day avg</span>
          <div className="font-display tabnum mt-2 text-[24px] font-black" style={{ color: 'var(--text)' }}>
            {formatStat(avg30, spec.decimals)}
          </div>
        </div>
        <div
          className="glass col-span-2 p-4"
          style={{ boxShadow: `0 0 24px -6px color-mix(in srgb, ${spec.color} 45%, transparent)` }}
        >
          <span className="section-label" style={{ color: spec.color }}>
            Best day
          </span>
          <div className="font-display tabnum mt-2 text-[24px] font-black" style={{ color: 'var(--text)' }}>
            {formatStat(best, spec.decimals)}
            {spec.unit && (
              <span className="ml-1.5 text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
                {spec.unit}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
