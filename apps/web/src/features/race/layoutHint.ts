import { keyOf } from '@typing-race/curriculum'
import type { InputEvent, Layout } from '@typing-race/domain'

/**
 * Letters in a row that the race's layout cannot produce before the race says so. Three, because one
 * stray letter is a slip and three is a learner on the wrong Active layout.
 */
export const FOREIGN_STREAK = 3

/** A letter keystroke: the only kind that says anything about the layout (digits and signs are shared). */
function letterOf(event: InputEvent): string | null {
  return event.kind === 'char' && /\p{L}/u.test(event.char) ? event.char.toLowerCase() : null
}

/** `true` when the keystroke is a letter this layout produces: proof the learner is on it. */
export function isOfLayout(layout: Layout, event: InputEvent): boolean {
  const letter = letterOf(event)
  return letter !== null && keyOf(layout, letter) !== undefined
}

/**
 * Consecutive letters outside the layout. A letter the layout does produce resets it; anything that
 * is not a letter (space, a digit, backspace, a modifier) leaves it alone.
 */
export function nextForeignStreak(streak: number, layout: Layout, event: InputEvent): number {
  const letter = letterOf(event)
  if (letter === null) return streak
  return keyOf(layout, letter) === undefined ? streak + 1 : 0
}
