import type { Language, Layout } from '@typing-race/domain'
import { keyOf, transitionOf } from '../layout/query'
import type { NgramTable, WordBank, WordRecord } from '../words/types'
import { type Blueprint, blueprints, type Part } from './blueprints'
import { foldText, keepTypableTokens, untypable } from './text'
import {
  ACADEMY_FORMAT,
  ACADEMY_ID_PREFIX,
  type AcademyCourse,
  type AcademyExercise,
  type AcademyModule,
} from './types'

/**
 * Builds one language's Academy course, deterministically, from three inputs:
 *
 * - the organisers' course (`academy/typing-race-2026/course.json`) — the backbone: its module
 *   list and hand-written exercises, regrouped into the §3.3 difficulty order;
 * - our derived word bank and n-gram table — every §3.3 row the organisers' course lacks
 *   (frequency-weighted bigrams and trigrams, same-finger transitions, rolls, hand alternation,
 *   double letters, morphemes, frequent words, tempo series) is generated from them;
 * - the organisers' knowledge library — sentences and paragraphs for transfer to real text.
 *
 * No randomness and no clock: the same inputs give the same course byte for byte.
 */

export interface OrganiserExercise {
  readonly id: string
  readonly title: string
  readonly content: string
}

export interface OrganiserCourse {
  readonly modules: readonly {
    readonly id: string
    readonly title: string
    readonly exercises: readonly OrganiserExercise[]
  }[]
}

export interface KnowledgeLesson {
  /** `<collection>/<file stem>`, e.g. `road-rules/01-bezpeka`. */
  readonly id: string
  readonly title: string
  readonly body: string
}

export interface AcademyInputs {
  readonly language: Language
  readonly layout: Layout
  readonly organiser: OrganiserCourse
  readonly bank: WordBank
  readonly ngrams: NgramTable
  readonly knowledge: readonly KnowledgeLesson[]
  readonly algorithmVersion: string
}

export interface AcademyReport {
  readonly organiserUsed: number
  readonly organiserUnused: readonly string[]
  readonly dropped: readonly { readonly source: string; readonly reason: string }[]
  readonly tokensDropped: readonly { readonly source: string; readonly tokens: readonly string[] }[]
}

type Draft = Omit<AcademyExercise, 'id'>

/** Shortest drill worth typing after untypable tokens are removed. */
const MIN_LENGTH = 24

