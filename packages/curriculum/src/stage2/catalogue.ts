import type { FocusElement, Layout, LayoutId, WordDrill, WordDrillKind } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { keyOf, layouts, SHIFT_TOKEN } from '../layout'
import { boundaryFor } from '../progress/starting-level'
import { ALPHABETS, APOSTROPHE } from '../words/normalise'

/** Characters a generated Stage 2 text aims for; a little longer than a scale, as words are. */
export const WORD_DRILL_SIZE = 72

/** The four letters Ukrainian has and Russian-trained fingers do not — requirements §3.2. */
export const UK_SPECIFIC_LETTERS = ['і', 'ї', 'є', 'ґ'] as const

/** The length ladder: short frequent words first, then longer ones, each gated by the last. */
export const LENGTH_BANDS = [
  { slug: 'short', min: 1, max: 4 },
  { slug: 'medium', min: 5, max: 7 },
  { slug: 'long', min: 8, max: 40 },
] as const

/**
 * The keys that open Stage 2: the home-row run at the head of the Unlock Order (the stretch the
 * anchors do not cover — `п р є` on ЙЦУКЕН, `g h` on QWERTY). With the whole home row open there
 * are a couple of hundred real words to type; before it, too few to make a drill honest.
 */
export function stage2Gate(layout: Layout): readonly string[] {
  return layout.unlockOrder.slice(0, boundaryFor(layout, 'knowsHomeRow'))
}

/** Whether the learner's unlocked set has opened Stage 2. */
export function stage2Open(layout: Layout, unlocked: readonly string[]): boolean {
  const open = new Set(unlocked)
  return stage2Gate(layout).every((char) => open.has(char))
}

function isLetter(layout: Layout, char: string): boolean {
  return char.length === 1 && ALPHABETS[layout.language].includes(char)
}

function drill(
  layout: Layout,
  slug: string,
  kind: WordDrillKind,
  options: {
    focus?: FocusElement | null
    requires?: readonly string[]
    after?: string | null
    lengths?: { min: number; max: number } | null
  } = {},
): WordDrill {
  return {
    id: `${layout.id}.words.${slug}`,
    layoutId: layout.id,
    kind,
    focus: options.focus ?? null,
    lengths: options.lengths ?? null,
    requires: [...stage2Gate(layout), ...(options.requires ?? [])],
    after: options.after ?? null,
    size: WORD_DRILL_SIZE,
  }
}

const keyFocus = (value: string): FocusElement => ({ kind: 'key', value })

/**
 * The Stage 2 catalogue of one layout, in the order the Path shows it:
 *
 * 1. first words from the home row, then the length ladder (short → medium → long);
 * 2. one drill per key opened after the home row, in Unlock Order — "new words with «к»";
 * 3. the focused sets of §3.2: repeated key, same finger across rows, hand alternation, and,
 *    once their keys are open, apostrophe, hyphen, capitals and (Ukrainian) `і ї є ґ`;
 * 4. the weak-spot drill, built from the learner's own slowest keys and transitions.
 *
 * Every drill requires the Stage 2 gate plus its own characters; `requires` is a check, the word
 * filter is the guarantee (see `select.ts`).
 */
