import type { Layout, Progress, Random, TransitionKey, WordDrill } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { WEAK_CONFIDENCE_CEILING } from '../coach/next-action'
import { keyOf, SHIFT_TOKEN, transitionOf } from '../layout'
import { REQUIREMENTS_UNMET } from '../scales/types'
import { candidateWords } from '../words/bank'
import { ALPHABETS, foldApostrophes } from '../words/normalise'
import type { WordBank } from '../words/types'
import { AUTHORED_WORDS } from './authored'
import { stage2Open } from './catalogue'

/** Fewer distinct words than this and a drill is not offered: it would be one word on repeat. */
export const MIN_POOL = 4
/** The easiest words a drill draws from — short and frequent first, as §3.2 asks. */
export const POOL_LIMIT = 40
/** How many weak keys and weak transitions adaptation leans toward. */
export const WEAK_LIMIT = 3
/** A word containing a weak element is this many times likelier to be drawn, per element. */
export const WEAK_BOOST = 2
/** How many words holding a weak element may join a pool beyond its easiest `POOL_LIMIT`. */
export const WEAK_EXTRA = 12

/** The learner's weakest measured letters and letter transitions, weakest first. */
export interface WeakElements {
  readonly keys: readonly string[]
  readonly transitions: readonly TransitionKey[]
}

export const NO_WEAK: WeakElements = { keys: [], transitions: [] }

/**
 * Whether one character of a generated text is typable with the unlocked set: the character is
 * open itself, or it is the Shift form of an open key and Shift is open. This is the whole of
 * §8.3's rule, and the property test checks every generated character against it.
 */
export function isTypable(layout: Layout, unlocked: ReadonlySet<string>, char: string): boolean {
  const folded = foldApostrophes(char)
  if (unlocked.has(folded)) return true
  const key = keyOf(layout, folded)
  return (
    key !== undefined &&
    key.shifted === folded &&
    unlocked.has(SHIFT_TOKEN) &&
    unlocked.has(key.plain)
  )
}

function isLetter(layout: Layout, char: string): boolean {
  return ALPHABETS[layout.language].includes(char)
}

/**
 * Weakest keys and transitions from the learner's confidence, letters only — a word never
 * contains a space, so a transition into one cannot steer word choice.
 */
export function weakElements(progress: Progress, layout: Layout): WeakElements {
  const keys = Object.entries(progress.keyConfidence)
    .filter(
      (entry): entry is [string, number] =>
        entry[1] !== undefined && entry[1] < WEAK_CONFIDENCE_CEILING && isLetter(layout, entry[0]),
    )
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, WEAK_LIMIT)
    .map(([key]) => key)
  const transitions = Object.entries(progress.transitionConfidence)
    .filter((entry): entry is [string, number] => {
      const pair = parseTransitionKey(entry[0])
      return (
        entry[1] !== undefined &&
        entry[1] < WEAK_CONFIDENCE_CEILING &&
        pair !== undefined &&
        isLetter(layout, pair.from) &&
        isLetter(layout, pair.to)
      )
    })
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, WEAK_LIMIT)
    .map(([key]) => key)
  return { keys, transitions }
}

function bigram(key: TransitionKey): string {
  const pair = parseTransitionKey(key)
  return pair === undefined ? key : `${pair.from}${pair.to}`
}

/** How many of the weak elements a word contains. */
function weakHits(word: string, weak: WeakElements): number {
  let hits = 0
  for (const key of weak.keys) if (word.includes(key)) hits += 1
  for (const transition of weak.transitions) if (word.includes(bigram(transition))) hits += 1
  return hits
}

/** A same-finger move between rows, the motor pattern ЙЦУКЕН is full of (§3.2). */
function hasSameFingerRowMove(layout: Layout, chars: readonly string[]): boolean {
  for (let i = 0; i + 1 < chars.length; i++) {
    const a = chars[i] as string
    const b = chars[i + 1] as string
    if (a === b || !isLetter(layout, a) || !isLetter(layout, b)) continue
    const t = transitionOf(layout, a, b)
    if (t.sameFinger && t.rowChange) return true
  }
  return false
}

/** Three or more letters, at least three in four of whose moves change hands. */
function alternatesHands(layout: Layout, chars: readonly string[]): boolean {
  if (chars.length < 3) return false
  let alternating = 0
  for (let i = 0; i + 1 < chars.length; i++) {
    const a = keyOf(layout, chars[i] as string)
    const b = keyOf(layout, chars[i + 1] as string)
    if (a !== undefined && b !== undefined && a.hand !== b.hand) alternating += 1
  }
  return alternating / (chars.length - 1) >= 0.75
}

function hasDoubleLetter(chars: readonly string[]): boolean {
  return chars.some((c, i) => c === chars[i + 1])
}

function capitalise(word: string): string {
  const [first = '', ...rest] = [...word]
  return first.toUpperCase() + rest.join('')
}

export interface PoolArgs {
  readonly drill: WordDrill
  readonly bank: WordBank
  readonly layout: Layout
  readonly unlocked: readonly string[]
  readonly weak?: WeakElements
}

/**
 * Every bank and authored word typable with an unlocked set, easiest first. Memoised per bank and
 * set: the Path asks for some forty drills' pools at once, and each would otherwise walk the whole
 * 20 000-word bank. Same inputs, same list, so the cache changes no result.
 */
const openWordCache = new WeakMap<WordBank, Map<string, readonly string[]>>()

