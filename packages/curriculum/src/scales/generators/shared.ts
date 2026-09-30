import type { Finger, Hand, Key } from '@typing-race/domain'
import type { GeneratorContext } from '../types'

/** A key the generator may type: it produces a character, and that character is available. */
export function isAvailable(context: GeneratorContext, key: Key): boolean {
  return key.plain !== '' && context.available.has(key.plain)
}

/** The home-row anchors as keys, in physical left-to-right order. */
export function anchorKeys(context: GeneratorContext): Key[] {
  const { layout } = context
  return layout.keys.filter((key) => layout.homeAnchors.includes(key.plain))
}

/**
 * The available home-row characters in physical left-to-right order: the anchors plus whichever
 * home-row letters the learner has opened. This is why a learner who has unlocked `g` gets `dfgh`
 * without a generator of their own.
 */
export function homeRowChars(context: GeneratorContext): string[] {
  const { layout } = context
  return layout.keys
    .filter(
      (key) =>
        key.row === 'home' &&
        (key.kind === 'letter' || layout.homeAnchors.includes(key.plain)) &&
        isAvailable(context, key),
    )
    .map((key) => key.plain)
}

/**
 * Every window of `size` consecutive characters, in order. Empty when the list is shorter than the
 * window, so a caller never has to check a length before sliding.
 */
export function windowsOf(chars: readonly string[], size: number): string[] {
  return Array.from({ length: Math.max(0, chars.length - (size - 1)) }, (_, start) =>
    chars.slice(start, start + size).join(''),
  )
}

/**
 * The anchor pairs that share a finger name across the hands, outermost first: the two pinkies,
 * then the two rings, the two middles and the two indexes. Keys are in physical order, so the left
 * hand reads pinky → index and the right hand, read backwards, reads pinky → index too.
 */
export function mirrorPairs(context: GeneratorContext): [Key, Key][] {
  const anchors = anchorKeys(context)
  const left = anchors.filter((key) => key.hand === 'left')
  const right = anchors.filter((key) => key.hand === 'right')
  return pairUp(left, right.toReversed()).filter(
    ([l, r]) => isAvailable(context, l) && isAvailable(context, r),
  )
}

/**
 * The anchor pairs that never share a finger: the left hand outward-in against the right hand
 * inward-out, so the left pinky meets the right index and the left index meets the right pinky.
 */
export function crossPairs(context: GeneratorContext): [Key, Key][] {
  const anchors = anchorKeys(context)
  const left = anchors.filter((key) => key.hand === 'left')
  const right = anchors.filter((key) => key.hand === 'right')
  return pairUp(left, right).filter(([l, r]) => isAvailable(context, l) && isAvailable(context, r))
}

/** Zips two lists to the shorter length. Exists so callers never index past an end. */
export function pairUp<A, B>(first: readonly A[], second: readonly B[]): [A, B][] {
  return first.flatMap((a, index): [A, B][] => {
    const b = second[index]
    return b === undefined ? [] : [[a, b]]
  })
}

export function reverse(text: string): string {
  return [...text].toReversed().join('')
}

export function sameFinger(a: { hand: Hand; finger: Finger }, b: { hand: Hand; finger: Finger }) {
  return a.hand === b.hand && a.finger === b.finger
}
