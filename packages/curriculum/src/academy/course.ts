import type { Layout } from '@typing-race/domain'
import { layouts } from '../layout/layouts'
import { hasRussianOnlyLetter, untypable } from './text'
import {
  ACADEMY_FORMAT,
  ACADEMY_ID_PREFIX,
  ACADEMY_STEPS,
  type AcademyCourse,
  type AcademyExercise,
  type AcademyModule,
} from './types'

/** The rank of a module's step in the §3.3 order; lower is earlier and easier. */
export function stepRank(step: AcademyModule['step']): number {
  return ACADEMY_STEPS.indexOf(step)
}

/**
 * Everything wrong with a course, as sentences. Empty means the course may ship: the pipeline
 * refuses to write a course with problems, and the app refuses to load one.
 */
export function courseProblems(course: AcademyCourse): string[] {
  const problems: string[] = []
  const layout: Layout | undefined = layouts[course.layout]
  if (layout === undefined) return [`unknown layout ${course.layout}`]
  if (layout.language !== course.language) problems.push('layout and language disagree')
  if (course.modules.length === 0) problems.push('no modules')

  const moduleIds = new Set<string>()
  const exerciseIds = new Set<string>()
  let previousRank = -1
  for (const module of course.modules) {
    const where = `module ${module.id}`
    if (moduleIds.has(module.id)) problems.push(`${where}: duplicate id`)
    moduleIds.add(module.id)
    const rank = stepRank(module.step)
    if (rank < 0) problems.push(`${where}: unknown step ${module.step}`)
    if (rank < previousRank) problems.push(`${where}: step ${module.step} breaks the §3.3 order`)
    previousRank = Math.max(previousRank, rank)
    if (module.exercises.length === 0) problems.push(`${where}: no exercises`)
    if (module.title.uk === '' || module.title.en === '') problems.push(`${where}: missing title`)

    for (const exercise of module.exercises) {
      const at = `${where} / ${exercise.id}`
      if (exerciseIds.has(exercise.id)) problems.push(`${at}: duplicate id`)
      exerciseIds.add(exercise.id)
      if (!exercise.id.startsWith(`${ACADEMY_ID_PREFIX}${course.language}.`)) {
        problems.push(`${at}: id must start with ${ACADEMY_ID_PREFIX}${course.language}.`)
      }
      problems.push(...textProblems(exercise, layout, course.language).map((p) => `${at}: ${p}`))
    }
  }
  return problems
}

function textProblems(
  exercise: AcademyExercise,
  layout: Layout,
  language: AcademyCourse['language'],
): string[] {
  const { text } = exercise
  const problems: string[] = []
  if (text.trim() === '') return ['empty text']
  if (text !== text.normalize('NFC')) problems.push('text is not NFC')
  if (text !== text.trim() || text.includes('  ')) problems.push('stray whitespace')
  const bad = untypable(layout, text)
  if (bad.length > 0) problems.push(`untypable on ${layout.id}: ${bad.join(' ')}`)
  if (language === 'uk' && hasRussianOnlyLetter(text)) problems.push('Russian-only letter')
  if (exercise.targetSpm !== null && !(exercise.targetSpm > 0)) problems.push('bad targetSpm')
  return problems
}

/**
 * Reads a course from JSON and refuses a malformed one, so a broken file fails loudly at load
 * rather than as an exercise the learner cannot finish.
 */
export function parseAcademyCourse(json: unknown): AcademyCourse {
  const raw = json as Partial<AcademyCourse> | null
  if (raw === null || typeof raw !== 'object' || raw.format !== ACADEMY_FORMAT) {
    throw new TypeError('Malformed Academy course: unknown format')
  }
  if (!Array.isArray(raw.modules)) throw new TypeError('Malformed Academy course: no modules')
  const course = raw as AcademyCourse
  const problems = courseProblems(course)
  if (problems.length > 0) {
    throw new TypeError(`Malformed Academy course: ${problems.slice(0, 5).join('; ')}`)
  }
  return course
}

/** The course's exercises in course order, each with its module. */
export function courseExercises(
  course: AcademyCourse,
): { readonly module: AcademyModule; readonly exercise: AcademyExercise }[] {
  return course.modules.flatMap((module) =>
    module.exercises.map((exercise) => ({ module, exercise })),
  )
}

export function findExercise(
  course: AcademyCourse,
  exerciseId: string,
): { readonly module: AcademyModule; readonly exercise: AcademyExercise } | undefined {
  return courseExercises(course).find((entry) => entry.exercise.id === exerciseId)
}