function openWords(bank: WordBank, layout: Layout, open: ReadonlySet<string>): readonly string[] {
  const cacheKey = [...open].sort().join('')
  let byUnlocked = openWordCache.get(bank)
  if (byUnlocked === undefined) {
    byUnlocked = new Map()
    openWordCache.set(bank, byUnlocked)
  }
  const cached = byUnlocked.get(cacheKey)
  if (cached !== undefined) return cached

  const bankWords = candidateWords(bank, { unlocked: open }).map((record) => record.word)
  const seen = new Set(bankWords)
  const authored = AUTHORED_WORDS[layout.language].filter(
    (word) => !seen.has(word) && [...word].every((char) => open.has(char)),
  )
  const all = [...bankWords, ...authored]
  byUnlocked.set(cacheKey, all)
  return all
}

/**
 * The words a drill may draw from, easiest first (difficulty tier, then frequency), at most
 * `POOL_LIMIT`. Every word is made only of typable characters for this unlocked set; bank words
 * come through `candidateWords`, authored words through the same character check.
 *
 * Returns an empty pool when the drill is closed: its requirements are not unlocked, or Stage 2
 * has not opened yet.
 */
export function drillPool(args: PoolArgs): string[] {
  const { drill, bank, layout, unlocked } = args
  const weak = args.weak ?? NO_WEAK
  const open = new Set(unlocked.map(foldApostrophes))
  if (!stage2Open(layout, unlocked)) return []
  if (!drill.requires.every((char) => open.has(foldApostrophes(char)))) return []

  const all = openWords(bank, layout, open)

  const focus = drill.focus
  let pool: readonly string[]
  switch (drill.kind) {
    case 'firstWords':
      pool = all
      break
    case 'length': {
      const { min, max } = drill.lengths ?? { min: 1, max: 40 }
      pool = all.filter((word) => {
        const length = [...word].length
        return length >= min && length <= max
      })
      break
    }
    case 'repeat':
      pool = all.filter((word) => hasDoubleLetter([...word]))
      break
    case 'sameFinger':
      pool = all.filter((word) => hasSameFingerRowMove(layout, [...word]))
      break
    case 'alternation':
      pool = all.filter((word) => alternatesHands(layout, [...word]))
      break
    case 'capitals':
      // A capital is the Shift form of an open letter, so the words themselves need nothing more.
      pool = all
        .filter((word) => [...word].length >= 2 && isLetter(layout, [...word][0] as string))
        .map(capitalise)
      break
    case 'weak':
      pool = all.filter((word) => weakHits(word, weak) > 0)
      break
    case 'focus': {
      if (focus === null) return []
      if (focus.kind === 'key') {
        pool = all.filter((word) => word.includes(focus.value))
        break
      }
      const pair = parseTransitionKey(focus.value)
      if (pair === undefined) return []
      pool = all.filter((word) => word.includes(`${pair.from}${pair.to}`))
      // A transition no open word contains is still trained by words holding both of its keys.
      if (pool.length < MIN_POOL) {
        pool = all.filter((word) => word.includes(pair.from) && word.includes(pair.to))
      }
      if (pool.length < MIN_POOL) {
        pool = all.filter((word) => word.includes(pair.from) || word.includes(pair.to))
      }
      break
    }
    default:
      // newKey, ukLetter, apostrophe, hyphen: every word contains the focus character.
      pool = focus === null ? all : all.filter((word) => word.includes(focus.value))
  }
  const easiest = pool.slice(0, POOL_LIMIT)
  if (weak.keys.length === 0 && weak.transitions.length === 0) return easiest
  // Adaptation reaches past the easiest words: the easiest words holding a weak element join the
  // pool even when they rank lower, or a weak key that only longer words contain is never drilled.
  const taken = new Set(easiest)
  const extra = pool.filter((word) => !taken.has(word) && weakHits(word, weak) > 0)
  return [...easiest, ...extra.slice(0, WEAK_EXTRA)]
}

export interface WordTextArgs extends PoolArgs {
  readonly random: Random
}

/**
 * The text of one Stage 2 attempt: pool words separated by single spaces, at least `drill.size`
 * characters. Words are drawn without replacement until the pool is spent, weighted toward the
 * learner's weak keys and transitions, and never the same word twice in a row.
 *
 * Returns `REQUIREMENTS_UNMET` rather than a degraded text when the pool is too small.
 */
export function generateWordText(args: WordTextArgs): string {
  const pool = drillPool(args)
  if (new Set(pool).size < MIN_POOL) return REQUIREMENTS_UNMET
  const weak = args.weak ?? NO_WEAK
  const weightOf = (word: string) => 1 + WEAK_BOOST * weakHits(word, weak)

  const words: string[] = []
  let length = 0
  let bag: string[] = []
  while (length < args.drill.size) {
    if (bag.length === 0) bag = [...pool]
    const last = words.at(-1)
    const choices = bag.filter((word) => word !== last)
    const usable = choices.length > 0 ? choices : bag
    const total = usable.reduce((sum, word) => sum + weightOf(word), 0)
    // Integer weights, so `nextInt` picks exactly and the draw is reproducible from the seed.
    let ticket = args.random.nextInt(total)
    let picked = usable[usable.length - 1] as string
    for (const word of usable) {
      ticket -= weightOf(word)
      if (ticket < 0) {
        picked = word
        break
      }
    }
    bag.splice(bag.indexOf(picked), 1)
    words.push(picked)
    length += [...picked].length + (words.length > 1 ? 1 : 0)
  }
  return words.join(' ')
}
