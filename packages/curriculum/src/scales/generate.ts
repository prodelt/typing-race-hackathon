import type { FocusElement, Layout, Random, Scale } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { SHIFT_TOKEN } from '../layout'
import { generators, transitionDrill } from './generators'
import type { GeneratorContext } from './types'
import { REQUIREMENTS_UNMET } from './types'

/** The characters a Focus Element is made of: one for a key, two for a transition. */
function focusChars(focus: FocusElement): string[] | undefined {
  if (focus.kind === 'key') return [focus.value]
  const parsed = parseTransitionKey(focus.value)
  return parsed === undefined ? undefined : [parsed.from, parsed.to]
}

/**
 * How the Focus Element can show up in an item. Shift is the one Focus Element that is not a
 * character: what the learner must type for it is a capital, so any capital of an available letter
 * satisfies FR-046.
 */
function focusForms(layout: Layout, chars: string[], available: ReadonlySet<string>): string[] {
  if (chars[0] !== SHIFT_TOKEN) return [chars.join('')]
  return layout.keys.flatMap((key) =>
    key.kind === 'letter' && key.shifted !== null && available.has(key.plain) ? [key.shifted] : [],
  )
}

function pick<T>(pool: readonly T[], random: Random): T | undefined {
  return pool[random.nextInt(pool.length)]
}

/**
 * Turns a Scale into text: `(generator, unlocked set, seed, size) → text`, nothing else (R6).
 *
 * The text holds only characters of the unlocked set plus the Focus Element (FR-012), the Focus
 * Element is in every item (FR-046), and the same inputs give the same text. It never comes from a
 * dictionary (FR-013).
 *
 * Returns `'requirements-unmet'` — never a lesser text — when the Scale's `requires` are not all
 * unlocked or when the generator has nothing it may type. Such a Scale is not offered. A Random
 * that breaks its `[0, max)` contract is treated the same way rather than emitting `undefined`.
 */
export function generateText(args: {
  scale: Scale
  layout: Layout
  unlocked: readonly string[]
  random: Random
}): string | typeof REQUIREMENTS_UNMET {
  const { scale, layout, unlocked, random } = args
  if (scale.layoutId !== layout.id) return REQUIREMENTS_UNMET
  if (!scale.requires.every((char) => unlocked.includes(char))) return REQUIREMENTS_UNMET

  const chars = focusChars(scale.focus)
  if (chars === undefined) return REQUIREMENTS_UNMET

  const available = new Set([...unlocked, ...chars])
  const context: GeneratorContext = {
    layout,
    available,
    forms: focusForms(layout, chars, available),
    shiftOn: available.has(SHIFT_TOKEN),
  }
  // A Transition Focus Element selects its own generator, because it is not one of the eight
  // Stage 1 types: the Scale's `type` stays the one the move's geometry already answers to (it is
  // what names the goal the learner reads), and `transitionDrill` is what builds the pool.
  const generator = scale.focus.kind === 'transition' ? transitionDrill : generators[scale.type]
  const pool = generator(context)

  const first = pick(pool, random)
  if (first === undefined) return REQUIREMENTS_UNMET

  // A tempo run is one motif throughout; every other type draws afresh for each item.
  const next = scale.type === 'tempo' ? () => first : () => pick(pool, random)
  const items = [first]
  let length = first.length
  for (;;) {
    const item = next()
    if (item === undefined || length + 1 + item.length > scale.size) break
    items.push(item)
    length += 1 + item.length
  }
  return items.join(' ')
}
