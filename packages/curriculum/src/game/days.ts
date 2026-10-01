import type { AttemptSummary } from '@typing-race/domain'

/**
 * Streak and daily goal — the calendar half of the game layer, folded from attempts like
 * everything else (ADR-0004).
 *
 * Days are `yyyy-mm-dd` keys in the learner's **local** calendar. This package has no clock and no
 * time zone: the caller supplies `today` and a `dayOf(ms)` that maps a completion time to its local
 * day, so midnight and zone behaviour are decided in one place (the app) and testable here.
 */

/** Used when the learner has set no goal of their own. */
export const DEFAULT_GOAL_MINUTES = 20
/** Active days in a run that earn a freeze. */
export const FREEZE_EVERY_DAYS = 7
/** Freezes a learner can hold at once. */
export const MAX_FREEZES = 1

const DAY_MS = 86_400_000

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

function keyOfUtc(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Calendar arithmetic on day keys. Done in UTC, where every day is 24 hours long. */
export function addDays(day: string, days: number): string {
  return keyOfUtc(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS))
}

/**
 * The local day of an instant at a fixed UTC offset, in minutes east of UTC (Kyiv in summer is
 * +180). The app passes the offset the browser reports for that instant, so DST is honoured.
 */
export function dayKeyAtOffset(ms: number, offsetMinutes: number): string {
  return keyOfUtc(new Date(ms + offsetMinutes * 60_000))
}

export interface Streak {
  readonly days: number
  readonly freezes: number
}

/**
 * Consecutive active days ending today (or yesterday: today is not over, so it cannot break a run).
 *
 * Freeze rule: every {@link FREEZE_EVERY_DAYS}th active day of a run earns a freeze, holding at
 * most {@link MAX_FREEZES}. A missed day spends a held freeze and the run goes on; the missed day
 * itself adds nothing to `days`. A missed day with no freeze ends the run, and its count and any
 * progress toward the next freeze go with it. Since only one freeze is ever held, two missed days in
 * a row always end a run.
 */
export function streakOf(activeDays: Iterable<string>, today: string): Streak {
  const active = new Set([...activeDays].filter((day) => day <= today))
  if (active.size === 0) return { days: 0, freezes: 0 }

  let days = 0
  let freezes = 0
  let towardFreeze = 0
  let day = [...active].sort()[0] as string
  for (; day <= today; day = addDays(day, 1)) {
    if (active.has(day)) {
      days++
      towardFreeze++
      if (towardFreeze === FREEZE_EVERY_DAYS) {
        towardFreeze = 0
        freezes = Math.min(MAX_FREEZES, freezes + 1)
      }
    } else if (day === today) {
      // Not over yet.
    } else if (freezes > 0) {
      freezes--
    } else {
      days = 0
      towardFreeze = 0
    }
  }
  return { days, freezes }
}

export interface DayMinutes {
  readonly date: string
  readonly minutes: number
}

export interface DailyGoal {
  readonly minutesToday: number
  readonly goalMinutes: number
  /** Seven days, oldest first, today last. */
  readonly last7: readonly DayMinutes[]
}

export interface DailyGoalArgs {
  readonly today: string
  readonly dayOf: (ms: number) => string
  readonly goalMinutes?: number
}

/**
 * Minutes practised per local day, practice and tests alike, from each attempt's focused time
 * (`elapsedMs`), filed under the day it was completed. Whole minutes, rounded per day.
 */
export function dailyGoal(attempts: readonly AttemptSummary[], args: DailyGoalArgs): DailyGoal {
  const msByDay = new Map<string, number>()
  for (const attempt of attempts) {
    const day = args.dayOf(attempt.completedAt)
    msByDay.set(day, (msByDay.get(day) ?? 0) + attempt.elapsedMs)
  }
  const last7 = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(args.today, index - 6)
    return { date, minutes: Math.round((msByDay.get(date) ?? 0) / 60_000) }
  })
  return {
    minutesToday: last7[6]?.minutes ?? 0,
    goalMinutes: args.goalMinutes ?? DEFAULT_GOAL_MINUTES,
    last7,
  }
}
