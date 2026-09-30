import type {
  AttemptSummary,
  ConfidenceState,
  Layout,
  Progress,
  Scale,
  StartingLevelChoice,
} from '@typing-race/domain'
import { levelForStage, passes } from '../levels/table'
import { byCompletion } from './order'
import { boundaryFor } from './starting-level'
import type { ConfidencePort } from './types'

/** Bumped when the fold changes, so a stale stored snapshot is detectable. */
export const DERIVED_VERSION = 1
/** Consecutive passing Test attempts that satisfy the Mastery Rule — FR-039. */
export const MASTERY_STREAK = 3
/** How many of the most recent attempts Stage 1 completion averages over — FR-044. */
export const STAGE1_WINDOW = 5
/** The accuracy those attempts must reach, a fraction — FR-044. */
export const STAGE1_ACCURACY_FLOOR = 0.96

export interface DeriveProgressArgs {
  /** Any order: the fold sorts defensively — FR-050. */
  readonly attempts: readonly AttemptSummary[]
  readonly layout: Layout
  /**
   * The Scale Catalogue for this layout. The contract lists three arguments; this is a fourth
   * because FR-041 ("a Scale whose Focus Element is that key") and FR-044 ("every scale is
   * complete") cannot be evaluated from a `scaleId` alone.
   */
  readonly catalogue: readonly Scale[]
  readonly startingLevelChoice: StartingLevelChoice
  /**
   * The confidence fold, injected because `curriculum` does not depend on `metrics`. Omitted, the
   * confidence records come back empty — which is what "unmeasured" means (research R4).
   */
  readonly confidence?: ConfidencePort
}

const EMPTY_CONFIDENCE: ConfidenceState = { keys: {}, transitions: {} }

/**
 * The single source of derived state: a pure fold over the attempts in completion order. Same
 * history in, same progress out — FR-050.
 *
 * **No speed appears anywhere in this function.** The only per-attempt inputs are `mode`,
 * `scaleId`, `layoutId`, `completedAt` and `metrics.accuracy`, so no sequence of attempts, however
 * fast, can unlock anything — FR-040, SC-009. It also never sees a keystroke log (`AttemptSummary`
 * has none), which is what makes pruning logs a no-op — FR-081, SC-019.
 */
export function deriveProgress(args: DeriveProgressArgs): Progress {
  const { layout, catalogue, startingLevelChoice, confidence } = args
  const level = levelForStage(1)
  const scaleById = new Map(catalogue.map((scale) => [scale.id, scale]))

  const streaks = new Map<string, number>()
  const completed = new Set<string>()
  const masteredKeys = new Set<string>()
  const history: AttemptSummary[] = []
  let confidenceState = EMPTY_CONFIDENCE

  for (const attempt of byCompletion(args.attempts)) {
    // One Progress per typing language — FR-051. Another layout's attempts are not ours.
    if (attempt.layoutId !== layout.id) continue
    history.push(summarise(attempt))
    if (confidence) confidenceState = confidence.fold(confidenceState, attempt.aggregates)

    // Practice neither advances nor resets — FR-039.
    if (attempt.mode !== 'test') continue
    const streak = passes(attempt.metrics.accuracy, level)
      ? (streaks.get(attempt.scaleId) ?? 0) + 1
      : 0
    streaks.set(attempt.scaleId, streak)
    if (streak < MASTERY_STREAK) continue

    completed.add(attempt.scaleId)
    const focus = scaleById.get(attempt.scaleId)?.focus
    // Only a Scale whose Focus Element is a key can unlock one — FR-041.
    if (focus?.kind === 'key') masteredKeys.add(focus.value)
  }

  const unlockedSet = unlockedFor(layout, startingLevelChoice, masteredKeys)
  const last = history.slice(-STAGE1_WINDOW)
  const recentAccuracy =
    last.reduce((sum, attempt) => sum + attempt.metrics.accuracy, 0) / (last.length || 1)
  const stage1Complete =
    catalogue.length > 0 &&
    catalogue.every((scale) => completed.has(scale.id)) &&
    last.length === STAGE1_WINDOW &&
    recentAccuracy >= STAGE1_ACCURACY_FLOOR

  return {
    derivedVersion: DERIVED_VERSION,
    language: layout.language,
    unlockedSet,
    consecutivePasses: Object.fromEntries(streaks),
    completedScales: [...completed],
    keyConfidence: confidence
      ? confidenceRecord(confidence, confidenceState, confidenceState.keys)
      : {},
    transitionConfidence: confidence
      ? confidenceRecord(confidence, confidenceState, confidenceState.transitions)
      : {},
    stage: { current: 1, stage1Complete },
    startingLevelChoice,
    history,
  }
}

/**
 * Anchors and space, then a prefix of `unlockOrder` — FR-042.
 *
 * The prefix length starts at the starting-level boundary and then advances over every next key
 * whose Scale has been mastered. Because the length only ever moves forward from `max(boundary,
 * earned-from-zero)`, a later, lower starting-level choice cannot shrink what was earned — FR-073.
 */
function unlockedFor(
  layout: Layout,
  choice: StartingLevelChoice,
  masteredKeys: ReadonlySet<string>,
): string[] {
  const order = layout.unlockOrder
  let earnedFromZero = 0
  while (masteredKeys.has(order[earnedFromZero] ?? '')) earnedFromZero++
  let length = Math.max(boundaryFor(layout, choice), earnedFromZero)
  while (masteredKeys.has(order[length] ?? '')) length++
  // The space bar is unlocked from the first exercise, like the anchors — FR-042.
  return [...layout.homeAnchors, ' ', ...order.slice(0, length)]
}

function confidenceRecord(
  port: ConfidencePort,
  state: ConfidenceState,
  elements: Readonly<Record<string, unknown>>,
): Record<string, number | undefined> {
  return Object.fromEntries(
    Object.keys(elements).map((element) => [element, port.of(state, element)]),
  )
}

/**
 * Copies exactly the summary fields. A caller may hand over full Attempts (structurally they are
 * summaries with more), and letting a keystroke log ride along in `history` would make the result
 * depend on whether a log had been pruned — the one thing SC-019 forbids.
 */
function summarise(attempt: AttemptSummary): AttemptSummary {
  return {
    id: attempt.id,
    scaleId: attempt.scaleId,
    layoutId: attempt.layoutId,
    language: attempt.language,
    mode: attempt.mode,
    seed: attempt.seed,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    elapsedMs: attempt.elapsedMs,
    metrics: attempt.metrics,
    aggregates: attempt.aggregates,
  }
}
