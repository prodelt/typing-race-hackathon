import {
  isAcademyExerciseId,
  isReviewDrillId,
  isWordDrillId,
  typedByHand,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'

/**
 * Profile's numbers: pure folds over the attempt history, so the screen only lays them out.
 */

/** How many of the newest attempts the accuracy figure averages over. */
export const RECENT_WINDOW = 10

export interface CareerTotals {
  readonly attempts: number
  /** Test attempts typed by hand: the only ones that count toward mastery and XP. */
  readonly tests: number
  /** Whole minutes of typing, unfocused time excluded. */
  readonly minutes: number
  /** Distinct calendar days with at least one finished attempt. */
  readonly days: number
  /**
   * The fastest test attempt; practice never sets a record, and nor does typing that was not by
   * hand (ADR-0003, 2026-10-06). `null` before the first counted test.
   */
  readonly bestSpm: number | null
  /** Mean accuracy (a fraction) of the newest `RECENT_WINDOW` attempts. */
  readonly recentAccuracy: number | null
}

function newestFirst(attempts: readonly AttemptSummary[]): AttemptSummary[] {
  return [...attempts].sort((a, b) => b.completedAt - a.completedAt)
}

export function careerTotals(
  attempts: readonly AttemptSummary[],
  dayOf: (ms: number) => string,
): CareerTotals {
  const tests = attempts.filter((attempt) => attempt.mode === 'test' && typedByHand(attempt))
  const recent = newestFirst(attempts).slice(0, RECENT_WINDOW)
  const elapsed = attempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0)
  return {
    attempts: attempts.length,
    tests: tests.length,
    minutes: Math.round(elapsed / 60_000),
    days: new Set(attempts.map((attempt) => dayOf(attempt.completedAt))).size,
    bestSpm: tests.length === 0 ? null : Math.round(Math.max(...tests.map((t) => t.metrics.spm))),
    recentAccuracy:
      recent.length === 0
        ? null
        : recent.reduce((sum, attempt) => sum + attempt.metrics.accuracy, 0) / recent.length,
  }
}

export function recentAttempts(
  attempts: readonly AttemptSummary[],
  limit: number,
): AttemptSummary[] {
  return newestFirst(attempts).slice(0, limit)
}

/**
 * Speed of the newest `n` attempts, oldest first, in whole characters per minute. Typing that was
 * not by hand is not the learner's speed, so it is not on the line.
 */
export function speedTrend(attempts: readonly AttemptSummary[], n: number): number[] {
  return recentAttempts(attempts.filter(typedByHand), n)
    .reverse()
    .map((attempt) => Math.round(attempt.metrics.spm))
}

export type BadgeId = 'first' | 'test' | 'keys10' | 'speed200' | 'streak7' | 'module' | 'race'

export interface BadgeInput {
  readonly attempts: number
  readonly tests: number
  readonly bestSpm: number | null
  readonly streakDays: number
  readonly keysOpen: number
  readonly modulesComplete: number
  readonly raceRating: number | null
}

/** The badge strip: every badge in a fixed order, earned or not, read off progress already kept. */
export function badges(input: BadgeInput): { readonly id: BadgeId; readonly earned: boolean }[] {
  const earned: Record<BadgeId, boolean> = {
    first: input.attempts > 0,
    test: input.tests > 0,
    keys10: input.keysOpen >= 10,
    speed200: (input.bestSpm ?? 0) >= 200,
    streak7: input.streakDays >= 7,
    module: input.modulesComplete > 0,
    race: input.raceRating !== null,
  }
  return (Object.keys(earned) as BadgeId[]).map((id) => ({ id, earned: earned[id] }))
}

export type AttemptKind = 'scale' | 'words' | 'academy' | 'review'

/** Which part of the route an exercise id belongs to. */
export function attemptKind(scaleId: string): AttemptKind {
  if (isAcademyExerciseId(scaleId)) return 'academy'
  if (isWordDrillId(scaleId)) return 'words'
  if (isReviewDrillId(scaleId)) return 'review'
  return 'scale'
}
