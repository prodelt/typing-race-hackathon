import type { Generator } from '../types'
import { mirrorPairs } from './shared'

/**
 * `fingerIsolation` — one finger rank at a time, both hands, repeated (R6): the requirements'
 * "isolation of same-named fingers". Kept apart from `fingerSpan`, which drills one finger over its
 * own several keys; merging them would hide that the catalogue covers both bullets.
 */
export const fingerIsolation: Generator = (context) => {
  const pairs = mirrorPairs(context).map(([left, right]) => `${left.plain}${right.plain}`)
  return context.forms.flatMap((form) => pairs.map((pair) => `${pair}${pair}${pair}${form}`))
}
