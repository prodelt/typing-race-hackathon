import type { KeystrokeEventLog } from '@typing-race/domain'
import { charKeystrokes } from './keystrokes'

export interface AccuracyCounts {
  readonly correct: number
  /** Every character keystroke, wrong ones included even after a Backspace correction. */
  readonly total: number
}

/**
 * Counts character keystrokes. Backspace and `ignored` events are not character keystrokes, so they
 * appear in neither figure — FR-024, FR-020.
 */
export function countKeystrokes(log: KeystrokeEventLog): AccuracyCounts {
  const keystrokes = charKeystrokes(log, '')
  return {
    correct: keystrokes.filter((keystroke) => keystroke.correct).length,
    total: keystrokes.length,
  }
}

/**
 * Correct character keystrokes over all character keystrokes, in [0, 1] — FR-024.
 *
 * Counted from the log rather than from the final text, which is the whole point: a wrong key that
 * the learner erased is still a wrong key. An attempt with no character keystrokes has no accuracy
 * to flatter, so it reports `0` rather than a perfect score.
 */
export function accuracyOf(log: KeystrokeEventLog): number {
  const { correct, total } = countKeystrokes(log)
  return total === 0 ? 0 : correct / total
}
