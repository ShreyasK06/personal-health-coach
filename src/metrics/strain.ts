import type { WorkoutInput, Profile, SessionStrain, StrainResult } from './types'

export const STRAIN_TAU = 120 // day-TRIMP scale; tune in Plan 2

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function hrMax(profile: Profile, currentYear: number): number {
  if (profile.hrMaxOverride) return profile.hrMaxOverride
  const age = currentYear - profile.birthYear
  return 211 - 0.64 * age // Nes et al.
}

export function sessionTrimp(args: {
  durationMin: number
  avgHr: number
  hrRest: number
  hrMax: number
  sex: 'male' | 'female'
}): number {
  const denom = args.hrMax - args.hrRest
  if (denom <= 0 || args.durationMin <= 0) return 0
  const hrr = clamp01((args.avgHr - args.hrRest) / denom)
  const coeff = args.sex === 'male' ? 0.64 : 0.86
  const exp = args.sex === 'male' ? 1.92 : 1.67
  return args.durationMin * hrr * coeff * Math.exp(exp * hrr)
}

/** Saturating 0..21 map of cumulative daily TRIMP. */
export function dayStrain(dayTrimp: number, tau: number = STRAIN_TAU): number {
  if (dayTrimp <= 0) return 0
  return Math.min(21, 21 * (1 - Math.exp(-dayTrimp / tau)))
}

export function computeStrain(
  workouts: WorkoutInput[],
  ctx: { hrRest: number; hrMax: number; sex: 'male' | 'female' },
): StrainResult {
  const sessions: SessionStrain[] = workouts.map((w) => ({
    type: w.sportTag ?? w.type,
    trimp:
      w.avgHr == null
        ? 0
        : sessionTrimp({
            durationMin: w.durationMin,
            avgHr: w.avgHr,
            hrRest: ctx.hrRest,
            hrMax: ctx.hrMax,
            sex: ctx.sex,
          }),
  }))
  const dayTrimp = sessions.reduce((a, s) => a + s.trimp, 0)
  return { sessions, dayTrimp, strain: dayStrain(dayTrimp) }
}
