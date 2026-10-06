import type { AttemptSummary } from '@typing-race/domain'

/**
 * Whether an attempt's typing was plausibly a hand at a keyboard (ADR-0003, 2026-10-06).
 *
 * `packages/metrics` gives the verdict when it computes the attempt (`metrics.implausible`); this
 * is the one place the folds read it. An attempt that was not typed by hand is kept and keeps its
 * result screen, but counts toward nothing: mastery, unlocks, confidence, XP, records, streak.
 * An attempt stored before the rule existed carries no verdict, and counts.
 */
export function typedByHand(attempt: Pick<AttemptSummary, 'metrics'>): boolean {
  return attempt.metrics.implausible === undefined
}
