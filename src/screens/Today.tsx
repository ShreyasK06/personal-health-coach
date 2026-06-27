// Today screen: greeting header + DateNav, an optional calibration banner,
// the hero RecoveryRing, a readiness banner (the lead signal -- replaces the
// old "Today's Synthesis" prose card), a promoted Training load card, a
// compact Strain gauge, and an "At a glance" 2-column grid of MetricCards
// (Recovery, Strain, Sleep, HRV, Steps, Active calories) each with a
// day-over-day delta pill, followed by a "More" row for Resting HR and
// Respiratory. Reads the days array and the currently selected index passed
// by App. Every tile/ring/gauge/card opens the matching in-depth detail
// sheet via onOpenDetail. The Move/Exercise/Stand activity-rings block has
// been removed from this screen entirely -- it lives on the Activity tab,
// and was empty/useless before a workout happened.
import { Activity as ActivityIcon, Flame, Footprints, HeartPulse, Wind } from 'lucide-react'
import type { DayView, DetailKind } from '../lib/firebase'
import { RecoveryRing } from '../components/RecoveryRing'
import { GradientHero } from '../components/GradientHero'
import { SectionLabel } from '../components/SectionLabel'
import { MetricCard } from '../components/MetricCard'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { StatePill } from '../components/StatePill'
import { DateNav } from '../components/DateNav'
import { Gauge } from '../components/Gauge'
import { readiness, intensityTarget, metricDelta, calibration } from '../lib/detail'
import { REC_BAND_COLOR, LOAD_BAND, strainWord, greeting, longDate } from '../lib/uiHelpers'

