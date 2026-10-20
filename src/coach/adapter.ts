// Coach contract: the computed context a coach may see and the adapter
// interface every coach (offline rules, HTTP) implements. The context is built
// only from already-computed engine outputs; toWireContext() flattens it to
// plain numbers/labels so nothing raw (workouts, timestamps, device strings)
// can leave the device.
import type { DayView } from '../lib/firebase'
import { readiness, intensityTarget, sleepDebtHours } from '../lib/detail'
import type { Readiness, IntensityTarget } from '../lib/detail'
import { loadGuard } from '../metrics/sport'

export interface CoachContext {
  day: DayView
  readiness: Readiness
  target: IntensityTarget | null
  sleepDebtHours: number
  load: ReturnType<typeof loadGuard>
}

export interface CoachAdapter {
  brief(ctx: CoachContext): Promise<string>
  ask(ctx: CoachContext, question: string): Promise<string>
}

export function buildCoachContext(days: DayView[], i: number): CoachContext {
  const day = days[i]
  return {
    day,
    readiness: readiness(days, i),
    target: intensityTarget(day),
    sleepDebtHours: sleepDebtHours(days, i),
    load: loadGuard(day, i),
  }
}

/** One-line effort recommendation shared by the Today brief card and the
 * coach so they cannot diverge. A "push hard" (Zone 4-5) target is never shown
 * when load is caution/high-risk or readiness is Strained/Run down: the
 * cautious readiness/load wording replaces it. */
export function effortNote(ctx: CoachContext): string {
  const { target, readiness: ready, load } = ctx
  if (target == null) return ready.note
  const loadFlag = load.band === 'high-risk' || load.band === 'caution'
  const held = ready.headline === 'Strained' || ready.headline === 'Run down'
  if (target.zone === 'Zone 4-5' && (loadFlag || held)) return held ? ready.note : load.message
  return target.note
}

/** Plain numbers and labels only; safe to send to a coach server. */
export interface WireContext {
  recoveryScore: number | null
  recoveryBand: string | null
  hrvMs: number | null
  hrvNote: string
  restingHr: number | null
  sleepHours: number | null
  sleepDebtHours: number
  readiness: string
  intensityZone: string | null
  loadBand: string
  acwr: number | null
  monotony: number | null
}

export function toWireContext(ctx: CoachContext): WireContext {
  const { day } = ctx
  return {
    recoveryScore: day.recovery ? Math.round(day.recovery.score) : null,
    recoveryBand: day.recovery?.band ?? null,
    hrvMs: day.hrvMs != null ? Math.round(day.hrvMs) : null,
    hrvNote: ctx.readiness.signals[0]?.note ?? '',
    restingHr: day.restingHr != null ? Math.round(day.restingHr) : null,
    sleepHours: day.asleepMinutes != null ? Math.round((day.asleepMinutes / 60) * 10) / 10 : null,
    sleepDebtHours: Math.round(ctx.sleepDebtHours * 10) / 10,
    readiness: ctx.readiness.headline,
    intensityZone: ctx.target?.zone ?? null,
    loadBand: ctx.load.band,
    acwr: ctx.load.acwr != null ? Math.round(ctx.load.acwr * 100) / 100 : null,
    monotony: ctx.load.monotony != null ? Math.round(ctx.load.monotony * 100) / 100 : null,
  }
}
