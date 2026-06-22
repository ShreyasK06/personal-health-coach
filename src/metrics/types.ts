// Internal normalized model. Decoupled from Health Auto Export's wire format;
// Plan 2's parser maps the raw payload into these shapes.

/** Overnight cardiovascular snapshot for the night ending on `date`. */
export interface NightSample {
  date: string            // YYYY-MM-DD (the morning the night ended)
  hrvMs: number | null    // overnight SDNN, milliseconds
  restingHr: number | null// bpm
  respiratoryRate: number | null // breaths/min
}

export interface SleepInput {
  date: string            // YYYY-MM-DD
  inBedMinutes: number
  asleepMinutes: number
  deepMinutes: number
  remMinutes: number
  coreMinutes: number
  awakeMinutes: number
  bedTime: string         // ISO 8601
  wakeTime: string        // ISO 8601
}

export interface WorkoutInput {
  start: string           // ISO 8601
  end: string             // ISO 8601
  type: string            // Apple workout type, e.g. "Tennis", "Traditional Strength Training"
  sportTag?: string       // optional manual override
  avgHr: number | null
  maxHr: number | null
  durationMin: number
}

export interface Profile {
  birthYear: number
  sex: 'male' | 'female'
  hrMaxOverride?: number
  hrRest?: number              // optional fixed resting HR; otherwise use baseline
  sleepNeedBaseHours: number   // default 8.0
}

export interface Baseline {
  mean: number
  sd: number
  n: number
}

export interface SleepResult {
  score: number          // 0..100
  needHours: number
  performance: number    // 0..1
  efficiency: number     // 0..1
  consistency: number    // 0..1
  restorative: number    // 0..1
}

export interface RecoveryResult {
  score: number          // 0..100
  band: 'red' | 'amber' | 'green'
  zHrv: number
  zRhr: number
  respPenalty: number
}

export interface SessionStrain {
  type: string
  trimp: number
}

export interface StrainResult {
  sessions: SessionStrain[]
  dayTrimp: number
  strain: number         // 0..21
}

export interface LoadResult {
  acute: number          // 7-day average daily load
  chronic: number        // 28-day average daily load
  acwr: number           // acute / chronic
  monotony: number       // mean(7) / sd(7)
  trainingStrain: number // weekly load * monotony
  band: 'detraining' | 'optimal' | 'caution' | 'high-risk'
}
