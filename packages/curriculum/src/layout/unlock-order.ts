import type { Finger, Hand, Key, Row } from '@typing-race/domain'

/**
 * The Unlock Order's stand-in for Shift and capitals (R7 step 4).
 *
 * Capitals are not keys of their own, yet a learner must not be handed `Ф` before the Shift
 * coordination has been taught, so one entry gates all of them. It is a single character, as a
 * Focus Element's value must be, and no key produces it, so it can never turn up in generated text
 * by accident.
 */
export const SHIFT_TOKEN = '⇧'

const FINGER_RANK: Record<Finger, number> = {
  index: 0,
  middle: 1,
  ring: 2,
  pinky: 3,
  thumb: 4,
}
const HAND_RANK: Record<Hand, number> = { left: 0, right: 1, thumbs: 2 }
const ROW_RANK: Record<Row, number> = { home: 0, top: 1, bottom: 2, digit: 3 }

/** Punctuation is trained as its own movement, in the order the requirements list it (R7). */
const PUNCTUATION_ORDER = ['.', ',', ';', ':', '-', "'", '"']

/**
 * Derives the Unlock Order from a finger map by research R7's rule, rather than authoring it twice.
 *
 *  1. home-row letters that are not anchors, then the top row, then the bottom row — each by finger
 *     rank index, middle, ring, pinky, the left hand before the right within a rank;
 *  2. `SHIFT_TOKEN`;
 *  3. the digits, in key order (`1` … `0`);
 *  4. punctuation in the requirements' order, then any remaining extension keys (`ґ`).
 *
 * `keys` must be in physical left-to-right order: position is the last tiebreak, and it is what
 * makes QWERTY read `R T Y U` rather than `R U T Y`.
 */
export function deriveUnlockOrder(keys: readonly Key[], anchors: readonly string[]): string[] {
  const letters = keys
    .map((key, position) => ({ key, position }))
    .filter(({ key }) => key.kind === 'letter' && !anchors.includes(key.plain))
    .sort(
      (a, b) =>
        ROW_RANK[a.key.row] - ROW_RANK[b.key.row] ||
        FINGER_RANK[a.key.finger] - FINGER_RANK[b.key.finger] ||
        HAND_RANK[a.key.hand] - HAND_RANK[b.key.hand] ||
        a.position - b.position,
    )
    .map(({ key }) => key.plain)

  const digits = keys.filter((key) => key.kind === 'digit').map((key) => key.plain)

  // A shifted character is a capital when it is exactly the upper case of the plain one; anything
  // else (`:` on QWERTY's `;` key, `"` on the Ukrainian 2) is punctuation in its own right.
  const punctuation = new Set<string>()
  for (const key of keys) {
    if (key.kind === 'punctuation' && !anchors.includes(key.plain)) punctuation.add(key.plain)
    if (key.shifted !== null && key.shifted !== key.plain.toUpperCase()) {
      punctuation.add(key.shifted)
    }
  }
  const ordered = PUNCTUATION_ORDER.filter((char) => punctuation.has(char))
  const extension = [...punctuation].filter((char) => !PUNCTUATION_ORDER.includes(char))

  return [...letters, SHIFT_TOKEN, ...digits, ...ordered, ...extension]
}
