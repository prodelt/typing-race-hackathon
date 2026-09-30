import type { AttemptSummary, Layout, NextAction, Progress, Scale } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { levelFor, passes } from '../levels/table'
import { keyOfChar } from '../progress/order'
import { makeAction, percent, templateKeys } from './templates'

/** A Transition with fewer observations than this is never named — FR-035. */
export const MIN_TRANSITION_SAMPLES = 5
/** Rhythm Consistency below this counts as uneven; a tunable, in the same 0–100 unit as R5. */
export const RHYTHM_FLOOR = 70
/** Only a Transition less confident than this is worth naming; above it, fall through. */
export const WEAK_CONFIDENCE_CEILING = 0.8
/**
 * The multiplier on a same-finger Transition's deficit, per typing language — FR-033. Ukrainian
 * is weighted up because ЙЦУКЕН makes 18.58% of its Transitions same-finger against QWERTY's
 * 5.80% (ticket 08), so they are the likelier cause of a stall there. 1.5 lets a same-finger
 * Transition outrank a non-same-finger one that is up to 1.5 times as deficient, without drowning the
 * timing signal.
 */
export const SAME_FINGER_WEIGHT = { uk: 1.5, en: 1 } as const

export interface NextActionArgs {
  readonly progress: Progress
  /** `null` when the learner has no attempt to react to yet. */
  readonly lastAttempt: AttemptSummary | null
  readonly layout: Layout
  /** The Scale Catalogue for `layout`. */
  readonly catalogue: readonly Scale[]
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

  const weak = weakestTransition(progress, layout, startable)
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

function weakestTransition(
  progress: Progress,
  layout: Layout,
  startable: readonly Scale[],
): NextAction | undefined {
  const weight = SAME_FINGER_WEIGHT[layout.language]
  const ranked: {
    key: string
    from: string
    to: string
    confidence: number
    score: number
  }[] = []

  for (const [key, confidence] of Object.entries(progress.transitionConfidence)) {
    // Undefined is "unmeasured" (research R4); the history count is a second, independent guard so
    // a caller-supplied confidence can never make an under-sampled Transition nameable — FR-035.
    if (confidence === undefined || confidence >= WEAK_CONFIDENCE_CEILING) continue
    if (observations(progress, key) < MIN_TRANSITION_SAMPLES) continue
    const pair = parseTransitionKey(key)
    if (!pair) continue
    const multiplier = isSameFinger(layout, pair.from, pair.to) ? weight : 1
    ranked.push({
      key,
      ...pair,
      confidence,
      score: (1 - confidence) * multiplier,
    })
  }

  // Highest weighted deficit first; the key breaks ties so the choice is deterministic.
  ranked.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1))

  for (const candidate of ranked) {
    // Only name what the button can start: a Scale focused on exactly this Transition.
    const scale = startable.find(
      (s) => s.focus.kind === 'transition' && s.focus.value === candidate.key,
    )
    if (scale) {
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
