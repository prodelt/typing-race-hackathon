import type { AttemptSummary, Level } from '@typing-race/domain'
import { levels, passes } from '../levels/table'
import { typedByHand } from '../progress/by-hand'
import { MASTERY_STREAK } from '../progress/derive'
import type { AcademyCourse, AcademyExercise, AcademyModule } from './types'

/**
 * Academy progress: a pure fold over the attempt history, like Stage 1's, and with the same
 * Mastery Rule — three consecutive **test** attempts at or above the level's accuracy floor.
 * Practice attempts neither advance nor reset a streak, an attempt not typed by hand is left out
 * entirely, and speed appears nowhere.
 *
 * The level follows the stage, never the learner: Stage 3 is judged against the `confident` band
 * of `levels.json` ("words and common transitions"), the band whose goal is what the Academy
 * trains.
 */

export const ACADEMY_LEVEL_ID = 'confident'

export const academyLevel: Level = (levels.find((level) => level.id === ACADEMY_LEVEL_ID) ??
  levels[0]) as Level

export interface ExerciseProgress {
  readonly exerciseId: string
  /** Current run of consecutive passing test attempts, capped at the Mastery streak for display. */
  readonly streak: number
  /** Once mastered, always mastered: a later failed test does not un-master an exercise. */
  readonly mastered: boolean
  readonly attempts: number
  readonly practiced: boolean
  /** Best accuracy of any attempt, a fraction; `null` before the first attempt. */
  readonly bestAccuracy: number | null
}

export interface ModuleProgress {
  readonly moduleId: string
  readonly mastered: number
  readonly total: number
  /** Completion criterion: every exercise of the module mastered. */
  readonly complete: boolean
  /** A fraction in [0, 1]: streak steps earned over streak steps needed. Moves on every passing test. */
  readonly fraction: number
  readonly started: boolean
}

export interface CourseProgress {
  readonly exercises: Readonly<Record<string, ExerciseProgress>>
  readonly modules: Readonly<Record<string, ModuleProgress>>
  readonly modulesComplete: number
  readonly exercisesMastered: number
  readonly exercisesTotal: number
  /** Every module complete. */
  readonly complete: boolean
  readonly fraction: number
}

export function academyProgress(
  course: AcademyCourse,
  attempts: readonly AttemptSummary[],
  level: Level = academyLevel,
): CourseProgress {
  const byExercise = new Map<string, AttemptSummary[]>()
  const ids = new Set(course.modules.flatMap((m) => m.exercises.map((e) => e.id)))
  for (const attempt of [...attempts].sort((a, b) => a.completedAt - b.completedAt)) {
    if (!ids.has(attempt.scaleId) || attempt.layoutId !== course.layout) continue
    // Typing no hand produces is not an attempt of the exercise at all (ADR-0003, 2026-10-06).
    if (!typedByHand(attempt)) continue
    const list = byExercise.get(attempt.scaleId) ?? []
    list.push(attempt)
    byExercise.set(attempt.scaleId, list)
  }

  const exercises: Record<string, ExerciseProgress> = {}
  const modules: Record<string, ModuleProgress> = {}
  let modulesComplete = 0
  let exercisesMastered = 0
  let stepsEarned = 0
  let stepsNeeded = 0

  for (const module of course.modules) {
    let mastered = 0
    let earned = 0
    let started = false
    for (const exercise of module.exercises) {
      const progress = foldExercise(exercise, byExercise.get(exercise.id) ?? [], level)
      exercises[exercise.id] = progress
      if (progress.mastered) mastered++
      if (progress.attempts > 0) started = true
      earned += progress.mastered ? MASTERY_STREAK : progress.streak
    }
    const total = module.exercises.length
    const needed = total * MASTERY_STREAK
    const complete = total > 0 && mastered === total
    modules[module.id] = {
      moduleId: module.id,
      mastered,
      total,
      complete,
      fraction: needed === 0 ? 0 : earned / needed,
      started,
    }
    if (complete) modulesComplete++
    exercisesMastered += mastered
    stepsEarned += earned
    stepsNeeded += needed
  }

  const exercisesTotal = course.modules.reduce((n, m) => n + m.exercises.length, 0)
  return {
    exercises,
    modules,
    modulesComplete,
    exercisesMastered,
    exercisesTotal,
    complete: course.modules.length > 0 && modulesComplete === course.modules.length,
    fraction: stepsNeeded === 0 ? 0 : stepsEarned / stepsNeeded,
  }
}

function foldExercise(
  exercise: AcademyExercise,
  attempts: readonly AttemptSummary[],
  level: Level,
): ExerciseProgress {
  let streak = 0
  let mastered = false
  let practiced = false
  let best: number | null = null
  for (const attempt of attempts) {
    best = best === null ? attempt.metrics.accuracy : Math.max(best, attempt.metrics.accuracy)
    if (attempt.mode !== 'test') {
      practiced = true
      continue
    }
    streak = passes(attempt.metrics.accuracy, level) ? streak + 1 : 0
    if (streak >= MASTERY_STREAK) mastered = true
  }
  return {
    exerciseId: exercise.id,
    streak: Math.min(streak, MASTERY_STREAK),
    mastered,
    attempts: attempts.length,
    practiced,
    bestAccuracy: best,
  }
}

export type AcademyNextStep =
  | {
      readonly kind: 'practice'
      readonly exerciseId: string
      readonly reason: 'belowFloor' | 'start'
    }
  | { readonly kind: 'test'; readonly exerciseId: string; readonly remaining: number }
  | { readonly kind: 'next'; readonly exerciseId: string; readonly moduleComplete: boolean }
  | { readonly kind: 'courseComplete' }

/**
 * The one next step after an Academy attempt (or on the course page when `lastExerciseId` is
 * absent): stay on this exercise until it is mastered, then move to the first unmastered exercise
 * in course order.
 */
export function academyNextStep(
  course: AcademyCourse,
  progress: CourseProgress,
  last: {
    readonly exerciseId: string
    readonly mode: 'practice' | 'test'
    readonly accuracy: number
  } | null,
  level: Level = academyLevel,
): AcademyNextStep {
  if (last !== null) {
    const state = progress.exercises[last.exerciseId]
    if (state !== undefined && !state.mastered) {
      if (!passes(last.accuracy, level)) {
        return { kind: 'practice', exerciseId: last.exerciseId, reason: 'belowFloor' }
      }
      return { kind: 'test', exerciseId: last.exerciseId, remaining: MASTERY_STREAK - state.streak }
    }
  }
  const lastModule =
    last === null
      ? undefined
      : course.modules.find((m) => m.exercises.some((e) => e.id === last.exerciseId))
  const next = firstUnmastered(course, progress, lastModule)
  if (next === undefined) return { kind: 'courseComplete' }
  if (last === null) {
    const state = progress.exercises[next.id]
    if (state?.practiced) {
      return { kind: 'test', exerciseId: next.id, remaining: MASTERY_STREAK - state.streak }
    }
    return { kind: 'practice', exerciseId: next.id, reason: 'start' }
  }
  return {
    kind: 'next',
    exerciseId: next.id,
    moduleComplete:
      lastModule !== undefined && (progress.modules[lastModule.id]?.complete ?? false),
  }
}

/** The first unmastered exercise, preferring the module the learner is already in. */
function firstUnmastered(
  course: AcademyCourse,
  progress: CourseProgress,
  prefer: AcademyModule | undefined,
): AcademyExercise | undefined {
  const open = (e: AcademyExercise) => progress.exercises[e.id]?.mastered !== true
  return prefer?.exercises.find(open) ?? course.modules.flatMap((m) => m.exercises).find(open)
}
