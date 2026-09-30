import type { AttemptSummary } from '@typing-race/domain'

/**
 * T137. Session sizing (FR-077): a full run lands between 15 and 25 minutes at the learner's
 * current speed, and the expected length is known before the first block starts.
 *
 * Pure arithmetic on numbers, so the bound is a property test rather than a stopwatch.
 */

export const MIN_MINUTES = 15
export const TARGET_MINUTES = 20
export const MAX_MINUTES = 25

/**
 * Reading the goal, getting set, and looking at the result between attempts. Typing time alone
 * would understate a session, and a session that runs long is the one the learner abandons.
 */
export const OVERHEAD_SECONDS = 30

/** What a learner with no history is assumed to type at; deliberately modest. */
export const FALLBACK_SPM = 100

/** How many recent attempts say what "current speed" is. */
const SPEED_WINDOW = 5

/** Mean characters per minute over the most recent attempts, or `null` with none to go on. */
export function currentSpm(attempts: readonly AttemptSummary[]): number | null {
  const recent = attempts
    .slice(-SPEED_WINDOW)
    .map((attempt) => attempt.metrics.spm)
    .filter((spm) => spm > 0)
  if (recent.length === 0) return null
  return recent.reduce((sum, spm) => sum + spm, 0) / recent.length
}

export interface SessionSize {
  /** Attempts in warm-up, target and consolidation, each at least one. */
  readonly reps: readonly [number, number, number]
  readonly expectedMinutes: number
}

/** Seconds one attempt takes: typing the scale's characters, plus the fixed overhead. */
export function secondsPerAttempt(spm: number | null, scaleSize: number): number {
  return (scaleSize / Math.max(spm ?? FALLBACK_SPM, 1)) * 60 + OVERHEAD_SECONDS
}

export function sizeSession(args: { spm: number | null; scaleSize: number }): SessionSize {
  const per = secondsPerAttempt(args.spm, args.scaleSize)
  // The window is 600 s wide and one attempt is at most 300 s for any speed above ~14 SPM, so an
  // integer always fits inside it; below that the floor of one attempt per block wins and the run
  // is honestly longer than the window rather than pretending otherwise.
  const low = Math.ceil((MIN_MINUTES * 60) / per)
  const high = Math.floor((MAX_MINUTES * 60) / per)
  const total = Math.max(3, Math.min(Math.max(Math.round((TARGET_MINUTES * 60) / per), low), high))

  const warmUp = Math.max(1, Math.round(total * 0.25))
  const consolidation = Math.max(1, Math.round(total * 0.3))
  const target = Math.max(1, total - warmUp - consolidation)

  return {
    reps: [warmUp, target, consolidation],
    expectedMinutes: Math.round(((warmUp + target + consolidation) * per) / 60),
  }
}