const STRAIN_GAUGE_SIZE = 180

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
  const recColor = rec ? REC_BAND_COLOR[rec.band] : 'var(--text-mut)'

  const sleepScore = day.sleep ? Math.round(day.sleep.score) : null
  const ready = readiness(days, selectedIndex)
  const readinessColor = READINESS_TONE_COLOR[ready.tone]
  const target = intensityTarget(day)
  const cal = calibration(days, selectedIndex)
  const a = day.activity

  // "At a glance" tiles: only render tiles that have real data, and only show
  // the grid at all once at least 3 tiles have data -- otherwise a single
  // friendly message replaces a grid full of dashes.
  const glanceTiles = [
    rec != null,
    true, // strain always has a numeric value (0 on rest days)
    sleepScore != null,
    day.hrvMs != null,
    a.steps != null,
    a.activeEnergy != null,
  ].filter(Boolean).length

  return (
    <div className="animate-fade-up flex flex-col gap-6">
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

      {cal.level !== 'dialed' && (
        <Card tone="surface" className="py-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
            {cal.label}
          </span>
        </Card>
      )}

      {/* hero ring */}
      {rec ? (
        <div className="flex justify-center">
          <RecoveryRing score={rec.score} band={rec.band} onClick={() => onOpenDetail('recovery', selectedIndex)} />
        </div>
      ) : (
        <EmptyState message="No overnight recovery reading" />
      )}

      {/* Readiness -- the lead signal */}
      <Card tone="hero" accent={readinessColor} onClick={() => onOpenDetail('load', selectedIndex)}>
        <div className="flex flex-col gap-2">
          <span className="text-label" style={{ color: 'var(--text-mut)' }}>
            Readiness
          </span>
          <span className="font-display text-display-md" style={{ color: readinessColor }}>
            {ready.headline}
          </span>
          {target && (
            <span className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
              {target.note}
            </span>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <SectionLabel>Training load</SectionLabel>
        <Card onClick={() => onOpenDetail('load', selectedIndex)} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display tabnum text-display-sm" style={{ color: 'var(--text)' }}>
              {day.load.acwr.toFixed(2)}
            </span>
            <StatePill tone={LOAD_BAND[day.load.band].tone}>{LOAD_BAND[day.load.band].label}</StatePill>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-mut)' }}>
            Acute to chronic load ratio
          </span>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-3">
        <SectionLabel>Strain</SectionLabel>
        <Gauge
          value={day.strain.strain}
          max={21}
          color="var(--strain)"
          label="of 21"
          caption={strainWord(day.strain.strain)}
          size={STRAIN_GAUGE_SIZE}
          onClick={() => onOpenDetail('strain', selectedIndex)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>At a glance</SectionLabel>
        {glanceTiles < 3 ? (
          <EmptyState message="Your stats fill in as data arrives" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {rec && (
                <MetricCard
                  icon={HeartPulse}
                  label="Recovery"
                  value={Math.round(rec.score)}
                  unit="of 100"
                  accent={recColor}
                  dayDelta={metricDelta(days, selectedIndex, (d) => d.recovery?.score ?? null)}
                  onClick={() => onOpenDetail('recovery', selectedIndex)}
                />
              )}
              <MetricCard
                icon={ActivityIcon}
                label="Strain"
                value={day.strain.strain.toFixed(1)}
                unit="of 21"
                accent="var(--strain)"
                dayDelta={metricDelta(days, selectedIndex, (d) => d.strain.strain)}
                onClick={() => onOpenDetail('strain', selectedIndex)}
              />
              {sleepScore != null && (
                <MetricCard
                  icon={Wind}
                  label="Sleep"
                  value={sleepScore}
                  unit="of 100"
                  accent="var(--sleep)"
                  dayDelta={metricDelta(days, selectedIndex, (d) => d.sleep?.score ?? null)}
                  onClick={() => onOpenDetail('sleep', selectedIndex)}
                />
              )}
              {day.hrvMs != null && (
                <MetricCard
                  icon={HeartPulse}
                  label="HRV"
                  value={Math.round(day.hrvMs)}
                  unit="ms"
                  accent="var(--gold)"
                  dayDelta={metricDelta(days, selectedIndex, (d) => d.hrvMs)}
                  onClick={() => onOpenDetail('hrv', selectedIndex)}
                />
              )}
              {a.steps != null && (
                <MetricCard
                  icon={Footprints}
                  label="Steps"
                  value={Math.round(a.steps)}
                  accent="var(--steps)"
                  gradFrom="var(--steps-grad-from)"
                  gradTo="var(--steps-grad-to)"
                  dayDelta={metricDelta(days, selectedIndex, (d) => d.activity.steps)}
                  onClick={() => onOpenDetail('steps', selectedIndex)}
                />
              )}
              {a.activeEnergy != null && (
                <MetricCard
                  icon={Flame}
                  label="Active cal"
                  value={Math.round(a.activeEnergy)}
                  unit="kcal"
                  accent="var(--move)"
                  gradFrom="var(--move-grad-from)"
                  gradTo="var(--move-grad-to)"
                  dayDelta={metricDelta(days, selectedIndex, (d) => d.activity.activeEnergy)}
                  onClick={() => onOpenDetail('activeEnergy', selectedIndex)}
                />
              )}
            </div>

            {(day.restingHr != null || day.respiratoryRate != null) && (
              <div className="grid grid-cols-2 gap-3">
                {day.restingHr != null && (
                  <MetricCard
                    icon={HeartPulse}
                    label="Resting HR"
                    value={Math.round(day.restingHr)}
                    unit="bpm"
                    accent="var(--rec-mid)"
                    invert
                    dayDelta={metricDelta(days, selectedIndex, (d) => d.restingHr)}
                    onClick={() => onOpenDetail('rhr', selectedIndex)}
                  />
                )}
                {day.respiratoryRate != null && (
                  <MetricCard
                    icon={Wind}
                    label="Respiratory"
                    value={day.respiratoryRate.toFixed(1)}
                    unit="br/min"
                    accent="var(--text-mut)"
                    dayDelta={metricDelta(days, selectedIndex, (d) => d.respiratoryRate)}
                    onClick={() => onOpenDetail('respiratory', selectedIndex)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
