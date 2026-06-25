import { describe, it, expect } from 'vitest'
import { parseFirebaseExports, parseActivity } from './parseHaeJson'
import { buildDayViews } from './firebase'

// Small SYNTHETIC Health Auto Export Firebase payload array. Never real
// health data. Two days: 2026-06-20 (HRV/RHR/respiratory + sleep) and
// 2026-06-21 (HRV/RHR/respiratory only).
const PAYLOADS: unknown[] = [
  {
    data: {
      metrics: [
        {
          name: 'heart_rate_variability',
          units: 'ms',
          data: [
            { date: '2026-06-20 03:06:00 -0400', qty: 50, source: 'Test Watch' },
            { date: '2026-06-20 07:06:00 -0400', qty: 60, source: 'Test Watch' },
            { date: '2026-06-21 03:06:00 -0400', qty: 70, source: 'Test Watch' },
          ],
        },
        {
          name: 'resting_heart_rate',
          units: 'count/min',
          data: [
            { date: '2026-06-20 00:00:00 -0400', qty: 54, source: 'Test Watch' },
            { date: '2026-06-21 00:00:00 -0400', qty: 52, source: 'Test Watch' },
          ],
        },
        {
          name: 'respiratory_rate',
          units: 'count/min',
          data: [
            { date: '2026-06-20 01:00:00 -0400', qty: 14, source: 'Test Watch' },
            { date: '2026-06-20 02:00:00 -0400', qty: 16, source: 'Test Watch' },
            { date: '2026-06-21 01:00:00 -0400', qty: 15, source: 'Test Watch' },
          ],
        },
        {
          name: 'sleep_analysis',
          units: 'hr',
          data: [
            {
              date: '2026-06-20 00:00:00 -0400',
              asleep: 0,
              awake: 0.4,
              core: 4.5,
              deep: 1.2,
              rem: 1.8,
              inBed: 0,
              inBedStart: '2026-06-20 23:30:00 -0400',
              inBedEnd: '2026-06-21 07:30:00 -0400',
              sleepStart: '2026-06-20 23:45:00 -0400',
              sleepEnd: '2026-06-21 07:15:00 -0400',
              source: 'Test Watch',
              totalSleep: 7.5,
            },
          ],
        },
      ],
    },
  },
]

describe('parseFirebaseExports', () => {
  it('computes day HRV as the mean of qty across points for that day', () => {
    const { nights } = parseFirebaseExports(PAYLOADS)
    const day1 = nights.find((n) => n.date === '2026-06-20')!
    expect(day1.hrvMs).toBeCloseTo(55, 5) // mean(50, 60)
  })

  it('computes resting HR and respiratory rate means per day', () => {
    const { nights } = parseFirebaseExports(PAYLOADS)
    const day1 = nights.find((n) => n.date === '2026-06-20')!
    expect(day1.restingHr).toBe(54)
    expect(day1.respiratoryRate).toBeCloseTo(15, 5) // mean(14, 16)

    const day2 = nights.find((n) => n.date === '2026-06-21')!
    expect(day2.hrvMs).toBe(70)
    expect(day2.restingHr).toBe(52)
    expect(day2.respiratoryRate).toBe(15)
  })

  it('produces a NightSample for every day with HRV/RHR/respiratory data, sorted ascending', () => {
    const { nights } = parseFirebaseExports(PAYLOADS)
    expect(nights.map((n) => n.date)).toEqual(['2026-06-20', '2026-06-21'])
  })

  it('computes asleepMinutes from totalSleep, NOT from the unreliable asleep field', () => {
    const { sleeps } = parseFirebaseExports(PAYLOADS)
    expect(sleeps).toHaveLength(1)
    const sleep = sleeps[0]
    expect(sleep.date).toBe('2026-06-20')
    expect(sleep.asleepMinutes).toBeCloseTo(450, 1) // 7.5h * 60, not 0
  })

  it('computes inBedMinutes from inBedStart..inBedEnd timestamps, NOT from the unreliable inBed field', () => {
    const { sleeps } = parseFirebaseExports(PAYLOADS)
    const sleep = sleeps[0]
    expect(sleep.inBedMinutes).toBeCloseTo(480, 1) // 23:30 -> 07:30 next day = 8h = 480min
  })

  it('populates bedTime and wakeTime from the sleep timestamps', () => {
    const { sleeps } = parseFirebaseExports(PAYLOADS)
    const sleep = sleeps[0]
    expect(sleep.bedTime).toBe('2026-06-20 23:30:00 -0400')
    expect(sleep.wakeTime).toBe('2026-06-21 07:15:00 -0400')
  })

  it('converts deep/rem/core/awake hours to minutes', () => {
    const { sleeps } = parseFirebaseExports(PAYLOADS)
    const sleep = sleeps[0]
    expect(sleep.deepMinutes).toBeCloseTo(1.2 * 60, 5)
    expect(sleep.remMinutes).toBeCloseTo(1.8 * 60, 5)
    expect(sleep.coreMinutes).toBeCloseTo(4.5 * 60, 5)
    expect(sleep.awakeMinutes).toBeCloseTo(0.4 * 60, 5)
  })

  it('does not throw when a payload is missing workouts entirely', () => {
    const payloadsWithoutWorkouts = [
      { data: { metrics: [{ name: 'heart_rate_variability', data: [{ date: '2026-06-22 03:00:00 -0400', qty: 45 }] }] } },
    ]
    expect(() => parseFirebaseExports(payloadsWithoutWorkouts)).not.toThrow()
    const { workoutsByDate } = parseFirebaseExports(payloadsWithoutWorkouts)
    expect(workoutsByDate.size).toBe(0)
  })

  it('is defensive against payloads missing the data wrapper (falls back to top-level metrics)', () => {
    const flatPayloads = [
      { metrics: [{ name: 'resting_heart_rate', data: [{ date: '2026-06-23 00:00:00 -0400', qty: 58 }] }] },
    ]
    const { nights } = parseFirebaseExports(flatPayloads)
    expect(nights.find((n) => n.date === '2026-06-23')?.restingHr).toBe(58)
  })
})

