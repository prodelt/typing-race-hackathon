import type { Layout, Progress, TransitionKey } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { keyOfChar } from './order'

/** A Transition with fewer observations than this is never named — FR-035. */
export const MIN_TRANSITION_SAMPLES = 5
/** Only a Transition less confident than this is worth naming; above it, fall through. */
export const WEAK_CONFIDENCE_CEILING = 0.8
/**
 * The multiplier on a same-finger Transition's deficit, per typing language — FR-033. Ukrainian
 * is weighted up because ЙЦУКЕН makes 18.58% of its Transitions same-finger against QWERTY's
 * 5.80%, so they are the likelier cause of a stall there. 1.5 lets a same-finger Transition
 * outrank a non-same-finger one that is up to 1.5 times as deficient, without drowning the timing
 * signal.
 */
export const SAME_FINGER_WEIGHT = { uk: 1.5, en: 1 } as const

export interface WeakTransition {
  readonly key: TransitionKey
  readonly from: string
  readonly to: string
  /** In [0, 1): below {@link WEAK_CONFIDENCE_CEILING} by construction. */
  readonly confidence: number
  /** The weighted deficit the ranking sorts on; higher is weaker. */
  readonly score: number
}

/** Whether a Transition's two characters share one finger, read from the layout's own keys. */
function isSameFinger(layout: Layout, from: string, to: string): boolean {
  const a = keyOfChar(layout, from)
  const b = keyOfChar(layout, to)
  return a !== undefined && b !== undefined && a.hand === b.hand && a.finger === b.finger
}

/** Observations of a Transition across the whole history, read from aggregates — FR-035. */
function observations(progress: Progress, key: string): number {
  return progress.history.reduce(
    (sum, attempt) => sum + (attempt.aggregates.transitions[key]?.count ?? 0),
    0,
  )
}

/**
 * The learner's weak Transitions, weakest first: every Transition measured often enough to judge
 * and less confident than the ceiling, ranked by its confidence deficit, with same-finger moves
 * weighted up for the layout's language. Confidence folds timing and misses together, so this is
 * "slowest or most error-prone" in one order. The key breaks ties, so the same history always
 * gives the same order.
 */
export function weakTransitions(progress: Progress, layout: Layout): WeakTransition[] {
  const weight = SAME_FINGER_WEIGHT[layout.language]
  const ranked: WeakTransition[] = []

  for (const [key, confidence] of Object.entries(progress.transitionConfidence)) {
    // Undefined is "unmeasured" (research R4); the history count is a second, independent guard so
    // a caller-supplied confidence can never make an under-sampled Transition nameable — FR-035.
    if (confidence === undefined || confidence >= WEAK_CONFIDENCE_CEILING) continue
    if (observations(progress, key) < MIN_TRANSITION_SAMPLES) continue
    const pair = parseTransitionKey(key)
    if (!pair) continue
    const multiplier = isSameFinger(layout, pair.from, pair.to) ? weight : 1
    ranked.push({ key, ...pair, confidence, score: (1 - confidence) * multiplier })
  }

  return ranked.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1))
}
