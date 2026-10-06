import type {
  AcademyCourse,
  AcademyExercise,
  AcademyModule,
  AcademyModuleKind,
  AcademyStep,
  Bilingual,
} from '@typing-race/curriculum'
import type { Language } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'

/** Interface text of a module in the learner's interface language. */
export function local(text: Bilingual): string {
  return getLocale() === 'en' ? text.en : text.uk
}

export const STEP_NAMES: Record<AcademyStep, () => string> = {
  keys: m.academy_step_keys,
  pairs: m.academy_step_pairs,
  morphemes: m.academy_step_morphemes,
  words: m.academy_step_words,
  phrases: m.academy_step_phrases,
  sentences: m.academy_step_sentences,
  text: m.academy_step_text,
  tempo: m.academy_step_tempo,
}

/** Modules grouped by their §3.3 step, keeping course order and each module's 1-based number. */
export function groupBySteps(
  modules: readonly AcademyModule[],
): { step: AcademyStep; modules: { module: AcademyModule; n: number }[] }[] {
  const groups: { step: AcademyStep; modules: { module: AcademyModule; n: number }[] }[] = []
  modules.forEach((module, index) => {
    const last = groups.at(-1)
    if (last !== undefined && last.step === module.step) last.modules.push({ module, n: index + 1 })
    else groups.push({ step: module.step, modules: [{ module, n: index + 1 }] })
  })
  return groups
}

export const LAYOUT_NAME: Record<Language, string> = { uk: 'ЙЦУКЕН', en: 'QWERTY' }

export function percent(fraction: number): number {
  return Math.round(fraction * 100)
}

/**
 * The letters of an exercise text the learner has not unlocked yet, lower case, in order of first
 * appearance. Only letters count: punctuation, digits and the Shift forms of an open letter are not
 * what Stage 1 opens one key at a time.
 */
export function lockedLetters(text: string, unlocked: readonly string[]): string[] {
  const open = new Set(unlocked)
  const seen = new Set<string>()
  for (const char of text.toLowerCase()) {
    if (/\p{L}/u.test(char) && !open.has(char)) seen.add(char)
  }
  return [...seen]
}

/** Modules whose lines may repeat letter groups rather than read as words (§3.2). */
const DRILL_KINDS: ReadonlySet<AcademyModuleKind> = new Set([
  'bigrams',
  'sameFinger',
  'rolls',
  'alternation',
  'doubles',
  'trigrams',
  'morphemes',
  'clusters',
])

/**
 * Modules whose tokens are words the course vouches for: the frequency word lists, the read texts
 * and the tempo texts. Not the sentence lessons: grammar notes quote endings (`verb + ing,`).
 */
const TEXT_KINDS: ReadonlySet<AcademyModuleKind> = new Set(['words', 'paragraphs', 'tempo'])

/** Letters, with an apostrophe or a hyphen only between them: `п'ять`, `don't`, `будь-що`. */
const WORD = /^\p{L}+(?:['-]\p{L}+)*$/u

function tokensOf(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean)
}

/** A token of running text as a bare word, or `null` for `4th`, `-ing`, `1914`. */
function wordOf(token: string): string | null {
  const bare = token.replace(/^[«"“(]+|[.,:;!?»"”)]+$/gu, '')
  return WORD.test(bare) ? bare : null
}

/**
 * The letter groups an exercise is built around: its `focus` (`th he`), or for an organiser drill
 * the slash list of its title (`in/ng/ing - endings`).
 */
function groupsOf(exercise: AcademyExercise): Set<string> {
  const groups = new Set(tokensOf(exercise.focus ?? ''))
  const list = exercise.title.split(/\s+/).find((part) => part.includes('/'))
  for (const group of list?.toLowerCase().split('/') ?? [])
    groups.add(group.replace(/^-+|-+$/g, ''))
  return groups
}

const lexicons = new WeakMap<AcademyCourse, ReadonlySet<string>>()

/** Every word of the course's running text, and the word-bank words a derived drill lists. */
function lexiconOf(course: AcademyCourse): ReadonlySet<string> {
  const known = lexicons.get(course)
  if (known !== undefined) return known
  const words = new Set<string>()
  for (const module of course.modules) {
    const text = TEXT_KINDS.has(module.kind)
    const drill = DRILL_KINDS.has(module.kind)
    for (const exercise of module.exercises) {
      if (!text && !(drill && exercise.source === 'derived')) continue
      // Around its letter groups a derived drill lists real words from the word bank.
      const skip = text ? new Set<string>() : groupsOf(exercise)
      for (const token of tokensOf(exercise.text)) {
        const word = skip.has(token) ? null : wordOf(token)
        if (word !== null) words.add(word)
      }
    }
  }
  lexicons.set(course, words)
  return words
}

/**
 * Whether an Academy exercise is mechanics: its lines hold letter groups that are not words
 * (`th th th`), which the screen then says (§3.2). Decided per exercise rather than per module: a
 * trigram drill on «the · you» or a list of double-letter words is real words throughout, and
 * telling the learner otherwise is false.
 *
 * A token is a fragment when the course never uses it as a word and it is not letters, or at most
 * two letters, or one of the groups the exercise drills.
 */
export function isMechanics(
  course: AcademyCourse,
  module: AcademyModule,
  exercise: AcademyExercise,
): boolean {
  if (!DRILL_KINDS.has(module.kind)) return false
  const lexicon = lexiconOf(course)
  const groups = groupsOf(exercise)
  return tokensOf(exercise.text).some(
    (token) =>
      !lexicon.has(token) && (!WORD.test(token) || [...token].length <= 2 || groups.has(token)),
  )
}
