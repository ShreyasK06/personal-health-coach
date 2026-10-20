// Fully synthetic Health Auto Export-shaped payloads for the `?demo=1` mode.
// Nothing here derives from real health data. Deterministic for a given
// (days, seed, now); only the absolute dates move with `now`.

const SOURCE = 'Demo Watch'
const TZ = '-0400'

/** Small seeded PRNG (mulberry32). Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function stamp(d: Date, hh: number, mm = 0): string {
  return `${ymd(d)} ${pad(hh)}:${pad(mm)}:00 ${TZ}`
}

const round = (n: number, dp = 1) => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

interface Point {
  date: string
  [key: string]: unknown
}

// Training-intensity multiplier per day of the hard block, indexed by days-ago.
const HARD_BLOCK_INTENSITY = [2.0, 1.2, 2.0, 0.6, 1.4, 1.8, 0.9]

export function generateDemoPayloads(days = 45, seed = 7, now: Date = new Date()): unknown[] {
  const rand = mulberry32(seed)
  const noise = (amp: number) => (rand() * 2 - 1) * amp

  const metrics: Record<string, { units: string; data: Point[] }> = {}
  const add = (name: string, units: string, point: Point) => {
    ;(metrics[name] ??= { units, data: [] }).data.push(point)
  }
  const workouts: unknown[] = []

  for (let i = 0; i < days; i++) {
    const offset = days - 1 - i // 0 = today
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset - 1)
    const dow = day.getDay()

    // Hard-load block: the most recent week pushes ACWR above the optimal band.
    const hardWeek = offset <= 6
    const weekPhase = Math.sin((2 * Math.PI * i) / 7)
    // Fatigue after the hard week suppresses HRV and lifts RHR slightly.
    const fatigue = hardWeek ? 0.45 : 0

    const hrv = 62 + 8 * weekPhase - 10 * fatigue + noise(5)
    const rhr = 54 - 1.5 * weekPhase + 3 * fatigue + noise(1.2)
    const resp = 14.5 + 0.4 * fatigue + noise(0.4)

    add('heart_rate_variability', 'ms', { date: stamp(day, 3, 6), qty: round(hrv - 2), source: SOURCE })
    add('heart_rate_variability', 'ms', { date: stamp(day, 5, 12), qty: round(hrv + 2), source: SOURCE })
    add('resting_heart_rate', 'count/min', { date: stamp(day, 0), qty: Math.round(rhr), source: SOURCE })
    add('respiratory_rate', 'count/min', { date: stamp(day, 2), qty: round(resp), source: SOURCE })

    // Sleep (about 7h, a little shorter in the hard week).
    const totalSleep = Math.max(5.2, 7.2 - 0.6 * fatigue + noise(0.5))
    const deep = round(totalSleep * (0.16 + noise(0.02)), 2)
    const rem = round(totalSleep * (0.22 + noise(0.02)), 2)
    const core = round(totalSleep - deep - rem, 2)
    const awake = round(0.3 + rand() * 0.3, 2)
    add('sleep_analysis', 'hr', {
      date: stamp(day, 0),
      asleep: 0,
      awake,
      core,
      deep,
      rem,
      inBed: 0,
      inBedStart: stamp(prev, 22, 45 + Math.floor(rand() * 15)),
      inBedEnd: stamp(day, 7, Math.floor(rand() * 20)),
      sleepStart: stamp(prev, 23, 10),
      sleepEnd: stamp(day, 6, 50),
      source: SOURCE,
      totalSleep: round(totalSleep, 2),
    })

    // Activity.
    const active = Math.round(380 + (hardWeek ? 220 : 0) + 60 * weekPhase + noise(70))
    const steps = Math.round(8200 + (dow === 0 || dow === 6 ? 1500 : 0) + noise(1800))
    add('step_count', 'count', { date: stamp(day, 9), qty: Math.round(steps * 0.55), source: SOURCE })
    add('step_count', 'count', { date: stamp(day, 18), qty: steps - Math.round(steps * 0.55), source: SOURCE })
    add('active_energy', 'kcal', { date: stamp(day, 12), qty: active, source: SOURCE })
    add('basal_energy_burned', 'kcal', { date: stamp(day, 12), qty: Math.round(1650 + noise(30)), source: SOURCE })
    add('apple_exercise_time', 'min', { date: stamp(day, 8), qty: Math.round(45 + (hardWeek ? 20 : 0) + noise(10)), source: SOURCE })
    add('apple_stand_hour', 'count', { date: stamp(day, 14), qty: Math.round(11 + noise(1.5)), source: SOURCE })
    add('flights_climbed', 'count', { date: stamp(day, 13), qty: Math.round(10 + noise(5)), source: SOURCE })
    add('walking_running_distance', 'km', { date: stamp(day, 12), qty: round(steps * 0.00075, 2), source: SOURCE })
    add('heart_rate', 'count/min', {
      date: stamp(day, 12),
      Min: Math.round(rhr + 2),
      Avg: Math.round(76 + noise(5)),
      Max: Math.round(158 + (hardWeek ? 12 : 0) + noise(6)),
      source: SOURCE,
    })

    // Workouts: morning strength, plus an evening tennis/cricket session.
    // Day-to-day variation inside the hard block (one lighter day) keeps weekly
    // monotony realistic instead of collapsing the SD with identical days.
    const intensity = hardWeek ? HARD_BLOCK_INTENSITY[offset] : 1
    const strengthMin = Math.round((50 + noise(6)) * intensity)
    workouts.push({
      name: 'Traditional Strength Training',
      start: stamp(day, 7, 0),
      end: stamp(day, 7 + Math.floor(strengthMin / 60), strengthMin % 60),
      duration: strengthMin,
      avgHeartRate: { qty: Math.round(122 + (hardWeek ? 8 : 0) + noise(5)) },
      maxHeartRate: { qty: Math.round(158 + (hardWeek ? 8 : 0) + noise(6)) },
    })
    const eveningMin = Math.round((70 + noise(10)) * intensity)
    workouts.push({
      name: dow % 2 === 0 ? 'Tennis' : 'Other',
      start: stamp(day, 18, 0),
      end: stamp(day, 18 + Math.floor(eveningMin / 60), eveningMin % 60),
      duration: eveningMin,
      avgHeartRate: { qty: Math.round(138 + (hardWeek ? 6 : 0) + noise(6)) },
      maxHeartRate: { qty: Math.round(172 + noise(6)) },
    })
  }

  return [
    {
      data: {
        metrics: Object.entries(metrics).map(([name, m]) => ({ name, units: m.units, data: m.data })),
        workouts,
      },
    },
  ]
}
