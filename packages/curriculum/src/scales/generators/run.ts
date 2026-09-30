import type { Generator } from '../types'
import { homeRowChars, reverse, windowsOf } from './shared'

/** How many home-row keys one sweep covers. */
export const RUN_WINDOW = 4

/**
 * `run` — the home row in groups of four, left to right and then right to left (R6). The Focus
 * Element closes each forward group and opens each backward one, so it is typed at the turn.
 *
 * The row is whatever home-row keys are available, which is how a learner who has unlocked `g`
 * gets `dfgh` without a different generator. Fewer than four keys yield nothing.
 */
export const run: Generator = (context) => {
  const windows = windowsOf(homeRowChars(context), RUN_WINDOW)
  return context.forms.flatMap((form) =>
    windows.flatMap((window) => [`${window}${form}`, `${form}${reverse(window)}`]),
  )
}
