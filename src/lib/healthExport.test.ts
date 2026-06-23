import { describe, it, expect } from 'vitest'
import {
  parseDailyCsv,
  parseWorkoutsCsv,
  computeDailyResults,
  DEFAULT_PROFILE,
} from './healthExport'

// Synthetic main daily export, matching Health Auto Export's real column
// headers exactly. Sleep values are in HOURS in the source file.
const DAILY_CSV = [
  [
    'Date/Time',
    'Heart Rate Variability (ms)',
    'Resting Heart Rate (bpm)',
    'Respiratory Rate (count/min)',
    'Sleep Analysis [Asleep] (hr)',
    'Sleep Analysis [In Bed] (hr)',
    'Sleep Analysis [Core] (hr)',
    'Sleep Analysis [Deep] (hr)',
    'Sleep Analysis [REM] (hr)',
    'Sleep Analysis [Awake] (hr)',
    'Step Count (steps)',
    'Active Energy (kcal)',
    'VO2 Max (ml/(kg·min))',
  ].join(','),
  // Day 1: average night, no prior baseline (n=0 -> use today as baseline).
  '2026-06-19 07:00:00 +0000,62,54,14,7.0,7.5,4.5,1.0,1.5,0.5,8200,420,45',
  // Day 2: great HRV/RHR/sleep -> should land in green band.
  '2026-06-20 07:00:00 +0000,85,48,13,8.0,8.3,4.8,1.4,1.8,0.3,9100,460,46',
  // Day 3: a workout day, moderate sleep.
  '2026-06-21 07:00:00 +0000,58,56,15,6.5,7.0,4.0,1.0,1.5,0.5,11000,610,46',
].join('\n')

// Synthetic workouts export with the real Health Auto Export columns.
const WORKOUTS_CSV = [
  ['Workout Type', 'Start', 'End', 'Duration', 'Avg. Heart Rate (bpm)', 'Max. Heart Rate (bpm)', 'Distance (km)'].join(
    ',',
  ),
  // HH:MM:SS duration form.
  'Running,2026-06-21 06:00:00 +0000,2026-06-21 06:45:00 +0000,00:45:00,150,172,7.5',
  // Numeric-minutes duration form.
  'Traditional Strength Training,2026-06-21 18:00:00 +0000,2026-06-21 18:30:00 +0000,30,120,140,0',
].join('\n')

describe('parseDailyCsv', () => {
  it('parses one NightSample and SleepInput per day, converting sleep hours to minutes', () => {
    const { nights, sleeps } = parseDailyCsv(DAILY_CSV)
    expect(nights).toHaveLength(3)
    expect(sleeps).toHaveLength(3)

    const day2Night = nights.find((n) => n.date === '2026-06-20')!
    expect(day2Night.hrvMs).toBe(85)
    expect(day2Night.restingHr).toBe(48)
    expect(day2Night.respiratoryRate).toBe(13)

    const day2Sleep = sleeps.find((s) => s.date === '2026-06-20')!
    expect(day2Sleep.asleepMinutes).toBeCloseTo(8.0 * 60, 5)
    expect(day2Sleep.inBedMinutes).toBeCloseTo(8.3 * 60, 5)
    expect(day2Sleep.deepMinutes).toBeCloseTo(1.4 * 60, 5)
    expect(day2Sleep.remMinutes).toBeCloseTo(1.8 * 60, 5)
    expect(day2Sleep.coreMinutes).toBeCloseTo(4.8 * 60, 5)
    expect(day2Sleep.awakeMinutes).toBeCloseTo(0.3 * 60, 5)
    expect(day2Sleep.bedTime).toBe('')
    expect(day2Sleep.wakeTime).toBe('')
  })

  it('extracts the YYYY-MM-DD date from a Date/Time column with time + timezone', () => {
    const { nights } = parseDailyCsv(DAILY_CSV)
    const dates = nights.map((n) => n.date).sort()
    expect(dates).toEqual(['2026-06-19', '2026-06-20', '2026-06-21'])
  })

  it('handles empty cells as null for NightSample fields', () => {
    const csvWithGap = DAILY_CSV.replace('2026-06-19 07:00:00 +0000,62,54,14', '2026-06-19 07:00:00 +0000,,,')
    const { nights } = parseDailyCsv(csvWithGap)
    const day1 = nights.find((n) => n.date === '2026-06-19')!
    expect(day1.hrvMs).toBeNull()
    expect(day1.restingHr).toBeNull()
    expect(day1.respiratoryRate).toBeNull()
  })
})

describe('parseWorkoutsCsv', () => {
  it('groups workouts by the date of Start, parsing HH:MM:SS and numeric Duration', () => {
    const byDate = parseWorkoutsCsv(WORKOUTS_CSV)
    const day3 = byDate.get('2026-06-21')!
    expect(day3).toHaveLength(2)

    const running = day3.find((w) => w.type === 'Running')!
    expect(running.durationMin).toBeCloseTo(45, 5)
    expect(running.avgHr).toBe(150)
    expect(running.maxHr).toBe(172)

    const strength = day3.find((w) => w.type === 'Traditional Strength Training')!
    expect(strength.durationMin).toBeCloseTo(30, 5)
  })
})

describe('computeDailyResults', () => {
  const { nights, sleeps } = parseDailyCsv(DAILY_CSV)
  const workoutsByDate = parseWorkoutsCsv(WORKOUTS_CSV)
  const results = computeDailyResults(nights, sleeps, workoutsByDate, DEFAULT_PROFILE, 2026)

  it('produces one result per day, sorted ascending by date', () => {
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.date)).toEqual(['2026-06-19', '2026-06-20', '2026-06-21'])
  })

  it('a day with good HRV/sleep yields a non-null recovery band', () => {
    const day2 = results.find((r) => r.date === '2026-06-20')!
    expect(day2.recovery).not.toBeNull()
    expect(day2.recovery!.band).not.toBeNull()
    expect(['red', 'amber', 'green']).toContain(day2.recovery!.band)
  })

  it('a workout day has strain.sessions length > 0', () => {
    const day3 = results.find((r) => r.date === '2026-06-21')!
    expect(day3.strain.sessions.length).toBeGreaterThan(0)
    expect(day3.strain.dayTrimp).toBeGreaterThan(0)
  })

  it('load.acwr is a finite number for every day', () => {
    for (const r of results) {
      expect(Number.isFinite(r.load.acwr)).toBe(true)
    }
  })

  it('sleep is non-null whenever a SleepInput exists for that day', () => {
    for (const r of results) {
      expect(r.sleep).not.toBeNull()
      expect(r.sleep!.score).toBeGreaterThanOrEqual(0)
    }
  })

  it('days with no workouts still get a strain result with empty sessions', () => {
    const day1 = results.find((r) => r.date === '2026-06-19')!
    expect(day1.strain.sessions).toHaveLength(0)
    expect(day1.strain.dayTrimp).toBe(0)
  })
})
