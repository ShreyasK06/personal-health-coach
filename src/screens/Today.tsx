// Today screen: greeting header + date, a DateNav pill for stepping between
// days, the hero RecoveryRing, a rule-based "Today's Synthesis" card, and an
// "AT A GLANCE" 2-column grid of StatTiles (Recovery, Strain, Sleep, HRV,
// Resting HR, Respiratory) each with a 14-day sparkline. Reads the days array
// and the currently selected index passed by App.
import type { DayView } from '../lib/firebase'
import { RecoveryRing } from '../components/RecoveryRing'
import { SectionLabel } from '../components/SectionLabel'
import { StatTile } from '../components/StatTile'
import { SynthesisCard } from '../components/SynthesisCard'
import { StatePill } from '../components/StatePill'
import { DateNav } from '../components/DateNav'
import { Gauge } from '../components/Gauge'
import { buildSynthesis } from '../lib/synthesis'
import {
  series,
  REC_BAND_COLOR,
  REC_BAND_TONE,
  REC_BAND_WORD,
  strainWord,
  greeting,
  longDate,
} from '../lib/uiHelpers'

const STRAIN_MAX = 21

export function Today({
  days,
  selectedIndex,
  onSelectIndex,
}: {
  days: DayView[]
  selectedIndex: number
  onSelectIndex: (i: number) => void
}) {
  const day = days[selectedIndex]
  const isLatest = selectedIndex === days.length - 1
  const rec = day.recovery
  const accent = rec ? REC_BAND_COLOR[rec.band] : 'var(--gold)'

  const sleepScore = day.sleep ? Math.round(day.sleep.score) : null

  return (
    <div className="animate-fade-up flex flex-col gap-1">
      <header className="mb-2 flex flex-col">
        <p className="text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
          {isLatest ? greeting() : 'Looking back'}
        </p>
        <h1 className="font-display text-[34px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          Today
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-mut)' }}>
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

      {/* hero ring */}
      <div className="my-4 flex justify-center">
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

      <SectionLabel
        right={rec ? <StatePill tone={REC_BAND_TONE[rec.band]}>{REC_BAND_WORD[rec.band]}</StatePill> : undefined}
      >
        Today&apos;s Synthesis
      </SectionLabel>
      <SynthesisCard text={buildSynthesis(day)} accent={accent} />

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
        />
        <StatTile
          label="Strain"
          value={day.strain.strain.toFixed(1)}
          unit="of 21"
          series={series(days, (d) => d.strain.strain)}
          sparkColor="var(--strain)"
          state={strainWord(day.strain.strain)}
          stateColor="var(--strain)"
        />
        <StatTile
          label="Sleep"
          value={sleepScore != null ? `${sleepScore}` : '--'}
          unit="of 100"
          series={series(days, (d) => d.sleep?.score ?? null)}
          sparkColor="var(--sleep)"
          state={day.sleep ? `${Math.round(day.sleep.performance * 100)}% of need` : undefined}
          stateColor="var(--sleep)"
        />
        <StatTile
          label="HRV"
          value={day.hrvMs != null ? `${Math.round(day.hrvMs)}` : '--'}
          unit="ms"
          series={series(days, (d) => d.hrvMs)}
          sparkColor="var(--rec-high)"
        />
        <StatTile
          label="Resting HR"
          value={day.restingHr != null ? `${Math.round(day.restingHr)}` : '--'}
          unit="bpm"
          series={series(days, (d) => d.restingHr)}
          sparkColor="var(--rec-mid)"
        />
        <StatTile
          label="Respiratory"
          value={day.respiratoryRate != null ? day.respiratoryRate.toFixed(1) : '--'}
          unit="br/min"
          series={series(days, (d) => d.respiratoryRate)}
          sparkColor="var(--gold)"
        />
      </div>
    </div>
  )
}
