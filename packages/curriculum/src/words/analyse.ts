import type { Layout } from '@typing-race/domain'
import { transitionOf } from '../layout/query'
import { ALPHABETS, APOSTROPHE } from './normalise'
import type { DifficultyTier, WordDifficulty, WordFlag } from './types'

/** What the layout says about one word: its characters, bigrams and motor difficulty. */
export interface WordAnalysis {
  readonly characters: readonly string[]
  readonly bigrams: readonly string[]
  readonly difficulty: Omit<WordDifficulty, 'tier'>
  readonly flags: readonly WordFlag[]
}

/** Adjacent character pairs, in order, repeats kept — `навчання` gives `на ав вч ча ан нн ня`. */
export function bigramsOf(characters: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i + 1 < characters.length; i++) out.push(`${characters[i]}${characters[i + 1]}`)
  return out
}

/** Adjacent character triples, in order, repeats kept. */
export function trigramsOf(characters: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i + 2 < characters.length; i++) {
    out.push(`${characters[i]}${characters[i + 1]}${characters[i + 2]}`)
  }
  return out
}

const UKRAINIAN_SPECIFIC = new Set(['і', 'ї', 'є', 'ґ'])

/**
 * Analyses a normalised word on a layout.
 *
 * - `sameFingerTransitions`: adjacent pairs typed by the same finger, a repeated key included —
 *   `навчання` gives 1 (`нн`), as in the requirements' example.
 * - `rowChanges`: adjacent pairs whose keys sit on different rows. For `навчання` that is 5; the
 *   requirements' example says 3, which is the number of distinct rows touched. The Formulas page
 *   states which one we compute.
 *
 * Throws when the layout has no key for a character: the pipeline only analyses words that passed
 * `normaliseToken`, whose alphabet is the layout's.
 */
export function analyseWord(word: string, layout: Layout): WordAnalysis {
  const characters = [...word]
  let sameFingerTransitions = 0
  let rowChanges = 0
  for (let i = 0; i + 1 < characters.length; i++) {
    const t = transitionOf(layout, characters[i] as string, characters[i + 1] as string)
    if (t.sameFinger) sameFingerTransitions++
    if (t.rowChange) rowChanges++
  }
  return {
    characters,
    bigrams: bigramsOf(characters),
    difficulty: { length: characters.length, sameFingerTransitions, rowChanges },
    flags: flagsOf(characters, layout),
  }
}

/** The things Stage 2 trains separately (requirements §3.2), read off the characters. */
function flagsOf(characters: readonly string[], layout: Layout): WordFlag[] {
  const flags: WordFlag[] = []
  if (characters.includes(APOSTROPHE)) flags.push('apostrophe')
  if (characters.includes('-')) flags.push('hyphen')
  if (
    characters.some((c, i) => c === characters[i + 1] && ALPHABETS[layout.language].includes(c))
  ) {
    flags.push('double-letter')
  }
  if (layout.language === 'uk' && characters.some((c) => UKRAINIAN_SPECIFIC.has(c))) {
    flags.push('uk-letter')
  }
  return flags
}

const RANK_BANDS = [500, 2000, 5000, 10000] as const
const LENGTH_BANDS = [3, 5, 7, 9] as const

function band(value: number, limits: readonly number[]): number {
  const index = limits.findIndex((limit) => value <= limit)
  return index === -1 ? limits.length + 1 : index + 1
}

/**
 * The 1–5 Difficulty Tier of a word from its frequency rank (1 = most frequent) and length: the
 * rounded-up mean of a rank band (≤500, ≤2000, ≤5000, ≤10000, beyond) and a length band (≤3, ≤5,
 * ≤7, ≤9, longer). Short frequent words come first, as the requirements ask; same-finger and
 * row-change counts only order words within a tier.
 */
export function difficultyTier(rank: number, length: number): DifficultyTier {
  return Math.ceil((band(rank, RANK_BANDS) + band(length, LENGTH_BANDS)) / 2) as DifficultyTier
}
