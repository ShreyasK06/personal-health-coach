import type { NightSample, Baseline, RecoveryResult } from './types'

export const RECOVERY_WEIGHTS = {
  hrv: 0.5,
  rhr: 0.25,
  sleep: 0.2,
  resp: 0.05,
} as const

export interface RecoveryInput {
  today: NightSample
  hrvBaseline: Baseline
  rhrBaseline: Baseline
  respBaseline: Baseline
  sleepPerformance: number // 0..1 from computeSleep
}

const z = (x: number, b: Baseline) => (x - b.mean) / b.sd

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const { today } = input

  const zHrv = today.hrvMs == null ? 0 : z(today.hrvMs, input.hrvBaseline)
  const zRhr = today.restingHr == null ? 0 : z(today.restingHr, input.rhrBaseline)
  const respPenalty =
    today.respiratoryRate == null ? 0 : Math.max(0, z(today.respiratoryRate, input.respBaseline))

  // Map sleep performance (centered ~0.85, span ~0.15) to a z-like term.
  const sleepZ = (input.sleepPerformance - 0.85) / 0.15

  const composite =
    RECOVERY_WEIGHTS.hrv * zHrv +
    RECOVERY_WEIGHTS.rhr * -zRhr + // higher RHR is worse
    RECOVERY_WEIGHTS.sleep * sleepZ +
    RECOVERY_WEIGHTS.resp * -respPenalty

  // Logistic squash; gain chosen so +/- ~1.5 composite spans most of 0..100.
  const GAIN = 1.6
  const score = Math.round(100 / (1 + Math.exp(-GAIN * composite)))

  const band: RecoveryResult['band'] = score < 34 ? 'red' : score < 67 ? 'amber' : 'green'

  return { score, band, zHrv, zRhr, respPenalty }
}
