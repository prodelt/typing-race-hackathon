import type { Layout, Random } from '@typing-race/domain'
import { sentencesOf } from '../academy/generate'
import type { AcademyCourse } from '../academy/types'
import { isTypable, MIN_POOL } from '../stage2/select'
import { candidateWords } from '../words/bank'
import type { WordBank } from '../words/types'

/**
 * The fourth block of a session: real text (requirements §4.1 — warm-up, one target skill,
 * consolidation, real text).
 *
 * Real text means the Academy's sentences and paragraphs, which come from the organisers'
 * knowledge library. Three honest grades, in order:
 *
 * 1. `sentences` — enough whole sentences typable with the keys the learner has open;
 * 2. `closest` — only once Stage 1 is complete (every key has been trained): the sentences with the
 *    fewest characters still locked, which are then named on screen;
 * 3. `words` — before that, a sequence of real words made only of open keys, labelled as words and
 *    never as text. Never pseudo-words.
 *
 * With too few open keys for even that, there is no block, and the screen says so.
 */

/** The id a real-text attempt is recorded under: `yq.realtext`. */
const REAL_TEXT_SEGMENT = 'realtext'
/** Fewer typable sentences than this and the block is not "real text" yet. */
export const MIN_SENTENCES = 3
/** Characters in the block: two or three sentences. */
export const REAL_TEXT_SIZE = 180
/** The easiest open words a word sequence draws from. */
const WORD_POOL = 60

export function realTextId(layout: Layout): string {
  return `${layout.id}.${REAL_TEXT_SEGMENT}`
}

export function isRealTextId(id: string): boolean {
  return id.split('.')[1] === REAL_TEXT_SEGMENT && id.split('.').length === 2
}

export type RealTextKind = 'sentences' | 'closest' | 'words'

export interface RealText {
  readonly kind: RealTextKind
  readonly text: string
  /** For `closest`: the characters in the text the learner has not unlocked yet. */
  readonly locked: readonly string[]
  /** Titles of the Academy pieces the sentences came from. Empty for words. */
  readonly sources: readonly string[]
}

export interface RealTextArgs {
  readonly layout: Layout
  readonly unlocked: readonly string[]
  readonly stage1Complete: boolean
  /** The Academy course of the layout's language, once loaded. */
  readonly course: AcademyCourse | null
  readonly bank: WordBank | null
  readonly random: Random
  readonly size?: number
}

interface Sentence {
  readonly text: string
  readonly title: string
}

/** Every sentence of the course's sentence, paragraph and dictation modules. */
export function courseSentences(course: AcademyCourse): Sentence[] {
  return course.modules
    .filter((module) => module.step === 'sentences' || module.step === 'text')
    .flatMap((module) =>
      module.exercises.flatMap((exercise) =>
        sentencesOf(exercise.text).map((text) => ({ text: text.trim(), title: exercise.title })),
      ),
    )
    .filter((sentence) => sentence.text.length >= 12)
}

function lockedIn(layout: Layout, open: ReadonlySet<string>, text: string): string[] {
  const locked = new Set<string>()
  for (const char of text) if (!isTypable(layout, open, char)) locked.add(char)
  return [...locked]
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

/** Sentences in the given order until the text reaches `size`; at least one. */
function fill(sentences: readonly Sentence[], size: number): Sentence[] {
  const taken: Sentence[] = []
  let length = 0
  for (const sentence of sentences) {
    if (taken.length > 0 && length >= size) break
    taken.push(sentence)
    length += sentence.text.length + 1
  }
  return taken
}

function asText(
  layout: Layout,
  open: ReadonlySet<string>,
  kind: RealTextKind,
  taken: Sentence[],
): RealText {
  const text = taken.map((sentence) => sentence.text).join(' ')
  return {
    kind,
    text,
    locked: kind === 'closest' ? lockedIn(layout, open, text) : [],
    sources: [...new Set(taken.map((sentence) => sentence.title))],
  }
}

export function realTextBlock(args: RealTextArgs): RealText | null {
  const { layout, random } = args
  const size = args.size ?? REAL_TEXT_SIZE
  const open = new Set(args.unlocked)

  if (args.course !== null) {
    const all = courseSentences(args.course)
    const typable = all.filter((sentence) => lockedIn(layout, open, sentence.text).length === 0)
    if (typable.length >= MIN_SENTENCES) {
      return asText(layout, open, 'sentences', fill(shuffled(typable, random), size))
    }
    if (args.stage1Complete && all.length > 0) {
      // Closest first: fewest distinct locked characters, then shortest. Shuffled before the
      // stable sort, so equally close sentences vary from session to session.
      const ranked = shuffled(all, random)
        .map((sentence) => ({ sentence, locked: lockedIn(layout, open, sentence.text).length }))
        .sort((a, b) => a.locked - b.locked || a.sentence.text.length - b.sentence.text.length)
        .map(({ sentence }) => sentence)
      return asText(layout, open, 'closest', fill(ranked, size))
    }
  }

  if (args.bank === null) return null
  const pool = candidateWords(args.bank, { unlocked: open, limit: WORD_POOL }).map((r) => r.word)
  if (new Set(pool).size < MIN_POOL) return null
  const words: string[] = []
  let length = 0
  while (length < size) {
    const last = words.at(-1)
    const choices = pool.filter((word) => word !== last)
    const word = choices[random.nextInt(choices.length)] ?? (choices[0] as string)
    words.push(word)
    length += [...word].length + (words.length > 1 ? 1 : 0)
  }
  return { kind: 'words', text: words.join(' '), locked: [], sources: [] }
}
