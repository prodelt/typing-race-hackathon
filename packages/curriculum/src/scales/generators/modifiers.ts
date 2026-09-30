import type { Generator, GeneratorContext } from '../types'
import { anchorKeys, crossPairs, isAvailable, mirrorPairs, sameFinger } from './shared'

/** The space bar's character, which is also the Focus Element of the space-bar scale. */
export const SPACE = ' '

/**
 * The space bar as a movement of its own: two home keys of *opposite* hands with the space bar
 * between them, so every item is letter-thumb-letter and the thumb strikes while both hands stay on
 * the home row. Both directions of every mirror and cross pair, so the strike comes after the left
 * hand as often as after the right. Items begin and end on a letter, so `generateText`'s own joining
 * space makes the whole text an unbroken letter-space-letter rhythm with no doubled space.
 */
function spaceItems(context: GeneratorContext): string[] {
  const pairs = [...mirrorPairs(context), ...crossPairs(context)]
  return pairs.flatMap(([left, right]) => [
    `${left.plain}${SPACE}${right.plain}`,
    `${right.plain}${SPACE}${left.plain}`,
  ])
}

/**
 * `modifiers` — the keys off the home row, each as its own sub-variant (R6):
 *
 *  - **Shift**: a capital then its lowercase, so the opposite-hand pinky holds Shift while the
 *    typing hand reaches; only once Shift is unlocked, or is the thing being learned (FR-004);
 *  - **digits**: each available digit against the home key on its finger (`1a`);
 *  - **punctuation**: each available mark against the home key on its finger (`а,`).
 *
 *  - **space**: when the Focus Element is the space bar itself, a letter of each hand either side
 *    of it (`ф ж`), so the thumb strike is the move being drilled rather than a gap between items.
 */
export const modifiers: Generator = (context) => {
  const { layout } = context
  if (context.forms.includes(SPACE)) return spaceItems(context)

  const capitals = context.shiftOn
    ? layout.keys.flatMap((key) =>
        key.kind === 'letter' && key.shifted !== null && isAvailable(context, key)
          ? [`${key.shifted}${key.plain}`]
          : [],
      )
    : []

  // Walked in key order, not in the order the unlocked set happens to list itself, so the same set
  // always gives the same pool.
  const reaches = layout.keys.flatMap((key) => {
    if (key.kind !== 'digit' && key.kind !== 'punctuation') return []
    return [key.plain, key.shifted].flatMap((char) => {
      if (char === null || !context.available.has(char)) return []
      // Against the anchor on the same finger; an anchor is its own home key, so it is not paired
      // with itself (QWERTY's `;`).
      return anchorKeys(context)
        .filter((anchor) => sameFinger(anchor, key) && anchor.plain !== char)
        .map((anchor) => `${anchor.plain}${char}`)
    })
  })

  const cores = [...capitals, ...reaches]
  return context.forms.flatMap((form) => cores.map((core) => `${core}${form}`))
}
