import type { Finger, Hand, Key, Layout, Transition } from '@typing-race/domain'

/** The apostrophe is stored as U+0027 and displayed as U+2019; the two fold together on input. */
const TYPOGRAPHIC_APOSTROPHE = '’'

const indexes = new WeakMap<Layout, ReadonlyMap<string, Key>>()

/** Character to key, built once per layout. Plain and shifted characters index the same key. */
function indexOf(layout: Layout): ReadonlyMap<string, Key> {
  const cached = indexes.get(layout)
  if (cached !== undefined) return cached
  const built = new Map<string, Key>()
  for (const key of layout.keys) {
    if (key.plain !== '') built.set(key.plain, key)
    if (key.shifted !== null) built.set(key.shifted, key)
  }
  indexes.set(layout, built)
  return built
}

function fold(char: string): string {
  return char === TYPOGRAPHIC_APOSTROPHE ? "'" : char
}

/** The physical key that produces `char`, or `undefined` when the layout does not support it. */
export function keyOf(layout: Layout, char: string): Key | undefined {
  return indexOf(layout).get(fold(char))
}

/** The one finger that types `char` — FR-002, SC-004. Space is on the thumbs. */
export function fingerOf(layout: Layout, char: string): { hand: Hand; finger: Finger } | undefined {
  const key = keyOf(layout, char)
  return key === undefined ? undefined : { hand: key.hand, finger: key.finger }
}

/**
 * The finger that holds Shift for `char`: the pinky of the opposite hand, so the hand that types the
 * character keeps its own pinky free (FR-004). `undefined` when `char` needs no Shift.
 */
export function shiftFingerOf(
  layout: Layout,
  char: string,
): { hand: Hand; finger: Finger } | undefined {
  const folded = fold(char)
  const key = keyOf(layout, folded)
  if (key === undefined || key.shifted !== folded) return undefined
  return { hand: key.hand === 'left' ? 'right' : 'left', finger: 'pinky' }
}

/**
 * The motor move from `from` to `to`. Throws for an unsupported character: a Transition with no
 * finger would be a guess, and every character that reaches here came from a supported layout.
 */
export function transitionOf(layout: Layout, from: string, to: string): Transition {
  const fromKey = keyOf(layout, from)
  const toKey = keyOf(layout, to)
  if (fromKey === undefined || toKey === undefined) {
    throw new RangeError(`No key for ${fromKey === undefined ? from : to} on layout ${layout.id}`)
  }
  const fromFinger = { hand: fromKey.hand, finger: fromKey.finger }
  const toFinger = { hand: toKey.hand, finger: toKey.finger }
  return {
    from,
    to,
    fromFinger,
    toFinger,
    rowChange: fromKey.row !== toKey.row,
    sameFinger: fromFinger.hand === toFinger.hand && fromFinger.finger === toFinger.finger,
  }
}

/** The eight anchors plus the space bar — present from the first exercise (FR-084). */
export function initialUnlockedSet(layout: Layout): string[] {
  return [...layout.homeAnchors, ' ']
}

/**
 * The next key in the Unlock Order the learner does not have yet. Walking the order like this is
 * what keeps every unlocked set a prefix of it (FR-042).
 */
export function nextLockedKey(layout: Layout, unlocked: readonly string[]): string | undefined {
  return layout.unlockOrder.find((char) => !unlocked.includes(char))
}
