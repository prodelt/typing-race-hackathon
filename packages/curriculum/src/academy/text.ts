import type { Layout } from '@typing-race/domain'
import { keyOf } from '../layout/query'
import { RUSSIAN_ONLY_LETTERS } from '../words/normalise'

/**
 * How any text becomes Academy exercise text. The same rules as the dictionary pipeline (NFC,
 * every apostrophe variant folded to U+0027, `і ї є ґ` never touched) plus the one rule a typing
 * line adds: **every character must be typable on the course's layout**, because the engine and
 * the transition analysis have no finger for anything else.
 */

/** Apostrophe variants, as in `words/normalise.ts`, plus the prime some sources use. */
const APOSTROPHES = /[’ʼ`‘´′]/g

/**
 * Characters with a typable stand-in on both layouts. Dashes become the hyphen, typographic quotes
 * the straight double quote, the ellipsis three full stops. Applied to every text.
 */
const STAND_INS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[—–‒−]/g, '-'],
  [/[«»“”„‟″]/g, '"'],
  [/…/g, '...'],
  [/[   \t\r\n]+/g, ' '],
]

/** The same mapping, applied to the characters neither ЙЦУКЕН nor QWERTY here can type. */
const PROSE_STAND_INS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[!?]/g, '.'],
  [/[()[\]{}]/g, ''],
]

export function foldText(raw: string, prose: boolean): string {
  let text = raw.normalize('NFC').replace(APOSTROPHES, "'").replace(/́/g, '')
  for (const [pattern, replacement] of STAND_INS) text = text.replace(pattern, replacement)
  if (prose) {
    for (const [pattern, replacement] of PROSE_STAND_INS) text = text.replace(pattern, replacement)
    // `Жити! Треба` → `Жити. Треба`; collapse the `..` a `?.` or `!.` can leave behind.
    text = text.replace(/\.{2}(?!\.)/g, '.').replace(/ +([.,;:])/g, '$1')
  }
  return text.replace(/ {2,}/g, ' ').trim()
}

export function isTypable(layout: Layout, char: string): boolean {
  return keyOf(layout, char) !== undefined
}

/** The characters of `text` the layout cannot type, deduplicated, in order of appearance. */
export function untypable(layout: Layout, text: string): string[] {
  const seen = new Set<string>()
  for (const char of text) if (!isTypable(layout, char)) seen.add(char)
  return [...seen]
}

/** A Ukrainian text with `ы э ъ ё` is not Ukrainian. */
export function hasRussianOnlyLetter(text: string): boolean {
  for (const char of text.toLowerCase()) if (RUSSIAN_ONLY_LETTERS.includes(char)) return true
  return false
}

/** Drill text: keeps the tokens the layout can type and that carry a letter or digit. */
export function keepTypableTokens(layout: Layout, text: string): string {
  return text
    .split(' ')
    .filter((token) => /[\p{L}\p{Nd}]/u.test(token) && untypable(layout, token).length === 0)
    .join(' ')
}
