import type { Language } from '@typing-race/domain'
import { bigramsOf, trigramsOf } from './analyse'
import { foldApostrophes } from './normalise'
import type { Ngram, NgramTable } from './types'

/** The on-disk n-gram table: `data/derived/<lang>/ngrams.json`, written by `pnpm data`. */
export const NGRAM_TABLE_FORMAT = 'typing-race/ngrams@1'

export const NGRAM_FIELDS = ['ngram', 'weight', 'words'] as const

/** Heaviest first; ties by code unit, never by locale (`uk` and `en` collations disagree on `і`/`ї`). */
function byWeight(a: Ngram, b: Ngram): number {
  if (a.weight !== b.weight) return b.weight - a.weight
  return a.ngram < b.ngram ? -1 : a.ngram > b.ngram ? 1 : 0
}

function tally(
  words: readonly { readonly word: string; readonly frequency: number }[],
  split: (chars: readonly string[]) => string[],
): Ngram[] {
  const weights = new Map<string, { weight: number; words: number }>()
  for (const { word, frequency } of words) {
    // Once per word, not once per occurrence: the requirements' "sum of the frequencies of the
    // words in which it occurs" read literally. Measured, the two readings differ by 0.4%.
    for (const ngram of new Set(split([...word]))) {
      const entry = weights.get(ngram)
      if (entry === undefined) weights.set(ngram, { weight: frequency, words: 1 })
      else {
        entry.weight += frequency
        entry.words += 1
      }
    }
  }
  return [...weights]
    .map(([ngram, e]) => ({ ngram, weight: e.weight, words: e.words }))
    .sort(byWeight)
}

/**
 * Within-word bigrams and trigrams weighted by summed word frequency (requirements §3.3). Integer
 * arithmetic only, so the result does not depend on the order of `words`.
 */
export function countNgrams(
  words: readonly { readonly word: string; readonly frequency: number }[],
): {
  bigrams: Ngram[]
  trigrams: Ngram[]
} {
  return { bigrams: tally(words, bigramsOf), trigrams: tally(words, trigramsOf) }
}

/** Serialises a table deterministically, one n-gram per line. */
export function encodeNgramTable(table: NgramTable): string {
  const header = {
    format: NGRAM_TABLE_FORMAT,
    language: table.language,
    source: table.source,
    algorithmVersion: table.algorithmVersion,
    fields: NGRAM_FIELDS,
  }
  const rows = (list: readonly Ngram[]) =>
    list.map((n) => JSON.stringify([n.ngram, n.weight, n.words])).join(',\n')
  const head = JSON.stringify(header).slice(0, -1)
  return `${head},"bigrams":[\n${rows(table.bigrams)}\n],"trigrams":[\n${rows(table.trigrams)}\n]}\n`
}

function fail(message: string): never {
  throw new TypeError(`Malformed n-gram table: ${message}`)
}

function parseList(value: unknown, size: number, name: string): Ngram[] {
  if (!Array.isArray(value)) fail(`${name} missing`)
  return value.map((row: unknown, index) => {
    if (!Array.isArray(row) || row.length !== NGRAM_FIELDS.length) fail(`${name} row ${index}`)
    const [ngram, weight, words] = row as unknown[]
    if (typeof ngram !== 'string' || [...ngram].length !== size) fail(`${name} row ${index}: ngram`)
    if (!Number.isSafeInteger(weight) || !Number.isSafeInteger(words)) fail(`${name} row ${index}`)
    return { ngram, weight: weight as number, words: words as number }
  })
}

/** Reads a parsed `ngrams.json`. Throws on anything malformed. */
export function parseNgramTable(json: unknown): NgramTable {
  if (typeof json !== 'object' || json === null) fail('not an object')
  const o = json as Record<string, unknown>
  if (o['format'] !== NGRAM_TABLE_FORMAT) fail(`format is ${String(o['format'])}`)
  const language = o['language']
  if (language !== 'uk' && language !== 'en') fail('unknown language')
  const source = o['source']
  const algorithmVersion = o['algorithmVersion']
  if (typeof source !== 'string' || typeof algorithmVersion !== 'string') fail('missing header')
  return {
    language: language as Language,
    source,
    algorithmVersion,
    bigrams: parseList(o['bigrams'], 2, 'bigrams'),
    trigrams: parseList(o['trigrams'], 3, 'trigrams'),
  }
}

export interface NgramQuery {
  readonly size: 2 | 3
  /** When given, only n-grams made entirely of these characters. */
  readonly unlocked?: Iterable<string>
  /** Leave out n-grams containing a hyphen or apostrophe — pure letter combinations only. */
  readonly lettersOnly?: boolean
  readonly limit?: number
}

/** The heaviest bigrams or trigrams for an Academy exercise, optionally limited to unlocked keys. */
export function topNgrams(table: NgramTable, query: NgramQuery): Ngram[] {
  const list = query.size === 2 ? table.bigrams : table.trigrams
  const unlocked =
    query.unlocked === undefined ? undefined : new Set([...query.unlocked].map(foldApostrophes))
  const picked = list.filter(
    (n) =>
      (unlocked === undefined || [...n.ngram].every((c) => unlocked.has(c))) &&
      (query.lettersOnly !== true || !/['-]/.test(n.ngram)),
  )
  return query.limit === undefined ? picked : picked.slice(0, query.limit)
}
