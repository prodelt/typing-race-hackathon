# Contract: `packages/metrics`

**Owner**: Foundational phase · **Spec**: [../spec.md](../spec.md) · **Formulas**:
[../research.md R4, R5](../research.md#r4-confidence-per-key-and-per-transition)

Pure functions over a `KeystrokeEventLog`. **No browser API, no Node API** — this package is imported
unchanged by F2's `submit-attempt` Edge Function, which recomputes every metric server-side rather
than trusting a client number
([ADR-0007](../../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md)). That is why
it takes a log and a layout rather than an `Engine`.

## Surface

```ts
export function computeMetrics(args: {
  log: KeystrokeEventLog
  text: string
  layout: Layout
  elapsedMs: number
}): AttemptMetrics

export function computeAggregates(args: {
  log: KeystrokeEventLog
  text: string
  layout: Layout
}): AttemptAggregates

/** Folds one attempt's aggregates into a running confidence state. Order-dependent by design. */
export function foldConfidence(
  prior: ConfidenceState,
  aggregates: AttemptAggregates,
): ConfidenceState

export function confidenceOf(state: ConfidenceState, element: string): number | undefined

export const REFERENCE_IKI_MS = 400
export const CONFIDENCE_HALF_LIFE = 10
export const CONFIDENCE_MIN_SAMPLES = 5
export const RHYTHM_BREAK_MS = 3000
```

## Behaviour this contract guarantees

- `accuracy` is correct character keystrokes over **all** character keystrokes. A wrong keystroke
  stays counted after a Backspace correction; Backspace is not in the denominator (FR-024). This is
  the requirements' check §8.2 and it is the single most-tested line in F1.
- `spm` is the primary figure; `wpm` is exactly `spm / 5` (FR-023).
- `rhythmConsistency` is `100 × max(0, 1 − cv)` over eligible intervals, and reports
  `breaksExcluded` so a flattering number cannot hide its exclusions.
- `foldConfidence` is exponentially weighted with a half-life of 10 observations; timing is taken from
  correct keystrokes only; the result is `undefined` below five observations rather than zero.
- **Confidence gates nothing.** It selects the Focus Element and the guide tier. Mastery is accuracy
  alone (FR-039) and speed never gates progression (FR-040), so the speed term inside confidence
  smuggles in no speed gate. This sentence is published on the Formulas page.
- Every function is deterministic: the same inputs always give the same output, bit for bit.

## Hidden inside

Interval extraction and eligibility filtering, the sum/sum-of-squares recovery of standard deviation,
the decay bookkeeping, and the transition-key encoding (`"a>b"`). Callers see numbers, never
intermediate accumulators.

## Test obligations

The requirements' §8.1 and §8.2 checks are fixed worked examples with hand-computed expected values,
including examples with corrected errors. Property tests: `accuracy ∈ [0, 1]`; `wpm × 5 === spm`;
`rhythmConsistency ∈ [0, 100]`; `confidenceOf` is `undefined` or in `[0, 1]`; adding a hit never
lowers confidence, adding a miss never raises it, a shorter interval never lowers it; recomputing
metrics from the same log twice is identical. Commutativity of `foldConfidence` is **not** asserted —
recency is the point.
