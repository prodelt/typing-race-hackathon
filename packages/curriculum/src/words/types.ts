import type { Language } from '@typing-race/domain'

export type DifficultyTier = 1 | 2 | 3 | 4 | 5

/**
 * Stage 2 trains these separately (requirements §3.2). `apostrophe-restored` marks a Ukrainian
 * word whose apostrophe the frequency source had lost (`пять` → `п'ять`) and the pipeline put back
 * after the spelling dictionary confirmed the apostrophised form.
 */
export type WordFlag =
  | 'apostrophe'
  | 'apostrophe-restored'
  | 'hyphen'
  | 'double-letter'
  | 'uk-letter'

export interface WordDifficulty {
  readonly length: number
  readonly sameFingerTransitions: number
  /** Adjacent pairs on different rows — see `analyseWord` for why this is not the example's 3. */
  readonly rowChanges: number
  readonly tier: DifficultyTier
}

/** One normalised word, in the requirements' §5.3 shape plus its frequency rank and tier. */
export interface WordRecord {
  readonly word: string
  readonly language: Language
  /** Occurrences in the source, summed over every raw spelling that normalised to this word. */
  readonly frequency: number
  /** 1 = most frequent word in the bank. */
  readonly rank: number
  readonly source: string
  readonly characters: readonly string[]
  readonly bigrams: readonly string[]
  readonly difficulty: WordDifficulty
  readonly flags: readonly WordFlag[]
}

/** The filtered, normalised words of one language, most frequent first. */
export interface WordBank {
  readonly language: Language
  readonly source: string
  readonly algorithmVersion: string
  readonly words: readonly WordRecord[]
}

export interface Ngram {
  readonly ngram: string
  /** Sum of the frequencies of the words that contain it, each word counted once (§3.3). */
  readonly weight: number
  /** How many words of the filtered bank contain it. */
  readonly words: number
}

/** Within-word bigrams and trigrams of one language, heaviest first. */
export interface NgramTable {
  readonly language: Language
  readonly source: string
  readonly algorithmVersion: string
  readonly bigrams: readonly Ngram[]
  readonly trigrams: readonly Ngram[]
}
