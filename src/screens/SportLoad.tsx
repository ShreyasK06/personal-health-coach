// Sport Load screen: GradientHero header + DateNav, an ACWR semicircle Gauge
// (acute:chronic load ratio, band word from loadGuard, or a "Not enough history
// yet" note until 14 days exist), a per-sport TRIMP breakdown over the trailing
// 28 days as share bars, monotony and weekly training-strain tiles, and a
// "Tag sessions" list where each workout of the selected day gets a sport
// <select> (Tennis / Pickleball / Cricket / Other) persisted via setSportTag.
// Reads the days array and selected index passed by App; manual tags are
// overlaid onto the workouts before classification so the bars update at once.
import { useMemo, useState } from 'react'
import type { DayView } from '../lib/firebase'
import { Gauge } from '../components/Gauge'
import { GradientHero } from '../components/GradientHero'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { SectionLabel } from '../components/SectionLabel'
import { DateNav } from '../components/DateNav'
import { classifySport, sportBreakdown, loadGuard } from '../metrics/sport'
import { getSportTags, setSportTag } from '../lib/sportTags'
import { longDate } from '../lib/uiHelpers'

const TAG_OPTIONS = ['Tennis', 'Pickleball', 'Cricket', 'Other'] as const
const GAUGE_SIZE = 240

const BAND_COLOR: Record<string, string> = {
  detraining: 'var(--text-mut)',
  optimal: 'var(--accent)',
  caution: 'var(--strain)',
  'high-risk': 'var(--strain)',
  insufficient: 'var(--text-mut)',
}

function fmt(n: number | null | undefined, digits: number): string {
  return n != null && Number.isFinite(n) ? n.toFixed(digits) : '--'
}

function timeOfDay(iso: string): string {
  return iso.slice(11, 16)
}

export function SportLoad({
  days,
  selectedIndex,
  onSelectIndex,
}: {
  days: DayView[]
  selectedIndex: number
  onSelectIndex: (i: number) => void
}) {
  // Local copy of the persisted tags; setSportTag writes storage, this state
  // forces the re-render so bars and labels pick the new tag up immediately.
  const [tags, setTags] = useState<Record<string, string>>(() => getSportTags())
  const taggedDays = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        workouts: d.workouts.map((w) => ({ ...w, sportTag: tags[w.start] ?? w.sportTag })),
      })),
    [days, tags],
  )

  const day = taggedDays[selectedIndex]
  const isLatest = selectedIndex === days.length - 1
  const guard = loadGuard(day, selectedIndex)
  const slices = sportBreakdown(taggedDays, selectedIndex)
  const strainOk = Number.isFinite(day.load.trainingStrain)
  const bandColor = BAND_COLOR[guard.band]

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <GradientHero title="Sport load" subtitle={longDate(day.date)}>
        <DateNav
          date={day.date}
          isLatest={isLatest}
          canGoBack={selectedIndex > 0}
          canGoForward={selectedIndex < days.length - 1}
          onBack={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          onForward={() => onSelectIndex(Math.min(days.length - 1, selectedIndex + 1))}
        />
      </GradientHero>

      <Card className="flex flex-col items-center gap-3 py-6">
        {guard.band === 'insufficient' || guard.acwr == null || !Number.isFinite(guard.acwr) ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-display text-lg font-black" style={{ color: 'var(--text)' }}>
              Not enough history yet
            </span>
            <span className="text-sm" style={{ color: 'var(--text-mut)' }}>
              {guard.message}
            </span>
          </div>
        ) : (
          <>
            <Gauge
              value={guard.acwr * 100}
              max={200}
              color={bandColor}
              label={`ACWR ${guard.acwr.toFixed(2)}`}
              caption={guard.band.replace('-', ' ')}
              size={GAUGE_SIZE}
            />
            <p className="px-2 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              {guard.message}
            </p>
          </>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <span className="section-label">Monotony</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {fmt(guard.monotony, 1)}
          </div>
        </Card>
        <Card>
          <span className="section-label">Weekly strain</span>
          <div className="font-display tabnum mt-2 text-xl font-black" style={{ color: 'var(--text)' }}>
            {strainOk ? Math.round(day.load.trainingStrain) : '--'}
          </div>
        </Card>
      </div>

      <SectionLabel right="28 days">By sport</SectionLabel>
      {slices.length === 0 ? (
        <EmptyState message="Sport load appears once your export includes workouts." />
      ) : (
        <Card className="flex flex-col gap-4">
          {slices.map((s) => (
            <div key={s.sport} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {s.sport}
                </span>
                <span className="tabnum shrink-0 text-xs" style={{ color: 'var(--text-mut)' }}>
                  {Math.round(s.share * 100)}% · {s.sessions} {s.sessions === 1 ? 'session' : 'sessions'} ·{' '}
                  {Math.round(s.minutes)} min
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, Math.round(s.share * 100))}%`, background: 'var(--strain)' }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

      <SectionLabel>Tag sessions</SectionLabel>
      {day.workouts.length === 0 ? (
        <EmptyState message="No workouts on this day" />
      ) : (
        <Card className="flex flex-col gap-4">
          {day.workouts.map((w) => {
            const sport = classifySport(w)
            const value = (TAG_OPTIONS as readonly string[]).includes(sport) ? sport : ''
            return (
              <div key={w.start} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {sport}
                  </span>
                  <span className="tabnum text-xs" style={{ color: 'var(--text-mut)' }}>
                    {timeOfDay(w.start)} · {Math.round(w.durationMin)} min
                  </span>
                </div>
                <select
                  aria-label={`Sport for ${w.type} at ${timeOfDay(w.start)}`}
                  value={value}
                  onChange={(e) => {
                    setSportTag(w.start, e.target.value)
                    setTags((t) => ({ ...t, [w.start]: e.target.value }))
                  }}
                  className="shrink-0 rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  {value === '' && (
                    <option value="" disabled>
                      Choose sport
                    </option>
                  )}
                  {TAG_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
