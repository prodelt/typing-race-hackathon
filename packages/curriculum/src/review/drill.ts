import type { Layout, Random, Scale } from '@typing-race/domain'
import { parseTransitionKey, transitionKey } from '@typing-race/domain'
import { keyOf, SHIFT_TOKEN } from '../layout'
import { catalogue } from '../scales/catalogue'
import { generateText } from '../scales/generate'
import { charOfSlug, slugOf, transitionScale } from '../scales/transitions'
import { REQUIREMENTS_UNMET } from '../scales/types'
import { stage2Open } from '../stage2/catalogue'
import { isTypable } from '../stage2/select'
import { candidateWords } from '../words/bank'
import { ALPHABETS } from '../words/normalise'
import type { WordBank } from '../words/types'

/**
 * The weak-spot drill: one exercise that mixes several weak keys and Transitions.
 *
 * Before Stage 2 opens it is made of Stage 1 moves — each spot's own drill text, cut into its
 * items and dealt round-robin. Once Stage 2 is open, a spot made of letters is trained in real
 * words that contain it (`candidateWords` with `include`), and only a spot no word can hold falls
 * back to moves. Either way every character comes from a generator or a filter that already
 * refuses locked characters, and the property test checks the result anyway.
 *
 * The drill's id names its spots, so the text can be rebuilt from the id and a seed, and a result
 * can say what the drill was for without storing anything beyond the Attempt.
 */

/** Every weak-spot drill id holds this segment: `yq.review.KeyJ-KeyK_KeyA`. */
const REVIEW_SEGMENT = 'review'
/** How many spots one drill mixes. More than this and none of them gets enough repetitions. */
export const REVIEW_DRILL_SPOTS = 4
/** Characters in one drill: about a minute at a learner's early pace. */
export const REVIEW_DRILL_SIZE = 140
/** The easiest words per spot a drill draws from. */
const WORDS_PER_SPOT = 12

export function isReviewDrillId(id: string): boolean {
  return id.split('.')[1] === REVIEW_SEGMENT
}

function slugOfChar(layout: Layout, char: string): string | undefined {
  const key = keyOf(layout, char)
  if (key === undefined) return undefined
  if (key.plain !== char && key.shifted !== char) return undefined
  return slugOf(key, char)
}

/** The id of a drill on these spots (characters or Transition keys), or `undefined` if none encode. */
export function reviewDrillId(layout: Layout, elements: readonly string[]): string | undefined {
  const parts: string[] = []
  for (const element of elements.slice(0, REVIEW_DRILL_SPOTS)) {
    const pair = parseTransitionKey(element)
    const chars = pair === undefined ? [element] : [pair.from, pair.to]
    const slugs = chars.map((char) => slugOfChar(layout, char))
    if (slugs.some((slug) => slug === undefined)) continue
    parts.push(slugs.join('-'))
  }
  return parts.length === 0 ? undefined : `${layout.id}.${REVIEW_SEGMENT}.${parts.join('_')}`
}

/** The spots a drill id names, in order, or `undefined` for an id that is not a drill's. */
export function parseReviewDrillId(layout: Layout, id: string): string[] | undefined {
  const prefix = `${layout.id}.${REVIEW_SEGMENT}.`
  if (!id.startsWith(prefix)) return undefined
  const elements: string[] = []
  for (const part of id.slice(prefix.length).split('_')) {
    const chars = part.split('-').map((slug) => charOfSlug(layout, slug))
    if (chars.length < 1 || chars.length > 2 || chars.some((c) => c === undefined)) {
      return undefined
    }
    const [from, to] = chars as string[]
    elements.push(to === undefined ? (from as string) : transitionKey(from as string, to))
  }
  return elements.length === 0 ? undefined : elements
}

export interface ReviewDrillArgs {
  readonly layout: Layout
  readonly unlocked: readonly string[]
  /** Characters and Transition keys, weakest first. */
  readonly elements: readonly string[]
  /** The word bank, once loaded. Without it the drill is made of moves. */
  readonly bank: WordBank | null
  readonly random: Random
  readonly size?: number
}

