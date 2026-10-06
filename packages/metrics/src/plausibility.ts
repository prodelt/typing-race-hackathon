import type { ImplausibleReason, KeystrokeEventLog } from '@typing-race/domain'
import { MAX_HUMAN_SPM, MIN_HUMAN_MEDIAN_IKI_MS } from './constants'

/**
 * Milliseconds from each character keystroke to the next, the delay before the first excluded.
 *
 * Measured between character keystrokes rather than between log events, because a held Shift
 * repeats its keydown every ~30 ms and a held Backspace repeats too: both are logged, and neither
 * may shorten the interval between two letters. Their time is folded into the next interval.
 */
export function charIntervals(log: KeystrokeEventLog): number[] {
  const intervals: number[] = []
  let sinceChar: number | null = null
  for (const [index, kind] of log.kind.entries()) {
    if (sinceChar !== null) sinceChar += log.dt[index] ?? 0
    const char = log.char[index]
    if (kind !== 'char' || char === undefined || char === null) continue
    if (sinceChar !== null) intervals.push(sinceChar)
    sinceChar = 0
  }
  return intervals
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * Whether typing this log at this speed is something a hand at a keyboard does (ADR-0003,
 * 2026-10-06). `undefined` when it is; otherwise the reason it is not.
 *
 * Two published rules, each generous on purpose — a learner wrongly told their typing is not their
 * own loses more than a leaderboard gains from one inflated number:
 *
 * - `burst`: the median interval between character keystrokes is under
 *   {@link MIN_HUMAN_MEDIAN_IKI_MS}. This is what catches a line that arrived all at once, which
 *   has an elapsed time of about zero and so no speed to judge, and a burst hidden behind pauses.
 * - `tooFast`: the speed is above {@link MAX_HUMAN_SPM}. This catches a steady script.
 *
 * A single keystroke has no interval and is judged by speed alone.
 */
export function implausibilityOf(
  log: KeystrokeEventLog,
  spm: number,
): ImplausibleReason | undefined {
  const intervals = charIntervals(log)
  if (intervals.length > 0 && median(intervals) < MIN_HUMAN_MEDIAN_IKI_MS) return 'burst'
  if (spm > MAX_HUMAN_SPM) return 'tooFast'
  return undefined
}
