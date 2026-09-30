import type { Generator } from '../types'
import { isAvailable, reverse } from './shared'

/**
 * `run` — the home row in groups of four, left to right and then right to left (R6). The Focus
 * Element closes each forward group and opens each backward one, so it is typed at the turn.
 *
 * The row is whatever home-row keys are available, which is how a learner who has unlocked `g`
 * gets `dfgh` without a different generator. Fewer than four keys yield nothing.
 */
export const run: Generator = (context) => {
  const { layout } = context
  const row = layout.keys
    .filter(
      (key) =>
        key.row === 'home' &&
        (key.kind === 'letter' || layout.homeAnchors.includes(key.plain)) &&
        isAvailable(context, key),
    )
    .map((key) => key.plain)
  const windows = Array.from({ length: Math.max(0, row.length - 3) }, (_, start) =>
    row.slice(start, start + 4).join(''),
  )
  return context.forms.flatMap((form) =>
    windows.flatMap((window) => [`${window}${form}`, `${form}${reverse(window)}`]),
  )
}
