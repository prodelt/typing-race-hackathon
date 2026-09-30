import type { Generator } from '../types'
import { mirrorPairs, reverse } from './shared'

/**
 * `mirror` — the same-named finger of each hand paired, edges to centre and back out (R6). Each
 * pair is a palindrome around the Focus Element; the last item is the whole sweep, so the learner
 * also meets the long form the requirements describe.
 */
export const mirror: Generator = (context) => {
  const pairs = mirrorPairs(context).map(([left, right]) => `${left.plain}${right.plain}`)
  const sweep = pairs.join('')
  return context.forms.flatMap((form) => [
    ...pairs.map((pair) => `${pair}${form}${reverse(pair)}`),
    ...(pairs.length > 0 ? [`${sweep}${form}${reverse(sweep)}`] : []),
  ])
}
