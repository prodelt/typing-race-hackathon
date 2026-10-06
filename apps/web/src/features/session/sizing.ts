import { typedByHand } from '@typing-race/curriculum'
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

/**
 * Mean characters per minute over the most recent attempts typed by hand, or `null` with none to
 * go on. A script's speed would size a session for a learner who does not exist.
 */
export function currentSpm(attempts: readonly AttemptSummary[]): number | null {
  const recent = attempts
    .filter(typedByHand)
    .slice(-SPEED_WINDOW)
    .map((attempt) => attempt.metrics.spm)
    .filter((spm) => spm > 0)
  if (recent.length === 0) return null
  return recent.reduce((sum, spm) => sum + spm, 0) / recent.length
}

/** Minutes the real-text block is sized to: long enough to read as text, short enough to finish. */
export const REAL_TEXT_MINUTES = 3
/** The real-text block never drops below one short sentence, nor grows past a paragraph. */
export const REAL_TEXT_MIN_CHARS = 60
export const REAL_TEXT_MAX_CHARS = 360

/** Characters in the real-text block at this speed: about {@link REAL_TEXT_MINUTES} of typing. */
export function realTextChars(spm: number | null): number {
  const chars = Math.round((spm ?? FALLBACK_SPM) * REAL_TEXT_MINUTES)
  return Math.min(REAL_TEXT_MAX_CHARS, Math.max(REAL_TEXT_MIN_CHARS, chars))
}

export interface SessionSize {
  /** Attempts in warm-up, target and consolidation, each at least one. */
  readonly reps: readonly [number, number, number]
  /** Characters of the fourth block, real text. */
  readonly realTextChars: number
  /** All four blocks, real text included. */
  readonly expectedMinutes: number
}

/** Seconds one attempt takes: typing the scale's characters, plus the fixed overhead. */
export function secondsPerAttempt(spm: number | null, scaleSize: number): number {
  return (scaleSize / Math.max(spm ?? FALLBACK_SPM, 1)) * 60 + OVERHEAD_SECONDS
}

export function sizeSession(args: { spm: number | null; scaleSize: number }): SessionSize {
  const per = secondsPerAttempt(args.spm, args.scaleSize)
  // The real-text block is one attempt of its own length; the exercise blocks fill the rest.
  const textChars = realTextChars(args.spm)
  const text = secondsPerAttempt(args.spm, textChars)
  // The window is 600 s wide and one attempt is at most 300 s for any speed above ~14 SPM, so an
  // integer always fits inside it; below that the floor of one attempt per block wins and the run
  // is honestly longer than the window rather than pretending otherwise.
  const low = Math.ceil((MIN_MINUTES * 60 - text) / per)
  const high = Math.floor((MAX_MINUTES * 60 - text) / per)
  const total = Math.max(
    3,
    Math.min(Math.max(Math.round((TARGET_MINUTES * 60 - text) / per), low), high),
  )

  const warmUp = Math.max(1, Math.round(total * 0.25))
  const consolidation = Math.max(1, Math.round(total * 0.3))
  const target = Math.max(1, total - warmUp - consolidation)

  return {
    reps: [warmUp, target, consolidation],
    realTextChars: textChars,
    expectedMinutes: Math.round(((warmUp + target + consolidation) * per + text) / 60),
  }
}
