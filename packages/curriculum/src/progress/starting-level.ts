import type { Layout, StartingLevelChoice } from '@typing-race/domain'
import { keyOfChar } from './order'

/**
 * How many entries of `unlockOrder` a starting-level choice opens before any attempt — FR-048.
 * Always a prefix length, so the unlocked set stays a prefix — FR-042.
 *
 * - `neverTouchTyped`: none. The anchors and space are the starting point for everyone.
 * - `knowsHomeRow`: the leading run of home-row keys, i.e. the stretch to G and H that the anchors
 *   do not cover.
 * - `touchTypesWantsAccuracy`: everything up to the last letter, leaving punctuation and digits to
 *   be earned, since the goal of this learner is accuracy on keys they have not drilled slowly.
 */
export function boundaryFor(layout: Layout, choice: StartingLevelChoice): number {
  if (choice === 'neverTouchTyped') return 0
  if (choice === 'knowsHomeRow') {
    let length = 0
    while (keyOfChar(layout, layout.unlockOrder[length] ?? '')?.row === 'home') length++
    return length
  }
  let last = -1
  layout.unlockOrder.forEach((char, index) => {
    if (keyOfChar(layout, char)?.kind === 'letter') last = index
  })
  return last + 1
}
