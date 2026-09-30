import type { Language } from '@typing-race/domain'
import { bigramsOf } from './analyse'
import { foldApostrophes } from './normalise'
import type { DifficultyTier, WordBank, WordFlag, WordRecord } from './types'

/**
 * The on-disk Word Bank: `data/derived/<lang>/words.json`, written by `pnpm data`.
 *
 * Each word is one array `[word, frequency, tier, sameFingerTransitions, rowChanges, flags]`, one
 * per line, most frequent first. `characters`, `bigrams`, `length`, `rank`, `language` and `source`
 * of the §5.3 record are not stored because they are fully determined by the word, its position
 * and the file header; `parseWordBank` puts them back. The format is compact because the app
 * lazy-loads one of these per typing language.
 */
export const WORD_BANK_FORMAT = 'typing-race/words@1'

export const WORD_BANK_FIELDS = [
  'word',
  'frequency',
  'tier',
  'sameFingerTransitions',
  'rowChanges',
  'flags',
] as const

const FLAGS: readonly WordFlag[] = [
  'apostrophe',
  'apostrophe-restored',
  'hyphen',
  'double-letter',
  'uk-letter',
]

type StoredWord = [string, number, number, number, number, readonly string[]]

/** Serialises a bank deterministically: fixed key order, one word per line, trailing newline. */
export function encodeWordBank(bank: WordBank, layoutId: string): string {
  const header = {
    format: WORD_BANK_FORMAT,
    language: bank.language,
    source: bank.source,
    layout: layoutId,
    algorithmVersion: bank.algorithmVersion,
    fields: WORD_BANK_FIELDS,
  }
  const rows = bank.words.map((w) =>
    JSON.stringify([
      w.word,
      w.frequency,
      w.difficulty.tier,
      w.difficulty.sameFingerTransitions,
      w.difficulty.rowChanges,
      w.flags,
    ] satisfies StoredWord),
  )
  const head = JSON.stringify(header).slice(0, -1)
  return `${head},"words":[\n${rows.join(',\n')}\n]}\n`
}

function fail(message: string): never {
  throw new TypeError(`Malformed word bank: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0

/** Reads a parsed `words.json` back into full §5.3 records. Throws on anything malformed. */
export function parseWordBank(json: unknown): WordBank {
  if (!isRecord(json)) fail('not an object')
  if (json['format'] !== WORD_BANK_FORMAT) fail(`format is ${String(json['format'])}`)
  const language = json['language']
  if (language !== 'uk' && language !== 'en') fail('unknown language')
  const source = json['source']
  const algorithmVersion = json['algorithmVersion']
  if (typeof source !== 'string' || typeof algorithmVersion !== 'string') fail('missing header')
  const rows = json['words']
  if (!Array.isArray(rows)) fail('no words')

  const words = rows.map((row: unknown, index): WordRecord => {
    if (!Array.isArray(row) || row.length !== WORD_BANK_FIELDS.length) fail(`row ${index}`)
    const [word, frequency, tier, sameFinger, rowChanges, flags] = row as unknown[]
    if (typeof word !== 'string' || word === '') fail(`row ${index}: word`)
    if (!isCount(frequency) || !isCount(sameFinger) || !isCount(rowChanges)) {
      fail(`row ${index}: counts`)
    }
    if (tier !== 1 && tier !== 2 && tier !== 3 && tier !== 4 && tier !== 5)
      fail(`row ${index}: tier`)
    if (!Array.isArray(flags) || !flags.every((f) => FLAGS.includes(f as WordFlag))) {
      fail(`row ${index}: flags`)
    }
    const characters = [...word]
    return {
      word,
      language,
      frequency,
      rank: index + 1,
      source,
      characters,
      bigrams: bigramsOf(characters),
      difficulty: {
        length: characters.length,
        sameFingerTransitions: sameFinger,
        rowChanges,
        tier: tier as DifficultyTier,
      },
      flags: flags as WordFlag[],
    }
  })
  return { language: language as Language, source, algorithmVersion, words }
}

export interface CandidateQuery {
  /**
   * The learner's unlocked characters. Any apostrophe variant counts as the apostrophe; entries
   * longer than one character (none today) are ignored.
   */
  readonly unlocked: Iterable<string>
  /** A character or n-gram every returned word must contain — the exercise's Focus Element. */
  readonly include?: string
  readonly maxTier?: DifficultyTier
  readonly maxLength?: number
  readonly limit?: number
}

/**
 * The Stage 2 selection: words made **only** of unlocked characters (requirements §3.2, §8.3),
 * easiest tier first and most frequent first within a tier. A word containing a single locked
 * character is never returned, whatever the other options say.
 */
export function candidateWords(bank: WordBank, query: CandidateQuery): WordRecord[] {
  const unlocked = new Set<string>()
  for (const char of query.unlocked) unlocked.add(foldApostrophes(char))
  const include = query.include === undefined ? undefined : foldApostrophes(query.include)

  const matches = bank.words.filter(
    (w) =>
      w.characters.every((c) => unlocked.has(c)) &&
      (include === undefined || w.word.includes(include)) &&
      (query.maxTier === undefined || w.difficulty.tier <= query.maxTier) &&
      (query.maxLength === undefined || w.difficulty.length <= query.maxLength),
  )
  // `filter` keeps bank order (rank), and `sort` is stable, so ties stay most-frequent-first.
  matches.sort((a, b) => a.difficulty.tier - b.difficulty.tier)
  return query.limit === undefined ? matches : matches.slice(0, query.limit)
}
