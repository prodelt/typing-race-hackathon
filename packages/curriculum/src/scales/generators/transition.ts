import type { Generator } from '../types'
import { RUN_WINDOW } from './run'
import { anchorKeys, homeRowChars, isAvailable, mirrorPairs, reverse, windowsOf } from './shared'

/**
 * The drill for a Transition Focus Element — one motor move, over and over, with the hands sent
 * back to the home row between repeats.
 *
 * This is the one generator chosen by the *Focus Element* rather than by `ScaleType`: `generateText`
 * dispatches to it whenever `focus.kind === 'transition'`. A Transition is not a ninth Stage 1
 * type — the eight types are the requirements' own list — it is a different thing to focus a Scale
 * on, and `run` or `mirror` asked to carry a two-character form would drill the move once per item
 * by accident rather than on purpose.
 *
 * Three shapes, all of them house style, none of them a single bigram repeated two hundred times:
 *
 *  - the move doubled inside one anchor, so the repeat is immediate and the finger still returns;
 *  - the move once per hand across a mirror pair, so each repeat starts from the other hand's rest;
 *  - the move at the turn of a home-row sweep, `run`'s own shape, so the drill still reads as a
 *    scale and the surrounding text is the row the learner already knows.
 *
 * Every item begins and ends on a home-row character, which is what keeps a Transition that
 * involves the space bar from producing a leading, trailing or doubled space.
 */
export const transitionDrill: Generator = (context) => {
  const anchors = anchorKeys(context).filter((key) => isAvailable(context, key))
  const pairs = mirrorPairs(context)
  const windows = windowsOf(homeRowChars(context), RUN_WINDOW)

  return context.forms.flatMap((form) => [
    ...anchors.map((anchor) => `${anchor.plain}${form}${form}${anchor.plain}`),
    ...pairs.map(([left, right]) => `${left.plain}${form}${right.plain}${form}${left.plain}`),
    ...windows.map((window) => `${window}${form}${reverse(window)}`),
  ])
}
