import type { AttemptSummary } from '@typing-race/domain'
import { MASTERY_STREAK } from '../progress/derive'
import { byCompletion } from '../progress/order'

/**
 * Level and XP — the game layer's reading of the attempt history. Nothing here is stored: both are
 * folds over the same immutable attempts the progress fold reads (ADR-0004).
 *
 * **Level** follows mastery alone: keys unlocked plus Academy modules completed, summed into
 * mastery points and looked up in {@link LEVEL_TABLE}. **XP** is paid only for Test Attempts that
 * clear their accuracy floor, so it can fill the bar toward the next level, but only mastery moves
 * the level. Speed appears nowhere in this file.
 */

/** XP for one Test Attempt at or above its floor. */
export const XP_PER_PASS = 10
/** Extra XP on the pass that first completes a scale's Mastery streak (a first-time unlock). */
export const XP_MASTERY_BONUS = 50
/** An Academy module is worth this many keys: a module is several mastered exercises. */
export const MODULE_POINTS = 3
/** What one mastery point typically costs in XP: a full streak of passes plus the bonus. */
const XP_PER_POINT = MASTERY_STREAK * XP_PER_PASS + XP_MASTERY_BONUS

export interface MasteryCount {
  /** Keys in the unlocked set beyond the anchors and space. */
  readonly keysUnlocked: number
  readonly modulesCompleted: number
}

export interface LevelRow {
  readonly level: number
  /** Mastery points needed to hold this level. */
  readonly minPoints: number
  /** The size of this level's XP bar: roughly the XP it takes to earn the next level's mastery. */
  readonly xpToNext: number
}

/**
 * Thresholds on mastery points. The steps widen slowly so early levels come in the first
 * sessions; a full layout (~36–44 keys) plus all 17 Academy modules (51 points) reaches the top.
 */
const THRESHOLDS = [0, 2, 4, 7, 10, 14, 18, 23, 28, 34, 40, 47, 55, 64, 74, 85] as const

export const LEVEL_TABLE: readonly LevelRow[] = THRESHOLDS.map((minPoints, index) => {
  const next = THRESHOLDS[index + 1]
  const last = THRESHOLDS[THRESHOLDS.length - 1] ?? 0
  const beforeLast = THRESHOLDS[THRESHOLDS.length - 2] ?? 0
  // The top level keeps a bar of the last step's size, so the bar still fills there.
  const span = next === undefined ? last - beforeLast : next - minPoints
  return { level: index + 1, minPoints, xpToNext: span * XP_PER_POINT }
})

export function masteryPoints(mastery: MasteryCount): number {
  return mastery.keysUnlocked + MODULE_POINTS * mastery.modulesCompleted
}

export function levelForPoints(points: number): number {
  let level = 1
  for (const row of LEVEL_TABLE) if (points >= row.minPoints) level = row.level
  return level
}

/**
 * XP earned by each attempt, in the order given (callers pass completion order).
 *
 * The streak mirrors the Mastery Rule: per scale, a passing test advances it, a failing test resets
 * it, practice does neither. The bonus is paid once per scale, on the pass that first reaches
 * {@link MASTERY_STREAK}.
 */
export function xpPerAttempt(
  attempts: readonly AttemptSummary[],
  floorFor: (attempt: AttemptSummary) => number,
): number[] {
  const streaks = new Map<string, number>()
  const mastered = new Set<string>()
  return attempts.map((attempt) => {
    if (attempt.mode !== 'test') return 0
    const scale = `${attempt.layoutId}|${attempt.scaleId}`
    if (attempt.metrics.accuracy < floorFor(attempt)) {
      streaks.set(scale, 0)
      return 0
    }
    const streak = (streaks.get(scale) ?? 0) + 1
    streaks.set(scale, streak)
    if (streak >= MASTERY_STREAK && !mastered.has(scale)) {
      mastered.add(scale)
      return XP_PER_PASS + XP_MASTERY_BONUS
    }
    return XP_PER_PASS
  })
}

export interface LevelStandingArgs {
  /** Any order: the fold sorts by completion. */
  readonly attempts: readonly AttemptSummary[]
  /**
   * Mastery after a prefix of the attempts in completion order. Must be monotone in the prefix
   * (mastery is never lost), which is what lets the level-up moment be found by bisection.
   */
  readonly masteryAt: (prefix: readonly AttemptSummary[]) => MasteryCount
  readonly floorFor: (attempt: AttemptSummary) => number
}

export interface LevelStanding {
  readonly level: number
  /** Every XP ever earned. */
  readonly xp: number
  /** XP earned since the current level was reached, capped at the bar's size. */
  readonly xpInLevel: number
  readonly xpForNextLevel: number
}

export function levelStanding(args: LevelStandingArgs): LevelStanding {
  const ordered = byCompletion(args.attempts)
  const levelAfter = (count: number) =>
    levelForPoints(masteryPoints(args.masteryAt(ordered.slice(0, count))))
  const level = levelAfter(ordered.length)

  // The smallest prefix already at this level. The attempt that reached it closes the old bar;
  // everything after it fills the new one.
  let low = 0
  let high = ordered.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (levelAfter(mid) >= level) high = mid
    else low = mid + 1
  }

  const earned = xpPerAttempt(ordered, args.floorFor)
  const xp = earned.reduce((sum, value) => sum + value, 0)
  const sinceLevel = earned.slice(low).reduce((sum, value) => sum + value, 0)
  const xpForNextLevel = LEVEL_TABLE[level - 1]?.xpToNext ?? 0
  return { level, xp, xpInLevel: Math.min(sinceLevel, xpForNextLevel), xpForNextLevel }
}
