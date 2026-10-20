// Deterministic, offline coach. Reuses the wording and thresholds from
// lib/detail (readiness, intensityTarget, sleep debt) rather than re-deriving
// them. Never diagnoses: copy is general training/sleep guidance only.
import type { CoachAdapter, CoachContext } from './adapter'

const TRAIN_RE = /play|train|workout|hard|push/i
const SLEEP_RE = /sleep|tired|rest/i

function recoveryLine(ctx: CoachContext): string {
  const rec = ctx.day.recovery
  if (rec == null) {
    return 'Your recovery baseline is still building, so there is no recovery score for today.'
  }
  return `Recovery is ${Math.round(rec.score)}% (${rec.band}).`
}

function sleepLine(ctx: CoachContext): string {
  const mins = ctx.day.asleepMinutes
  const hours = mins != null ? `${(mins / 60).toFixed(1)} h` : null
  const debt = ctx.sleepDebtHours
  const base = hours ? `You slept ${hours}.` : 'No sleep data for last night.'
  return debt > 1
    ? `${base} You are carrying about ${debt.toFixed(1)} h of sleep debt this week.`
    : `${base} Sleep debt is low.`
}

function trainingAdvice(ctx: CoachContext): string {
  const t = ctx.target
  const guard = ctx.load.band === 'high-risk' || ctx.load.band === 'caution' ? ` ${ctx.load.message}` : ''
  if (t == null) {
    return `Without a recovery reading, train to feel and keep the effort conversational.${guard}`
  }
  return `Suggested intensity: ${t.note}.${guard}`
}

function sleepAdvice(ctx: CoachContext): string {
  const tip =
    ctx.sleepDebtHours > 1
      ? 'An earlier night in the next day or two is the simplest way to pay it down.'
      : 'Keep a steady bedtime and wake time to stay there.'
  return `${sleepLine(ctx)} ${tip}`
}

function briefText(ctx: CoachContext): string {
  const hrv = ctx.readiness.signals[0]?.note ?? 'No HRV reading today.'
  const zone = ctx.target ? `Intensity: ${ctx.target.note}.` : 'No intensity target without a recovery reading; train to feel.'
  return [
    `${ctx.readiness.headline} today. ${recoveryLine(ctx)}`,
    `HRV: ${hrv}`,
    sleepLine(ctx),
    zone,
  ].join('\n')
}

export const rulesAdapter: CoachAdapter = {
  async brief(ctx) {
    return briefText(ctx)
  },
  async ask(ctx, question) {
    const q = question.trim()
    if (q === '') return briefText(ctx)
    if (TRAIN_RE.test(q)) return `${recoveryLine(ctx)} ${trainingAdvice(ctx)}`
    if (SLEEP_RE.test(q)) return sleepAdvice(ctx)
    return `${briefText(ctx)}\nYou can ask me about training intensity or sleep.`
  },
}
