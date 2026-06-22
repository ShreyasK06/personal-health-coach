import type { Baseline } from './types'

const SD_FLOOR = 1e-6

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

/** Exponentially weighted moving average. `xs` is oldest -> newest. */
export function ewma(xs: number[], alpha: number): number {
  if (xs.length === 0) return 0
  let acc = xs[0]
  for (let i = 1; i < xs.length; i++) acc = alpha * xs[i] + (1 - alpha) * acc
  return acc
}

/** Mean/SD over the most recent `windowDays` values. SD floored to avoid /0. */
export function rollingBaseline(history: number[], windowDays: number): Baseline {
  const window = history.slice(-windowDays)
  return {
    mean: mean(window),
    sd: Math.max(stdDev(window), SD_FLOOR),
    n: window.length,
  }
}
