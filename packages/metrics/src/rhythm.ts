import type { KeystrokeEventLog, RhythmConsistency } from '@typing-race/domain'
import { RHYTHM_BREAK_MS } from './constants'
import { charKeystrokes } from './keystrokes'

/**
 * `100 × max(0, 1 − cv)` over eligible intervals — research R5, FR-026.
 *
 * Eligible means between two consecutive correct keystrokes: the delay before the first key, any
 * interval touching a wrong key, a Backspace or an ignored event, and any interval over 3000 ms are
 * left out. The last are counted in `breaksExcluded` so a smooth figure cannot hide them.
 *
 * Fewer than two eligible intervals have no spread worth normalising, and one interval would score
 * a meaningless 100, so those report `0`. So does a mean of zero, where the coefficient of variation
 * is undefined.
 */
export function rhythmConsistencyOf(log: KeystrokeEventLog): RhythmConsistency {
  const intervals: number[] = []
  let breaksExcluded = 0

  for (const keystroke of charKeystrokes(log, '')) {
    if (!keystroke.correct || !keystroke.followsCorrectChar) continue
    if (keystroke.dt > RHYTHM_BREAK_MS) breaksExcluded += 1
    else intervals.push(keystroke.dt)
  }

  if (intervals.length < 2) return { value: 0, breaksExcluded }
  const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
  if (mean <= 0) return { value: 0, breaksExcluded }
  const variance =
    intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length
  const cv = Math.sqrt(variance) / mean
  return { value: 100 * Math.max(0, 1 - cv), breaksExcluded }
}
