// Today screen: greeting header + date, a DateNav pill for stepping between
// days, the hero RecoveryRing, a rule-based "Today's Synthesis" card, a
// tappable Readiness card, and an "AT A GLANCE" 2-column grid of StatTiles
// (Recovery, Strain, Sleep, HRV, Resting HR, Respiratory) each with a 14-day
// sparkline. Reads the days array and the currently selected index passed by
// App. Every tile/ring/gauge/card opens the matching in-depth detail sheet via
// onOpenDetail.
import { Flame, Footprints } from 'lucide-react'
import type { DayView, DetailKind } from '../lib/firebase'
import { ACTIVITY_GOALS } from '../lib/firebase'
import { RecoveryRing } from '../components/RecoveryRing'
import { ActivityRings } from '../components/ActivityRings'
import { GradientHero } from '../components/GradientHero'
import { SectionLabel } from '../components/SectionLabel'
import { StatTile } from '../components/StatTile'
import { MetricCard } from '../components/MetricCard'
import { SynthesisCard } from '../components/SynthesisCard'
import { StatePill } from '../components/StatePill'
import { DateNav } from '../components/DateNav'
import { Gauge } from '../components/Gauge'
import { buildSynthesis } from '../lib/synthesis'
import { readiness } from '../lib/detail'
import {
  series,
  REC_BAND_COLOR,
  REC_BAND_TONE,
  REC_BAND_WORD,
  LOAD_BAND,
  strainWord,
  greeting,
  longDate,
} from '../lib/uiHelpers'

const STRAIN_MAX = 21

const READINESS_TONE_COLOR: Record<'positive' | 'warning' | 'critical' | 'sleep', string> = {
  positive: 'var(--positive)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  sleep: 'var(--sleep)',
}

export function Today({
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
  const rec = day.recovery
  const accent = rec ? REC_BAND_COLOR[rec.band] : 'var(--gold)'

  const sleepScore = day.sleep ? Math.round(day.sleep.score) : null
  const ready = readiness(days, selectedIndex)
  const readinessColor = READINESS_TONE_COLOR[ready.tone]
  const a = day.activity

  return (
    <div className="animate-fade-up flex flex-col gap-1">
      <GradientHero title={isLatest ? greeting() : 'Looking back'} subtitle={longDate(day.date)}>
        <DateNav
          date={day.date}
          isLatest={isLatest}
          canGoBack={selectedIndex > 0}
          canGoForward={selectedIndex < days.length - 1}
          onBack={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          onForward={() => onSelectIndex(Math.min(days.length - 1, selectedIndex + 1))}
        />
      </GradientHero>

      {/* hero ring */}
      <div className="my-4 flex justify-center">
        {rec ? (
          <RecoveryRing score={rec.score} band={rec.band} onClick={() => onOpenDetail('recovery', selectedIndex)} />
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

      <SectionLabel>Move</SectionLabel>
      <div className="flex flex-col items-center gap-3 rounded-[18px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <ActivityRings
          move={a.activeEnergy ?? 0}
          moveGoal={ACTIVITY_GOALS.moveKcal}
          exercise={a.exerciseMinutes ?? 0}
          exerciseGoal={ACTIVITY_GOALS.exerciseMin}
          stand={a.standHours ?? 0}
          standGoal={ACTIVITY_GOALS.standHours}
          size={140}
        />
        <div className="grid w-full grid-cols-2 gap-3">
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
        </div>
      </div>

      <SectionLabel
        right={rec ? <StatePill tone={REC_BAND_TONE[rec.band]}>{REC_BAND_WORD[rec.band]}</StatePill> : undefined}
      >
        Today&apos;s Synthesis
      </SectionLabel>
      <SynthesisCard text={buildSynthesis(day)} accent={accent} />

      <SectionLabel>Readiness</SectionLabel>
      <button
        type="button"
        onClick={() => onOpenDetail('load', selectedIndex)}
        className="flex flex-col gap-2 rounded-[18px] border p-4 text-left transition-colors"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-black" style={{ color: readinessColor }}>
            {ready.headline}
          </span>
          <StatePill tone={LOAD_BAND[day.load.band].tone}>{LOAD_BAND[day.load.band].label}</StatePill>
        </div>
        <span className="tabnum text-xs" style={{ color: 'var(--text-mut)' }}>
          Load ratio {day.load.acwr.toFixed(2)}
        </span>
      </button>

      <SectionLabel>Strain</SectionLabel>
      <div
        className="flex flex-col items-center rounded-[18px] border px-4 py-6"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <Gauge
          value={day.strain.strain}
          max={STRAIN_MAX}
          color="var(--strain)"
          label={`of ${STRAIN_MAX}`}
          caption={strainWord(day.strain.strain)}
          size={264}
          onClick={() => onOpenDetail('strain', selectedIndex)}
        />
      </div>

      <SectionLabel>At a glance</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Recovery"
          value={rec ? `${Math.round(rec.score)}` : '--'}
          unit="of 100"
          series={series(days, (d) => d.recovery?.score ?? null)}
          sparkColor={accent}
          state={rec ? REC_BAND_WORD[rec.band] : undefined}
          stateColor={accent}
          onClick={() => onOpenDetail('recovery', selectedIndex)}
        />
        <StatTile
          label="Strain"
          value={day.strain.strain.toFixed(1)}
          unit="of 21"
          series={series(days, (d) => d.strain.strain)}
          sparkColor="var(--strain)"
          state={strainWord(day.strain.strain)}
          stateColor="var(--strain)"
          onClick={() => onOpenDetail('strain', selectedIndex)}
        />
        <StatTile
          label="Sleep"
          value={sleepScore != null ? `${sleepScore}` : '--'}
          unit="of 100"
          series={series(days, (d) => d.sleep?.score ?? null)}
          sparkColor="var(--sleep)"
          state={day.sleep ? `${Math.round(day.sleep.performance * 100)}% of need` : undefined}
          stateColor="var(--sleep)"
          onClick={() => onOpenDetail('sleep', selectedIndex)}
        />
        <StatTile
          label="HRV"
          value={day.hrvMs != null ? `${Math.round(day.hrvMs)}` : '--'}
          unit="ms"
          series={series(days, (d) => d.hrvMs)}
          sparkColor="var(--rec-high)"
          onClick={() => onOpenDetail('hrv', selectedIndex)}
        />
        <StatTile
          label="Resting HR"
          value={day.restingHr != null ? `${Math.round(day.restingHr)}` : '--'}
          unit="bpm"
          series={series(days, (d) => d.restingHr)}
          sparkColor="var(--rec-mid)"
          onClick={() => onOpenDetail('rhr', selectedIndex)}
        />
        <StatTile
          label="Respiratory"
          value={day.respiratoryRate != null ? day.respiratoryRate.toFixed(1) : '--'}
          unit="br/min"
          series={series(days, (d) => d.respiratoryRate)}
          sparkColor="var(--gold)"
          onClick={() => onOpenDetail('respiratory', selectedIndex)}
        />
      </div>
    </div>
  )
}
