import type { Language, LayoutId } from '@typing-race/domain'

/**
 * The Academy (Stage 3) as data: one course per language, a list of modules, each a list of
 * exercises with fixed text. Unlike a Stage 1 Scale, an Academy exercise *is* its text — the
 * pipeline writes it once into `data/curriculum/<lang>/academy.json` and the app never generates it.
 */

/**
 * The requirements' difficulty order for the Academy (§3.3): keys → key pairs → syllables and
 * morphemes → words → phrases → sentences → continuous text → tempo series. A course lists its
 * modules in this order; `parseAcademyCourse` refuses one that does not.
 */
export const ACADEMY_STEPS = [
  'keys',
  'pairs',
  'morphemes',
  'words',
  'phrases',
  'sentences',
  'text',
  'tempo',
] as const

export type AcademyStep = (typeof ACADEMY_STEPS)[number]

/** What a module trains — one row of the §3.3 list, or the warm-up the organisers' course opens with. */
export type AcademyModuleKind =
  | 'warmup'
  | 'letters'
  | 'bigrams'
  | 'sameFinger'
  | 'rolls'
  | 'alternation'
  | 'doubles'
  | 'trigrams'
  | 'morphemes'
  | 'clusters'
  | 'words'
  | 'marks'
  | 'punctuation'
  | 'sentences'
  | 'paragraphs'
  | 'tempo'

/** Interface text in both interface languages; the learner's interface language picks one. */
export type Bilingual = Readonly<Record<Language, string>>

export interface AcademyExercise {
  /** Stable forever: attempts store it as their `scaleId`. `academy.<lang>.<module>.<n>`. */
  readonly id: string
  /** In the course's language — it names the content (`ст · но`, `Радіодиктант 2014`). */
  readonly title: string
  /** Exactly what the learner types: NFC, U+0027 apostrophes, single spaces, layout-typable. */
  readonly text: string
  /** The n-gram, morpheme or letters the exercise is built around, when it has one. */
  readonly focus: string | null
  /** A metronome target for tempo series; `null` everywhere else. */
  readonly targetSpm: number | null
  /** Where the text came from: `organiser` (the hackathon course), `derived` (our word data), `knowledge`. */
  readonly source: 'organiser' | 'derived' | 'knowledge'
}

export interface AcademyModule {
  /** Slug, unique within the course: `bigrams`, `same-finger`. */
  readonly id: string
  readonly step: AcademyStep
  readonly kind: AcademyModuleKind
  readonly title: Bilingual
  readonly summary: Bilingual
  readonly exercises: readonly AcademyExercise[]
}

export interface AcademyCourse {
  readonly format: typeof ACADEMY_FORMAT
  readonly language: Language
  readonly layout: LayoutId
  readonly algorithmVersion: string
  readonly modules: readonly AcademyModule[]
}

export const ACADEMY_FORMAT = 'typing-race/academy@1'

/** Every Academy exercise id starts with this; nothing else does. */
export const ACADEMY_ID_PREFIX = 'academy.'

export function isAcademyExerciseId(id: string): boolean {
  return id.startsWith(ACADEMY_ID_PREFIX)
}
