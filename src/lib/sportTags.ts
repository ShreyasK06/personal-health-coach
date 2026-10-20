const KEY = 'phc.sportTags'

/** Manual sport overrides keyed by workout `start`. Any storage failure yields {}. */
export function getSportTags(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

/** An empty `sport` clears the override so the workout falls back to auto classification. */
export function setSportTag(workoutStart: string, sport: string): void {
  try {
    const tags = getSportTags()
    if (sport === '') delete tags[workoutStart]
    else tags[workoutStart] = sport
    localStorage.setItem(KEY, JSON.stringify(tags))
  } catch {
    // storage unavailable or full; tagging is best-effort
  }
}
