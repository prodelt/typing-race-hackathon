import type {
  AttemptSummary,
  FocusElement,
  Layout,
  NextAction,
  Progress,
  Scale,
} from '@typing-race/domain'
import { levelFor, passes } from '../levels/table'
import { keyOfChar } from '../progress/order'
import { weakTransitions } from '../progress/weak-transitions'
import { transitionScale } from '../scales/transitions'
import { makeAction, percent, templateKeys } from './templates'

/** Rhythm Consistency below this counts as uneven; a tunable, in the same 0–100 unit as R5. */
export const RHYTHM_FLOOR = 70
export {
  MIN_TRANSITION_SAMPLES,
  SAME_FINGER_WEIGHT,
  WEAK_CONFIDENCE_CEILING,
} from '../progress/weak-transitions'

export interface NextActionArgs {
  readonly progress: Progress
  /** `null` when the learner has no attempt to react to yet. */
  readonly lastAttempt: AttemptSummary | null
  readonly layout: Layout
  /** The Scale Catalogue for `layout`. */
  readonly catalogue: readonly Scale[]
  /**
   * The Stage 2 word drill built around a weak element, when Stage 2 is open. Given, a weak
   * Transition is trained in real words rather than in a Stage 1 drill (requirements §3.2: word
   * choice adapts to the learner's slow transitions).
   */
  readonly focusDrill?: (focus: FocusElement) => string | undefined
}

/**
 * Exactly one Next Action, by strict priority, first match wins — FR-031, FR-032:
 *
 * 1. accuracy below the level floor → `lowerTempo`
 * 2. the weakest Transition with enough samples → `weakTransition`
 * 3. uneven rhythm (accuracy is acceptable by now) → `evenRhythm`
 * 4. the next key, or the next scale → `nextKey`
 *
 * The return type is a single `NextAction`: "exactly one, never zero, never two" (SC-010) is
 * enforced by the type, and rule 4 always produces a value, so there is nothing to check at run
 * time.
 */
export function nextAction(args: NextActionArgs): NextAction {
  const { progress, lastAttempt, layout, catalogue } = args
  const unlocked = new Set(progress.unlockedSet)
  const startable = catalogue.filter((scale) => scale.requires.every((char) => unlocked.has(char)))

  if (lastAttempt) {
    const level = levelFor(1, progress)
    if (!passes(lastAttempt.metrics.accuracy, level)) {
      return makeAction(
        'lowerTempo',
        templateKeys.lowerTempo,
        {
          accuracy: percent(lastAttempt.metrics.accuracy),
          floor: percent(level.accuracyFloor),
        },
        lastAttempt.scaleId,
      )
    }
  }

  const weak = weakestTransition(progress, layout, startable, args.focusDrill)
  if (weak) return weak

  if (lastAttempt && lastAttempt.metrics.rhythmConsistency.value < RHYTHM_FLOOR) {
    return makeAction(
      'evenRhythm',
      templateKeys.evenRhythm,
      { rhythm: Math.round(lastAttempt.metrics.rhythmConsistency.value) },
      lastAttempt.scaleId,
    )
  }

  return nextKeyOrScale(progress, layout, catalogue, startable, unlocked)
}

/**
 * Rule 2: the weakest Transition with enough samples, and a drill that starts it. An authored Scale
 * focused on exactly this Transition wins; otherwise the drill is built for it on demand
 * (`transitionScale`), which is what lets the rule fire at all — the authored catalogue focuses on
 * keys. A Transition whose keys are not all unlocked is skipped for the next weakest.
 */
function weakestTransition(
  progress: Progress,
  layout: Layout,
  startable: readonly Scale[],
  focusDrill?: (focus: FocusElement) => string | undefined,
): NextAction | undefined {
  const unlocked = new Set(progress.unlockedSet)
  for (const candidate of weakTransitions(progress, layout)) {
    const values = {
      transition: candidate.key,
      from: candidate.from,
      to: candidate.to,
      confidence: percent(candidate.confidence),
    }
    const words = focusDrill?.({ kind: 'transition', value: candidate.key })
    if (words !== undefined) {
      return makeAction('weakTransition', templateKeys.weakTransition, values, words)
    }
    const scale =
      startable.find((s) => s.focus.kind === 'transition' && s.focus.value === candidate.key) ??
      transitionScale(layout, candidate.key)
    if (scale?.requires.every((char) => unlocked.has(char))) {
      return makeAction(
        'weakTransition',
        templateKeys.weakTransition,
        {
          transition: candidate.key,
          from: candidate.from,
          to: candidate.to,
          confidence: percent(candidate.confidence),
        },
        scale.id,
      )
    }
  }
  return undefined
}

function nextKeyOrScale(
  progress: Progress,
  layout: Layout,
  catalogue: readonly Scale[],
  startable: readonly Scale[],
  unlocked: ReadonlySet<string>,
): NextAction {
  const nextLocked = layout.unlockOrder.find((char) => !unlocked.has(char))
  if (nextLocked !== undefined) {
    const scale = startable.find((s) => s.focus.kind === 'key' && s.focus.value === nextLocked)
    if (scale) {
      const finger = keyOfChar(layout, nextLocked)?.finger ?? ''
      return makeAction('nextKey', templateKeys.nextKey, { key: nextLocked, finger }, scale.id)
    }
  }

  // Every key is unlocked, or the next key's Scale is not startable yet: offer the first unfinished
  // startable Scale, then any startable one, then anything at all — never nothing (SC-010).
  const done = new Set(progress.completedScales)
  const scale = startable.find((s) => !done.has(s.id)) ?? startable[0] ?? catalogue[0]
  return makeAction('nextKey', templateKeys.nextScale, { scale: scale?.id ?? '' }, scale?.id ?? '')
}