describe('buildDayViews', () => {
  it('returns one DayView per day with a non-null recovery on the later day', () => {
    const dayViews = buildDayViews(PAYLOADS)
    expect(dayViews).toHaveLength(2)
    expect(dayViews.map((d) => d.date)).toEqual(['2026-06-20', '2026-06-21'])

    const day2 = dayViews.find((d) => d.date === '2026-06-21')!
    expect(day2.recovery).not.toBeNull()
    expect(['red', 'amber', 'green']).toContain(day2.recovery!.band)
  })

  it('merges raw night/sleep fields onto the computed DailyResult', () => {
    const dayViews = buildDayViews(PAYLOADS)
    const day1 = dayViews.find((d) => d.date === '2026-06-20')!
    expect(day1.hrvMs).toBeCloseTo(55, 5)
    expect(day1.restingHr).toBe(54)
    expect(day1.asleepMinutes).toBeCloseTo(450, 1)
    expect(day1.bedTime).toBe('2026-06-20 23:30:00 -0400')

    const day2 = dayViews.find((d) => d.date === '2026-06-21')!
    expect(day2.asleepMinutes).toBeNull()
    expect(day2.bedTime).toBeNull()
  })
})

// Small SYNTHETIC payload exercising the Apple activity metrics. Never real
// health data. Single day 2026-06-20 with steps, calories, exercise, stand,
// flights, distance (in miles), physical effort, heart rate and noise.
const ACTIVITY_PAYLOADS: unknown[] = [
  {
    data: {
      metrics: [
        {
          name: 'step_count',
          units: 'count',
          data: [
            { date: '2026-06-20 09:00:00 -0400', qty: 4000, source: 'Test Watch' },
            { date: '2026-06-20 18:00:00 -0400', qty: 3500, source: 'Test Watch' },
          ],
        },
        {
          name: 'active_energy',
          units: 'kcal',
          data: [{ date: '2026-06-20 12:00:00 -0400', qty: 300, source: 'Test Watch' }],
        },
        {
          name: 'basal_energy_burned',
          units: 'kcal',
          data: [{ date: '2026-06-20 12:00:00 -0400', qty: 1500, source: 'Test Watch' }],
        },
        {
          name: 'apple_exercise_time',
          units: 'min',
          data: [
            { date: '2026-06-20 08:00:00 -0400', qty: 20, source: 'Test Watch' },
            { date: '2026-06-20 17:00:00 -0400', qty: 15, source: 'Test Watch' },
          ],
        },
        {
          name: 'apple_stand_hour',
          units: 'count',
          data: [
            { date: '2026-06-20 09:00:00 -0400', qty: 1, source: 'Test Watch' },
            { date: '2026-06-20 14:00:00 -0400', qty: 1, source: 'Test Watch' },
          ],
        },
        {
          name: 'flights_climbed',
          units: 'count',
          data: [
            { date: '2026-06-20 09:00:00 -0400', qty: 2, source: 'Test Watch' },
            { date: '2026-06-20 15:00:00 -0400', qty: 3, source: 'Test Watch' },
          ],
        },
        {
          name: 'walking_running_distance',
          units: 'mi',
          data: [{ date: '2026-06-20 12:00:00 -0400', qty: 5, source: 'Test Watch' }],
        },
        {
          name: 'physical_effort',
          units: 'kcal/hr·kg',
          data: [
            { date: '2026-06-20 09:00:00 -0400', qty: 2, source: 'Test Watch' },
            { date: '2026-06-20 18:00:00 -0400', qty: 4, source: 'Test Watch' },
          ],
        },
        {
          name: 'heart_rate',
          units: 'count/min',
          data: [
            { date: '2026-06-20 09:00:00 -0400', Min: 55, Max: 90, Avg: 70, source: 'Test Watch' },
            { date: '2026-06-20 18:00:00 -0400', Min: 60, Max: 120, Avg: 80, source: 'Test Watch' },
          ],
        },
        {
          name: 'environmental_audio_exposure',
          units: 'dBASPL',
          data: [
            { date: '2026-06-20 09:00:00 -0400', qty: 65, source: 'Test Watch' },
            { date: '2026-06-20 18:00:00 -0400', qty: 75, source: 'Test Watch' },
          ],
        },
      ],
    },
  },
]

