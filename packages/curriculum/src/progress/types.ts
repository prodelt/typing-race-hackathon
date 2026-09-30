import type { AttemptAggregates, ConfidenceState } from '@typing-race/domain'

/**
 * The two functions of `metrics` the progress fold needs, passed in rather than imported:
 * `curriculum` has no dependency on `metrics`, and the direction of that dependency is not ours to
 * add. Structurally identical to `foldConfidence` and `confidenceOf` in `contracts/metrics.md`, so
 * the caller writes `{ fold: foldConfidence, of: confidenceOf }`.
 *
 * Confidence is read, never computed, here — and it gates nothing (research R4).
 */
export interface ConfidencePort {
  fold(prior: ConfidenceState, aggregates: AttemptAggregates): ConfidenceState
  of(state: ConfidenceState, element: string): number | undefined
}