export function buildAcademyCourse(inputs: AcademyInputs): {
  course: AcademyCourse
  report: AcademyReport
} {
  const { language, layout } = inputs
  const organiser = new Map<string, OrganiserExercise>()
  for (const module of inputs.organiser.modules) {
    for (const exercise of module.exercises) organiser.set(exercise.id, exercise)
  }
  const knowledge = new Map(inputs.knowledge.map((lesson) => [lesson.id, lesson]))
  const used = new Set<string>()
  const dropped: { source: string; reason: string }[] = []
  const tokensDropped: { source: string; tokens: string[] }[] = []
  const context: Context = {
    layout,
    words: usableWords(inputs.bank, layout),
    apostropheWords: inputs.bank.words
      .map((w) => w.word)
      .filter((w) => w.includes("'") && !w.includes('-') && untypable(layout, w).length === 0),
    ngrams: inputs.ngrams,
    lessonIds: inputs.knowledge.map((l) => l.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  }

  const fromOrganiser = (id: string, prose: boolean): Draft | undefined => {
    const exercise = organiser.get(id)
    if (exercise === undefined) throw new Error(`organiser exercise ${id} is not in the course`)
    used.add(id)
    const folded = foldText(exercise.content, prose)
    let text = folded
    if (prose) {
      const bad = untypable(layout, folded)
      if (bad.length > 0) {
        dropped.push({ source: id, reason: `untypable: ${bad.join(' ')}` })
        return undefined
      }
    } else {
      text = keepTypableTokens(layout, folded)
      const lost = folded.split(' ').filter((t) => t !== '' && !text.split(' ').includes(t))
      if (lost.length > 0) tokensDropped.push({ source: id, tokens: lost })
    }
    if ([...text].length < MIN_LENGTH) {
      dropped.push({ source: id, reason: 'too short once untypable tokens are removed' })
      return undefined
    }
    return {
      title: foldText(exercise.title, false),
      text,
      focus: null,
      targetSpm: null,
      source: 'organiser',
    }
  }

  const fromKnowledge = (id: string, take: 'paragraph' | 'sentences'): Draft | undefined => {
    const lesson = knowledge.get(id)
    if (lesson === undefined) throw new Error(`knowledge lesson ${id} is missing`)
    let text = foldText(lesson.body, true)
    if (take === 'sentences') text = sentencesOf(text).slice(0, 2).join(' ')
    const bad = untypable(layout, text)
    if (bad.length > 0) {
      dropped.push({ source: id, reason: `untypable: ${bad.join(' ')}` })
      return undefined
    }
    return {
      title: foldText(lesson.title, false),
      text,
      focus: null,
      targetSpm: null,
      source: 'knowledge',
    }
  }

  const modules: AcademyModule[] = blueprints[language].map((blueprint: Blueprint) => {
    const drafts: Draft[] = []
    for (const part of blueprint.parts) {
      for (const draft of expand(part, context, fromOrganiser, fromKnowledge, blueprint)) {
        if (draft !== undefined) drafts.push(draft)
      }
    }
    return {
      id: blueprint.id,
      step: blueprint.step,
      kind: blueprint.kind,
      title: blueprint.title,
      summary: blueprint.summary,
      exercises: drafts.map((draft, index) => ({
        id: `${ACADEMY_ID_PREFIX}${language}.${blueprint.id}.${index + 1}`,
        ...draft,
      })),
    }
  })

  return {
    course: {
      format: ACADEMY_FORMAT,
      language,
      layout: layout.id,
      algorithmVersion: inputs.algorithmVersion,
      modules,
    },
    report: {
      organiserUsed: used.size,
      organiserUnused: [...organiser.keys()].filter((id) => !used.has(id)),
      dropped,
      tokensDropped,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------

interface Context {
  readonly layout: Layout
  /** Letters-only words of the bank, most frequent first. */
  readonly words: readonly WordRecord[]
  /** Typable words with an apostrophe, most frequent first. */
  readonly apostropheWords: readonly string[]
  readonly ngrams: NgramTable
  /** Knowledge lesson ids, sorted by code unit so file order is lesson order. */
  readonly lessonIds: readonly string[]
}

function expand(
  part: Part,
  context: Context,
  fromOrganiser: (id: string, prose: boolean) => Draft | undefined,
  fromKnowledge: (id: string, take: 'paragraph' | 'sentences') => Draft | undefined,
  blueprint: Blueprint,
): (Draft | undefined)[] {
  const prose = blueprint.step === 'sentences' || blueprint.step === 'text'
  switch (part.kind) {
    case 'organiser':
      return part.ids.map((id) => fromOrganiser(id, prose))
    case 'knowledge':
      return context.lessonIds
        .filter((id) => id.startsWith(`${part.collection}/`))
        .slice(0, part.limit)
        .map((id) => fromKnowledge(id, part.take))
    case 'bigrams':
      return ngramDrills(context, pickNgrams(context, 2, part.count * 2), part.count)
    case 'trigrams':
      return ngramDrills(context, pickNgrams(context, 3, part.count * 2), part.count)
    case 'sameFinger':
      return ngramDrills(context, sameFingerBigrams(context, part.count * 2), part.count)
    case 'rolls':
      return ngramDrills(context, rollBigrams(context, part.count * 2), part.count)
    case 'alternation':
      return alternationDrills(context, part.count)
    case 'doubles':
      return ngramDrills(context, doubles(context, part.count * 2), part.count)
    case 'morphemes':
      return morphemeDrills(context, part.morphemes)
    case 'words':
      return wordDrills(context, part.count, part.perExercise)
    case 'apostrophe':
      return apostropheDrills(context, part.count)
    case 'commaSeries':
      return commaSeries(context, part.count)
    case 'tempo':
      return tempoSeries(context, part.targets)
  }
}

function usableWords(bank: WordBank, layout: Layout): WordRecord[] {
  return bank.words.filter(
    (w) => !/['-]/.test(w.word) && [...w.word].every((c) => keyOf(layout, c) !== undefined),
  )
}

const letters = (s: string) => /^\p{L}+$/u.test(s)

function pickNgrams(context: Context, size: 2 | 3, count: number): string[] {
  const list = size === 2 ? context.ngrams.bigrams : context.ngrams.trigrams
  return (
    list
      .map((n) => n.ngram)
      // A bigram of one letter twice is a double-letter pair and has its own drill; a trigram may
      // repeat a letter (`ого`, `ити`, `ння`), which is exactly what makes it common.
      .filter((g) => letters(g) && (size === 3 ? new Set(g).size > 1 : new Set(g).size === 2))
      .slice(0, count)
  )
}

function sameFingerBigrams(context: Context, count: number): string[] {
  return context.ngrams.bigrams
    .map((n) => n.ngram)
    .filter((g) => {
      const [a, b] = [...g]
      if (!letters(g) || a === b || a === undefined || b === undefined) return false
      return transitionOf(context.layout, a, b).sameFinger
    })
    .slice(0, count)
}

const FINGER_RANK = { pinky: 0, ring: 1, middle: 2, index: 3, thumb: 4 } as const

/** A roll: two neighbouring fingers of one hand on the same row. */
function rollBigrams(context: Context, count: number): string[] {
  return context.ngrams.bigrams
    .map((n) => n.ngram)
    .filter((g) => {
      const [a, b] = [...g]
      if (!letters(g) || a === undefined || b === undefined) return false
      const ka = keyOf(context.layout, a)
      const kb = keyOf(context.layout, b)
      if (ka === undefined || kb === undefined) return false
      return (
        ka.hand === kb.hand &&
        ka.row === kb.row &&
        Math.abs(FINGER_RANK[ka.finger] - FINGER_RANK[kb.finger]) === 1
      )
    })
    .slice(0, count)
}

function doubles(context: Context, count: number): string[] {
  const weight = new Map<string, number>()
  for (const w of context.words) {
    const chars = [...w.word]
    // `її` is a word, not a doubled letter inside one.
    if (chars.length < 3) continue
    for (let i = 1; i < chars.length; i++) {
      if (chars[i] !== chars[i - 1]) continue
      const pair = `${chars[i]}${chars[i]}`
      weight.set(pair, (weight.get(pair) ?? 0) + w.frequency)
    }
  }
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([pair]) => pair)
    .slice(0, count)
}

/** The most frequent words containing `g`, 3–10 letters, skipping any already used. */
function wordsWith(context: Context, g: string, take: number, used: Set<string>): string[] {
  const out: string[] = []
  for (const w of context.words) {
    if (out.length === take) break
    const length = [...w.word].length
    if (length < 3 || length > 10 || !w.word.includes(g) || used.has(w.word)) continue
    used.add(w.word)
    out.push(w.word)
  }
  return out
}

/** Two n-grams per exercise: `g g g w w w g g w w w`, then the second n-gram the same way. */
function ngramDrills(context: Context, grams: readonly string[], count: number): Draft[] {
  const drafts: Draft[] = []
  for (let i = 0; i < count && i * 2 < grams.length; i++) {
    const pair = grams.slice(i * 2, i * 2 + 2)
    const used = new Set<string>()
    const text = pair
      .map((g) => {
        const w = wordsWith(context, g, 6, used)
        return [g, g, g, ...w.slice(0, 3), g, g, ...w.slice(3)].join(' ')
      })
      .join(' ')
    drafts.push({
      title: pair.join(' · '),
      text,
      focus: pair.join(' '),
      targetSpm: null,
      source: 'derived',
    })
  }
  return drafts
}

function alternates(context: Context, word: string): boolean {
  const chars = [...word]
  for (let i = 1; i < chars.length; i++) {
    const a = keyOf(context.layout, chars[i - 1] as string)
    const b = keyOf(context.layout, chars[i] as string)
    if (a === undefined || b === undefined || a.hand === b.hand) return false
  }
  return true
}

function alternationDrills(context: Context, count: number): Draft[] {
  const picked = context.words
    .filter((w) => [...w.word].length >= 3 && alternates(context, w.word))
    .slice(0, count * 12)
    .map((w) => w.word)
  const drafts: Draft[] = []
  for (let i = 0; i < count; i++) {
    const chunk = picked.slice(i * 12, i * 12 + 12)
    if (chunk.length < 6) break
    drafts.push({
      title: `${chunk[0]} · ${chunk[1]} · ${chunk[2]}`,
      text: chunk.join(' '),
      focus: null,
      targetSpm: null,
      source: 'derived',
    })
  }
  return drafts
}

function morphemeDrills(
  context: Context,
  morphemes: readonly { readonly m: string; readonly at: 'start' | 'end' }[][],
): Draft[] {
  return morphemes.map((group) => {
    const used = new Set<string>()
    const parts = group.map(({ m, at }) => {
      const found: string[] = []
      for (const w of context.words) {
        if (found.length === 7) break
        const ok = at === 'end' ? w.word.endsWith(m) : w.word.startsWith(m)
        if (!ok || [...w.word].length < [...m].length + 2 || used.has(w.word)) continue
        used.add(w.word)
        found.push(w.word)
      }
      const label = at === 'end' ? `-${m}` : `${m}-`
      return { label, text: [m, m, ...found].join(' ') }
    })
    return {
      title: parts.map((p) => p.label).join(' · '),
      text: parts.map((p) => p.text).join(' '),
      focus: group.map((g) => g.m).join(' '),
      targetSpm: null,
      source: 'derived',
    }
  })
}

function wordDrills(context: Context, count: number, perExercise: number): Draft[] {
  const pool = context.words.filter((w) => [...w.word].length >= 2).slice(0, count * perExercise)
  const drafts: Draft[] = []
  for (let i = 0; i < count; i++) {
    const chunk = pool.slice(i * perExercise, (i + 1) * perExercise).map((w) => w.word)
    if (chunk.length === 0) break
    const from = i * perExercise + 1
    drafts.push({
      title: `${from}-${from + chunk.length - 1}`,
      text: chunk.join(' '),
      focus: null,
      targetSpm: null,
      source: 'derived',
    })
  }
  return drafts
}

/** The most frequent words with an apostrophe, twelve to an exercise. */
function apostropheDrills(context: Context, count: number): Draft[] {
  const pool = context.apostropheWords.slice(0, count * 12)
  const drafts: Draft[] = []
  for (let i = 0; i < count; i++) {
    const chunk = pool.slice(i * 12, i * 12 + 12)
    if (chunk.length < 6) break
    drafts.push({
      title: `${chunk[0]} · ${chunk[1]} · ${chunk[2]}`,
      text: chunk.join(' '),
      focus: "'",
      targetSpm: null,
      source: 'derived',
    })
  }
  return drafts
}

/** Frequent nouns-and-all in comma lists ending with a full stop: `дім, вода, мама.` */
function commaSeries(context: Context, count: number): Draft[] {
  const pool = context.words.filter((w) => [...w.word].length >= 4).slice(40, 40 + count * 12)
  const drafts: Draft[] = []
  for (let i = 0; i < count; i++) {
    const chunk = pool.slice(i * 12, i * 12 + 12).map((w) => w.word)
    if (chunk.length < 6) break
    const groups = [chunk.slice(0, 4), chunk.slice(4, 8), chunk.slice(8)]
      .filter((g) => g.length > 0)
      .map((g) => {
        const first = g[0] as string
        return `${first.charAt(0).toUpperCase()}${first.slice(1)}, ${g.slice(1).join(', ')}.`
      })
    drafts.push({
      title: `${chunk[0]}, ${chunk[1]}.`,
      text: groups.join(' '),
      focus: ', .',
      targetSpm: null,
      source: 'derived',
    })
  }
  return drafts
}

/** Short series of the most frequent short words, each with a metronome target a step higher. */
function tempoSeries(context: Context, targets: readonly number[]): Draft[] {
  const pool = context.words
    .filter((w) => {
      const n = [...w.word].length
      return n >= 2 && n <= 5
    })
    .slice(0, targets.length * 9)
    .map((w) => w.word)
  return targets.map((target, i) => {
    const chunk = pool.slice(i * 9, i * 9 + 9)
    return {
      title: `${target}`,
      text: chunk.join(' '),
      focus: null,
      targetSpm: target,
      source: 'derived' as const,
    }
  })
}

/** Splits prose into sentences at `.`, `:` or `;` followed by a space and a capital or quote. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.])\s+(?=["\p{Lu}])/u).filter((s) => s !== '')
}
