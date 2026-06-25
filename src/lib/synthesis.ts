// Pure, rule-based helper that turns a single DayView into a one or two sentence
// plain-language summary for the "Today's Synthesis" card. No emoji, no em
// dashes. Called by the Today screen.
import type { DayView } from './firebase'

function formatHm(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h <= 0) return `${m}m`
  return `${h}h${m.toString().padStart(2, '0')}m`
}

/** Builds the synthesis insight string from the latest day's metrics. */
export function buildSynthesis(day: DayView): string {
  const parts: string[] = []

  // HRV phrasing relative to its z-score from recovery (if available).
  const zHrv = day.recovery?.zHrv ?? 0
  if (day.hrvMs != null) {
    if (zHrv > 0.5) parts.push(`HRV is above your baseline at ${Math.round(day.hrvMs)}ms`)
    else if (zHrv < -0.5) parts.push(`HRV is below your baseline at ${Math.round(day.hrvMs)}ms`)
    else parts.push(`HRV is near your baseline at ${Math.round(day.hrvMs)}ms`)
  }

  // Sleep phrasing.
  const slept = formatHm(day.asleepMinutes)
  if (slept) {
    const perf = day.sleep ? Math.round(day.sleep.performance * 100) : null
    if (perf != null && perf >= 90) parts.push(`you slept ${slept} and met ${perf}% of your need`)
    else if (perf != null) parts.push(`you slept ${slept}, ${perf}% of your need`)
    else parts.push(`you slept ${slept}`)
  }

  // Lead clause built from HRV + sleep.
  let lead = ''
  if (parts.length === 2) lead = `${capitalize(parts[0])} and ${parts[1]}.`
  else if (parts.length === 1) lead = `${capitalize(parts[0])}.`

  // Recommendation clause from recovery band.
  let rec = ''
  const band = day.recovery?.band
  const strain = day.strain.strain
  if (band === 'green') {
    rec = 'Your body looks primed to push today.'
  } else if (band === 'amber') {
    rec = 'You are in a balanced state, so train to feel rather than to a number.'
  } else if (band === 'red') {
    rec = 'Recovery is low, so favor an easy day and protect tonight\'s sleep.'
  } else {
    rec = 'Not enough overnight data to gauge recovery yet.'
  }

  // Mention yesterday's strain if it was meaningful and recovery is suppressed.
  if (band === 'red' && strain >= 12) {
    rec = `Yesterday's strain of ${strain.toFixed(1)} is still settling, so favor an easy day and protect tonight's sleep.`
  }

  const out = `${lead} ${rec}`.trim()
  return out || 'Pull your latest export to see today\'s synthesis.'
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}
