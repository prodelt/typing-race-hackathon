import type {
  AttemptAggregates,
  ConfidenceState,
  ElementStats,
  WeightedCounters,
} from '@typing-race/domain'
import { CONFIDENCE_HALF_LIFE, CONFIDENCE_MIN_SAMPLES, REFERENCE_IKI_MS } from './constants'

/** `2^(−1/10)`: the factor that halves a counter after exactly `CONFIDENCE_HALF_LIFE` attempts. */
const DECAY = 2 ** (-1 / CONFIDENCE_HALF_LIFE)

const ZERO: WeightedCounters = { wHits: 0, wMisses: 0, wSumIki: 0, wSumIkiSq: 0 }

function foldElements(
  prior: Readonly<Record<string, WeightedCounters>>,
  observed: Readonly<Record<string, ElementStats>>,
): Record<string, WeightedCounters> {
  const next = new Map(Object.entries(prior))
  for (const [element, stats] of Object.entries(observed)) {
    // Only an element seen in this attempt decays: one absent from an exercise has not been
    // observed again, so it should not lose confidence merely because the learner did not press it.
    const old = next.get(element) ?? ZERO
    next.set(element, {
      wHits: old.wHits * DECAY + (stats.count - stats.misses),
      wMisses: old.wMisses * DECAY + stats.misses,
      wSumIki: old.wSumIki * DECAY + stats.sumIki,
      wSumIkiSq: old.wSumIkiSq * DECAY + stats.sumIkiSq,
    })
  }
  return Object.fromEntries(next)
}

/**
 * Folds one attempt's aggregates into the running Confidence counters — research R4, FR-029.
 *
 * Order-dependent by design: the decay makes recent attempts weigh more, which is the point.
 */
export function foldConfidence(
  prior: ConfidenceState,
  aggregates: AttemptAggregates,
): ConfidenceState {
  return {
    keys: foldElements(prior.keys, aggregates.keys),
    transitions: foldElements(prior.transitions, aggregates.transitions),
  }
}

/**
 * `accuracyFactor × speedFactor`, or `undefined` below five weighted observations.
 *
 * `element` is a single character for a Key, or a `"a>b"` Transition key. A Key is never longer
 * than one character and a Transition is always at least three, so the two cannot collide.
 *
 * Speed is taken over hits only, and a mean of zero (an instantaneous hit) is as fast as anything
 * can be, so it scores the full factor rather than dividing by zero.
 */
export function confidenceOf(state: ConfidenceState, element: string): number | undefined {
  const counters = state.keys[element] ?? state.transitions[element]
  if (counters === undefined) return undefined
  const n = counters.wHits + counters.wMisses
  if (n < CONFIDENCE_MIN_SAMPLES) return undefined
  // All misses: accuracy is zero, and there is no mean interval to take.
  if (counters.wHits <= 0) return 0
  const accuracyFactor = counters.wHits / n
  const meanIki = counters.wSumIki / counters.wHits
  const speedFactor = meanIki <= 0 ? 1 : Math.min(1, REFERENCE_IKI_MS / meanIki)
  return accuracyFactor * speedFactor
}
