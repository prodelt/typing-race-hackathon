import {
  catalogue,
  deriveProgress,
  focusDrillFor,
  isAcademyExerciseId,
  layouts,
  levelFor,
  nextAction,
} from '@typing-race/curriculum'
import type { Layout, NextAction, Progress, Scale } from '@typing-race/domain'
import { confidenceOf, foldConfidence } from '@typing-race/metrics'
import type { AppState } from './reduce.js'

/**
 * Everything the screens read that is not stored.
 *
 * Progress is a **fold over the attempt history**, not a field (FR-050): the same history always
 * yields the same progress, which is what lets F2 accept an out-of-order outbox without a repair
 * step. Recomputing it is cheap — a few hundred attempts of arithmetic — and the alternative, a
 * cached snapshot, is a second truth that can quietly disagree with the first.
 *
 * This module is also where `curriculum` is handed its confidence implementation. The package
 * deliberately does not depend on `metrics`, so `deriveProgress` takes the fold as a port; this
 * is the one place that supplies it.
 */

const confidencePort = { fold: foldConfidence, of: confidenceOf }

export interface DerivedState {
  readonly layout: Layout
  readonly catalogue: readonly Scale[]
  readonly progress: Progress | null
  readonly nextAction: NextAction | null
  /** The accuracy floor in force. In F1 this is always Introduction's 95% (FR-080). */
  readonly accuracyFloor: number
}

export function derive(state: AppState): DerivedState {
  const layout = layouts[state.settings.layoutId]
  const scales = catalogue[state.settings.layoutId]

  if (state.startingLevelChoice === null) {
    // Before the learner answers FR-048's question there is no progress to derive — and inventing
    // a default would silently pick a starting boundary on their behalf.
    return {
      layout,
      catalogue: scales,
      progress: null,
      nextAction: null,
      accuracyFloor: 0.95,
    }
  }

  const progress = deriveProgress({
    attempts: state.attempts,
    layout,
    catalogue: scales,
    startingLevelChoice: state.startingLevelChoice,
    confidence: confidencePort,
  })

  // The coach answers for Stage 1. An Academy attempt has its own next step on its result screen,
  // and a Stage 1 recommendation must never point at an Academy exercise id.
  const lastAttempt = state.attempts.findLast((a) => !isAcademyExerciseId(a.scaleId)) ?? null

  return {
    layout,
    catalogue: scales,
    progress,
    nextAction: nextAction({
      progress,
      lastAttempt,
      layout,
      catalogue: scales,
      focusDrill: focusDrillFor(layout, progress.unlockedSet),
    }),
    accuracyFloor: levelFor(1, progress).accuracyFloor,
  }
}