describe('parseActivity', () => {
  it('sums step_count points for the day', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    expect(activityByDate.get('2026-06-20')?.steps).toBe(7500)
  })

  it('computes totalEnergy as the sum of active_energy and basal_energy_burned', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    const day = activityByDate.get('2026-06-20')!
    expect(day.activeEnergy).toBe(300)
    expect(day.basalEnergy).toBe(1500)
    expect(day.totalEnergy).toBe(1800)
  })

  it('sums apple_exercise_time minutes', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    expect(activityByDate.get('2026-06-20')?.exerciseMinutes).toBe(35)
  })

  it('sums apple_stand_hour', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    expect(activityByDate.get('2026-06-20')?.standHours).toBe(2)
  })

  it('sums flights_climbed', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    expect(activityByDate.get('2026-06-20')?.flights).toBe(5)
  })

  it('converts walking_running_distance from miles to km using the units field', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    expect(activityByDate.get('2026-06-20')?.distanceKm).toBeCloseTo(5 * 1.60934, 5)
  })

  it('computes avgHr as the mean of Avg and maxHr as the max of Max across heart_rate points', () => {
    const activityByDate = parseActivity(ACTIVITY_PAYLOADS)
    const day = activityByDate.get('2026-06-20')!
    expect(day.avgHr).toBeCloseTo(75, 5) // mean(70, 80)
    expect(day.maxHr).toBe(120) // max(90, 120)
  })

  it('returns an all-null ActivityDay for a day with no activity metrics, and buildDayViews still produces a DayView for it', () => {
    const activityByDate = parseActivity(PAYLOADS)
    // PAYLOADS (sleep/HRV fixtures above) has no activity metrics at all.
    expect(activityByDate.size).toBe(0)

    const dayViews = buildDayViews(PAYLOADS)
    const day1 = dayViews.find((d) => d.date === '2026-06-20')!
    expect(day1.activity).toEqual({
      steps: null,
      activeEnergy: null,
      basalEnergy: null,
      totalEnergy: null,
      exerciseMinutes: null,
      standHours: null,
      standMinutes: null,
      flights: null,
      distanceKm: null,
      physicalEffort: null,
      avgHr: null,
      maxHr: null,
      noiseDb: null,
    })
  })
})
