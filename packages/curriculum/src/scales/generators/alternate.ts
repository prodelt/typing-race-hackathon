import type { Generator } from '../types'
import { crossPairs } from './shared'

/**
 * `alternate` — the hands take turns without ever pairing a finger with its namesake: left outward
 * against right inward (R6). Every pair alternates hands, so each keystroke is the other hand's
 * turn; the last item chains all pairs into one alternating run.
 */
export const alternate: Generator = (context) => {
  const pairs = crossPairs(context).map(([left, right]) => `${left.plain}${right.plain}`)
  const chain = pairs.join('')
  return context.forms.flatMap((form) => [
    ...pairs.map((pair) => `${pair}${form}${pair}`),
    ...(pairs.length > 0 ? [`${chain}${form}`] : []),
  ])
}
