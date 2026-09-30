import type {
  AttemptAggregates,
  ElementStats,
  KeystrokeEventLog,
  Layout,
} from '@typing-race/domain'
import { transitionKey } from '@typing-race/domain'
import { RHYTHM_BREAK_MS } from './constants'
import { charKeystrokes } from './keystrokes'

const EMPTY: ElementStats = { count: 0, misses: 0, sumIki: 0, sumIkiSq: 0 }

/** `iki` is `undefined` for a miss: a wrong key's timing is never recorded. */
function record(into: Map<string, ElementStats>, element: string, iki: number | undefined): void {
  const stats = into.get(element) ?? EMPTY
  into.set(
    element,
    iki === undefined
      ? { ...stats, count: stats.count + 1, misses: stats.misses + 1 }
      : {
          count: stats.count + 1,
          misses: stats.misses,
          sumIki: stats.sumIki + iki,
          sumIkiSq: stats.sumIkiSq + iki ** 2,
        },
  )
}

/**
 * Per-key and per-Transition count, misses, and sum and sum-of-squares of intervals — the only
 * input to progress and Confidence (FR-026, FR-028).
 *
 * An element is the character the text *awaited*, so a miss lands on the key the learner failed to
 * reach, which is what Confidence must lower. Timing comes from correct keystrokes only (research
 * R4): a wrong key's interval is hesitation the miss already counts. A correct keystroke also needs
 * a usable interval to be recorded — not the first event of the log, whose delay is reaction time,
 * and not one over the break threshold. Dropping those hits keeps `sumIki / hits` a true mean, at
 * the price of at most one observation per attempt and one per break.
 *
 * `layout` is part of the contract so a future per-finger rollup needs no signature change; the
 * element identity here is the character, which does not depend on it.
 */
export function computeAggregates(args: {
  log: KeystrokeEventLog
  text: string
  layout: Layout
}): AttemptAggregates {
  const keys = new Map<string, ElementStats>()
  const transitions = new Map<string, ElementStats>()

  for (const keystroke of charKeystrokes(args.log, args.text)) {
    const { awaited, previous } = keystroke
    if (awaited === undefined) continue
    const usable = keystroke.index > 0 && keystroke.dt <= RHYTHM_BREAK_MS
    if (keystroke.correct && !usable) continue
    const iki = keystroke.correct ? keystroke.dt : undefined
    record(keys, awaited, iki)
    if (previous !== undefined) record(transitions, transitionKey(previous, awaited), iki)
  }

  return {
    keys: Object.fromEntries(keys),
    transitions: Object.fromEntries(transitions),
  }
}
