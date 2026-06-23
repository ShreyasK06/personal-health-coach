/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { extractCsvs } from './loadZip'
import { parseDailyCsv, parseWorkoutsCsv, computeDailyResults, DEFAULT_PROFILE } from './healthExport'

// Smoke test against the user's real (currently empty) Health Auto Export.
// Confirms the empty-state path: this export has no usable daily metrics,
// so computeDailyResults should resolve to zero days.
const REAL_EXPORT_PATH =
  'C:/Users/Shreyas Kakkar/Downloads/HealthAutoExport_20260621234121.zip'

describe.skipIf(!existsSync(REAL_EXPORT_PATH))('real Health Auto Export (empty-state smoke check)', () => {
  it('resolves to zero computed days', () => {
    const bytes = new Uint8Array(readFileSync(REAL_EXPORT_PATH))
    const { dailyCsv, workoutsCsv } = extractCsvs(bytes)

    if (!dailyCsv) {
      // No daily CSV at all -> definitely empty-state.
      expect(dailyCsv).toBeNull()
      return
    }

    const { nights, sleeps } = parseDailyCsv(dailyCsv)
    const workoutsByDate = workoutsCsv ? parseWorkoutsCsv(workoutsCsv) : new Map()
    const results = computeDailyResults(nights, sleeps, workoutsByDate, DEFAULT_PROFILE, new Date().getFullYear())

    expect(results.length).toBe(0)
  })
})