export function buildWordCatalogue(layout: Layout): WordDrill[] {
  const gate = new Set(stage2Gate(layout))
  const out: WordDrill[] = [drill(layout, 'first', 'firstWords')]

  let previous: string | null = null
  for (const band of LENGTH_BANDS) {
    const made = drill(layout, `length.${band.slug}`, 'length', {
      lengths: { min: band.min, max: band.max },
      after: previous,
    })
    out.push(made)
    previous = made.id
  }

  const specific = new Set<string>(layout.language === 'uk' ? UK_SPECIFIC_LETTERS : [])
  for (const char of layout.unlockOrder) {
    if (!isLetter(layout, char) || gate.has(char)) continue
    const code = keyOf(layout, char)?.code ?? char
    const kind = specific.has(char) ? 'ukLetter' : 'newKey'
    out.push(drill(layout, `key.${code}`, kind, { focus: keyFocus(char), requires: [char] }))
  }

  out.push(drill(layout, 'repeat', 'repeat'))
  out.push(drill(layout, 'sameFinger', 'sameFinger'))
  out.push(drill(layout, 'alternation', 'alternation'))
  // The Ukrainian letters that are open before any new key drill could name them.
  for (const char of specific) {
    if (!gate.has(char) && !layout.homeAnchors.includes(char)) continue
    const code = keyOf(layout, char)?.code ?? char
    out.push(drill(layout, `key.${code}`, 'ukLetter', { focus: keyFocus(char) }))
  }
  out.push(
    drill(layout, 'apostrophe', 'apostrophe', {
      focus: keyFocus(APOSTROPHE),
      requires: [APOSTROPHE],
    }),
  )
  out.push(drill(layout, 'hyphen', 'hyphen', { focus: keyFocus('-'), requires: ['-'] }))
  out.push(
    drill(layout, 'capitals', 'capitals', {
      focus: keyFocus(SHIFT_TOKEN),
      requires: [SHIFT_TOKEN],
    }),
  )
  out.push(drill(layout, 'weak', 'weak'))
  return out
}

export const wordCatalogue: Record<LayoutId, WordDrill[]> = {
  yq: buildWordCatalogue(layouts.yq),
  qwerty: buildWordCatalogue(layouts.qwerty),
}

const FOCUS_PREFIX = 'words.focus.'

/**
 * The id of a drill built around one Focus Element — what a Next Action starts for a weak key or
 * transition. The id carries the element, so the same id always means the same drill.
 */
export function focusDrillId(layoutId: LayoutId, focus: FocusElement): string {
  return `${layoutId}.${FOCUS_PREFIX}${focus.value}`
}

/** Whether an exercise id names a Stage 2 drill rather than a Stage 1 scale. */
export function isWordDrillId(id: string): boolean {
  return /^(yq|qwerty)\.words\./.test(id)
}

/**
 * The drill an id names: a catalogue entry, or a focus drill rebuilt from its id. `undefined` for
 * an id that is neither, or a focus drill on characters the layout cannot type as letters.
 */
export function resolveWordDrill(id: string): WordDrill | undefined {
  const layoutId: LayoutId | undefined = id.startsWith('yq.')
    ? 'yq'
    : id.startsWith('qwerty.')
      ? 'qwerty'
      : undefined
  if (layoutId === undefined) return undefined
  const known = wordCatalogue[layoutId].find((candidate) => candidate.id === id)
  if (known !== undefined) return known

  const prefix = `${layoutId}.${FOCUS_PREFIX}`
  if (!id.startsWith(prefix)) return undefined
  const value = id.slice(prefix.length)
  const layout = layouts[layoutId]
  const pair = parseTransitionKey(value)
  const focus: FocusElement | undefined =
    pair !== undefined && isLetter(layout, pair.from) && isLetter(layout, pair.to)
      ? { kind: 'transition', value }
      : isLetter(layout, value)
        ? { kind: 'key', value }
        : undefined
  if (focus === undefined) return undefined
  const chars = pair === undefined ? [value] : [pair.from, pair.to]
  return {
    id,
    layoutId,
    kind: 'focus',
    focus,
    lengths: null,
    requires: [...stage2Gate(layout), ...chars.filter((c) => !layout.homeAnchors.includes(c))],
    after: null,
    size: WORD_DRILL_SIZE,
  }
}

/**
 * For the coach: the focus drill for a weak element, when Stage 2 is open and the element is made
 * of letters (a word has no transition into a space). `undefined` otherwise, so Stage 1 learners
 * keep the Stage 1 next action.
 */
export function focusDrillFor(
  layout: Layout,
  unlocked: readonly string[],
): (focus: FocusElement) => string | undefined {
  const open = new Set(unlocked)
  const stage2 = stage2Open(layout, unlocked)
  return (focus) => {
    if (!stage2) return undefined
    const id = focusDrillId(layout.id, focus)
    const drill = resolveWordDrill(id)
    return drill?.requires.every((char) => open.has(char)) ? id : undefined
  }
}
