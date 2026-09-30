import type { Generator } from '../types'
import { anchorKeys, isAvailable, sameFinger } from './shared'

/**
 * `modifiers` — the keys off the home row, each as its own sub-variant (R6):
 *
 *  - **Shift**: a capital then its lowercase, so the opposite-hand pinky holds Shift while the
 *    typing hand reaches; only once Shift is unlocked, or is the thing being learned (FR-004);
 *  - **digits**: each available digit against the home key on its finger (`1a`);
 *  - **punctuation**: each available mark against the home key on its finger (`а,`).
 *
 * The space bar is the fourth modifier in the requirements' list, but it is typed between every two
 * items of every exercise, so it needs no sub-variant of its own.
 */
export const modifiers: Generator = (context) => {
  const { layout } = context

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