export interface ReviewDrill {
  /** `words` when any spot is trained in real words, `moves` when every one is a Stage 1 move. */
  readonly mode: 'words' | 'moves'
  readonly text: string
  /** The spots the text actually trains; a spot nothing could be built for is left out. */
  readonly covered: readonly string[]
}

function isLetter(layout: Layout, char: string): boolean {
  return ALPHABETS[layout.language].includes(char)
}

/** A Stage 1 Scale that trains one spot, startable now, or `undefined`. */
function movesScale(
  layout: Layout,
  open: ReadonlySet<string>,
  unlocked: readonly string[],
  element: string,
): Scale | undefined {
  const pair = parseTransitionKey(element)
  if (pair !== undefined) {
    const scale = transitionScale(layout, element)
    return scale?.requires.every((char) => unlocked.includes(char)) ? scale : undefined
  }
  if (!isTypable(layout, open, element)) return undefined
  return catalogue[layout.id].find(
    (scale) =>
      scale.focus.kind === 'key' &&
      scale.focus.value === element &&
      scale.requires.every((char) => unlocked.includes(char)),
  )
}

/** The units one spot contributes: real words holding it, or the items of its Stage 1 drill. */
function unitsFor(
  args: ReviewDrillArgs,
  open: ReadonlySet<string>,
  words: boolean,
  element: string,
): { units: string[]; words: boolean } | undefined {
  const { layout, unlocked, bank, random } = args
  const pair = parseTransitionKey(element)
  const chars = pair === undefined ? [element] : [pair.from, pair.to]
  // Shift is trained by capitals in its own scales, not as a spot: it is not a character.
  if (chars.includes(SHIFT_TOKEN)) return undefined

  if (words && bank !== null && chars.every((char) => isLetter(layout, char))) {
    const found = candidateWords(bank, {
      unlocked: open,
      include: chars.join(''),
      limit: WORDS_PER_SPOT,
    }).map((record) => record.word)
    if (new Set(found).size >= 2) return { units: found, words: true }
  }

  const scale = movesScale(layout, open, unlocked, element)
  if (scale === undefined) return undefined
  const text = generateText({ scale, layout, unlocked, random })
  if (text === REQUIREMENTS_UNMET) return undefined
  const units = text.split(' ').filter((unit) => unit !== '')
  return units.length === 0 ? undefined : { units, words: false }
}

/**
 * The drill text for a set of spots: their units dealt round-robin, one per spot per round, each
 * drawn at random without an immediate repeat, until the text is `size` characters long. The
 * first round holds every covered spot, so a short drill still trains all of them.
 */
export function buildReviewDrill(args: ReviewDrillArgs): ReviewDrill | typeof REQUIREMENTS_UNMET {
  const { layout, unlocked, random } = args
  const size = args.size ?? REVIEW_DRILL_SIZE
  const open = new Set(unlocked)
  const words = args.bank !== null && stage2Open(layout, unlocked)

  const sources: { element: string; units: string[]; words: boolean }[] = []
  for (const element of args.elements.slice(0, REVIEW_DRILL_SPOTS)) {
    const found = unitsFor(args, open, words, element)
    if (found !== undefined) sources.push({ element, ...found })
  }
  if (sources.length === 0) return REQUIREMENTS_UNMET

  const picked: string[] = []
  let length = 0
  let round = 0
  while (length < size && round < 200) {
    for (const source of sources) {
      const last = picked.at(-1)
      const choices = source.units.filter((unit) => unit !== last)
      const pool = choices.length > 0 ? choices : source.units
      const unit = pool[random.nextInt(pool.length)] ?? pool[0]
      if (unit === undefined) continue
      picked.push(unit)
      length += [...unit].length + (picked.length > 1 ? 1 : 0)
    }
    round += 1
  }

  return {
    mode: sources.some((source) => source.words) ? 'words' : 'moves',
    text: picked.join(' '),
    covered: sources.map((source) => source.element),
  }
}
