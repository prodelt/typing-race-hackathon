import {
  academyLevel,
  isAcademyExerciseId,
  isFreePracticeId,
  levelForStage,
  MASTERY_STREAK,
  nextLockedKey,
  SHIFT_TOKEN,
  xpPerAttempt,
} from '@typing-race/curriculum'
import type { AttemptSummary, Layout, Progress } from '@typing-race/domain'

/**
 * What the top of the result screen celebrates, decided from the stored attempts alone: whether
 * the attempt counted, how far the mastery streak has come, the XP it earned, what opens next and
 * the slowest move in it. Pure, so the reward can never claim more than the data says.
 */

export interface MasterySlot {
  readonly id: string
  readonly accuracy: number
  /** This attempt, as opposed to an earlier pass in the streak. */
  readonly current: boolean
}

export interface Reward {
  readonly mode: AttemptSummary['mode']
  /** A Test Attempt at or above its floor: it counts toward mastery. */
  readonly passed: boolean
  readonly floor: number
  /** Consecutive passing Test Attempts on this exercise, this one included. */
  readonly streak: number
  readonly target: number
  /** The passes making up the streak, oldest first; never more than `target`. */
  readonly slots: readonly MasterySlot[]
  /** XP this attempt earned: the pass reward, plus the mastery bonus on the pass that completes it. */
  readonly xp: number
  /** The key the learner works towards next; `undefined` once every key is open. */
  readonly nextKey: string | undefined
  readonly keysOpen: number
  readonly keysTotal: number
  /** The slowest Transition typed in this attempt. */
  readonly weakest: { readonly element: string; readonly meanIkiMs: number } | null
}

/** Each attempt is judged against the floor of the level its stage is in — the Mastery Rule's. */
export function floorFor(attempt: AttemptSummary): number {
  return isAcademyExerciseId(attempt.scaleId)
    ? academyLevel.accuracyFloor
    : levelForStage(1).accuracyFloor
}

export function rewardFor(args: {
  readonly earlier: readonly AttemptSummary[]
  readonly attempt: AttemptSummary
  readonly after: Progress
  readonly layout: Layout
}): Reward {
  const { earlier, attempt, after, layout } = args
  const floor = floorFor(attempt)
  // Free practice (the daily challenge, own text) counts toward nothing: no pass, no XP.
  const free = isFreePracticeId(attempt.scaleId)
  const passed = !free && attempt.mode === 'test' && attempt.metrics.accuracy >= floor
  const streak = Math.min(MASTERY_STREAK, after.consecutivePasses[attempt.scaleId] ?? 0)

  const sameScale = (a: AttemptSummary) =>
    a.scaleId === attempt.scaleId && a.layoutId === attempt.layoutId && a.mode === 'test'
  const passes = [...earlier, attempt].filter(sameScale)
  const slots = passes.slice(Math.max(0, passes.length - streak)).map((a) => ({
    id: a.id,
    accuracy: a.metrics.accuracy,
    current: a.id === attempt.id,
  }))

  // Space and the Shift token are not keys in the "N of M" line: the Home screen counts the same way.
  const order = [...new Set([...layout.homeAnchors, ...layout.unlockOrder])].filter(
    (c) => c !== ' ' && c !== SHIFT_TOKEN,
  )
  const open = new Set(after.unlockedSet)

  let weakest: Reward['weakest'] = null
  for (const [element, ms] of Object.entries(attempt.metrics.meanIkiByTransition)) {
    if (typeof ms !== 'number') continue
    if (weakest === null || ms > weakest.meanIkiMs) weakest = { element, meanIkiMs: ms }
  }

  return {
    mode: attempt.mode,
    passed,
    floor,
    streak: passed ? Math.max(1, streak) : streak,
    target: MASTERY_STREAK,
    slots: passed ? slots : [],
    xp: free ? 0 : (xpPerAttempt([...earlier, attempt], floorFor).at(-1) ?? 0),
    nextKey: nextLockedKey(layout, after.unlockedSet),
    keysOpen: order.filter((c) => open.has(c)).length,
    keysTotal: order.length,
    weakest,
  }
}
