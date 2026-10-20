import type { LoadResult, WorkoutInput } from './types'
import type { DayView } from '../lib/firebase'

const EVENING_START_HOUR = 16
const MIN_HISTORY_DAYS = 14

/** Manual tag wins, then the Apple type as-is; only the parser's generic
 * fallback ("Other" / "Workout" / empty) is bucketed, and after 16:00 it is
 * treated as an evening sport session. */
export function classifySport(w: WorkoutInput): string {
  if (w.sportTag) return w.sportTag
  if (w.type && w.type !== 'Other' && w.type !== 'Workout') return w.type
  // Hour comes from the ISO text, not a local Date, so it is timezone-stable.
  const hour = Number(w.start.slice(11, 13))
  return hour >= EVENING_START_HOUR ? 'Evening sport' : 'Other'
}

export interface SportSlice {
  sport: string
  sessions: number
  minutes: number
  trimp: number
  share: number // 0..1 of window TRIMP
}

export function sportBreakdown(days: DayView[], index: number, windowDays = 28): SportSlice[] {
  const window = days.slice(Math.max(0, index - windowDays + 1), index + 1)
  const bySport = new Map<string, SportSlice>()
  let total = 0

  for (const d of window) {
    d.workouts.forEach((w, i) => {
      // strain.sessions is built 1:1 from workouts by computeStrain, so index i aligns.
      const trimp = d.strain.sessions[i]?.trimp ?? 0
      const sport = classifySport(w)
      const slice = bySport.get(sport) ?? { sport, sessions: 0, minutes: 0, trimp: 0, share: 0 }
      slice.sessions += 1
      slice.minutes += w.durationMin
      slice.trimp += trimp
      bySport.set(sport, slice)
      total += trimp
    })
  }

  const slices = [...bySport.values()]
  const n = slices.length
  for (const s of slices) s.share = total > 0 ? s.trimp / total : 1 / n
  return slices.sort((a, b) => b.trimp - a.trimp)
}

export function loadGuard(
  day: DayView,
  historyDays: number,
): {
  band: LoadResult['band'] | 'insufficient'
  acwr: number | null
  monotony: number | null
  message: string
} {
  if (historyDays < MIN_HISTORY_DAYS || day.load.chronic <= 0) {
    return {
      band: 'insufficient',
      acwr: null,
      monotony: null,
      message: 'Not enough training history yet for a reliable load ratio.',
    }
  }
  const { band, acwr, monotony } = day.load
  const messages: Record<LoadResult['band'], string> = {
    detraining: 'Load is well below your recent norm; room to build.',
    optimal: 'Load is in your productive range.',
    caution: 'Load is climbing faster than your body has adapted; ease into it.',
    'high-risk': 'Load spike versus your baseline; consider an easier day.',
  }
  return { band, acwr, monotony, message: messages[band] }
}
