// Small UI-only helpers shared by the Today/Sleep/Trends screens: extracting
// trailing series for sparklines, mapping recovery bands to colors/tones, and
// formatting clock times. Pure functions over DayView[].
import type { DayView } from './firebase'
import type { PillTone } from '../components/StatePill'

/** Last `n` values of a numeric accessor across the days array (nulls kept so
 * sparklines can break the line at gaps). */
export function series(days: DayView[], pick: (d: DayView) => number | null, n = 14): (number | null)[] {
  return days.slice(-n).map(pick)
}

export const REC_BAND_COLOR: Record<'red' | 'amber' | 'green', string> = {
  red: 'var(--rec-low)',
  amber: 'var(--rec-mid)',
  green: 'var(--rec-high)',
}

export const REC_BAND_TONE: Record<'red' | 'amber' | 'green', PillTone> = {
  red: 'critical',
  amber: 'warning',
  green: 'positive',
}

export const REC_BAND_WORD: Record<'red' | 'amber' | 'green', string> = {
  red: 'Low',
  amber: 'Balanced',
  green: 'Primed',
}

export const LOAD_BAND: Record<
  'detraining' | 'optimal' | 'caution' | 'high-risk',
  { label: string; tone: PillTone }
> = {
  optimal: { label: 'Optimal', tone: 'positive' },
  detraining: { label: 'Detraining', tone: 'warning' },
  caution: { label: 'Caution', tone: 'warning' },
  'high-risk': { label: 'High risk', tone: 'critical' },
}

/** Strain (0..21) -> small state word. */
export function strainWord(strain: number): string {
  if (strain >= 18) return 'All out'
  if (strain >= 14) return 'High'
  if (strain >= 8) return 'Moderate'
  if (strain > 0) return 'Light'
  return 'Rest'
}

/** Formats an ISO time to a short clock like "23:12" using the time portion of
 * the string (HAE timestamps already carry the local offset). */
export function clockOf(iso: string | null): string | null {
  if (!iso) return null
  const m = iso.match(/[T ](\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  return null
}

/** Minutes -> "7h 40m". */
export function hoursMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '--'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

/** A friendly long date label, e.g. "Sunday, 14 June". */
export function longDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Short date label, e.g. "Jun 14". */
export function shortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** A time-of-day greeting. */
export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
