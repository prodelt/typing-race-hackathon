import type { AttemptSummary } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { makeAttempt, toSummary } from '../progress/fixtures'
import { addDays, DEFAULT_GOAL_MINUTES, dailyGoal, dayKeyAtOffset, streakOf } from './days'

/** Ten days ending today, oldest first: `day(0)` is today. */
const TODAY = '2026-10-01'
const day = (back: number) => addDays(TODAY, -back)

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-03-29', 0)).toBe('2026-03-29')
  })
})

describe('dayKeyAtOffset', () => {
  // 2026-09-30T22:30Z. Offsets are explicit so the test does not depend on the machine's zone.
  const instant = Date.UTC(2026, 8, 30, 22, 30)

  it('puts the same instant on different local days in different zones', () => {
    expect(dayKeyAtOffset(instant, 0)).toBe('2026-09-30')
    expect(dayKeyAtOffset(instant, 180)).toBe('2026-10-01') // Kyiv, UTC+3
    expect(dayKeyAtOffset(instant, -300)).toBe('2026-09-30') // New York, UTC-5
  })

  it('starts a local day at local midnight, not at UTC midnight', () => {
    const kyivMidnight = Date.UTC(2026, 8, 30, 21, 0) // 00:00 on the 1st in UTC+3
    expect(dayKeyAtOffset(kyivMidnight - 1, 180)).toBe('2026-09-30')
    expect(dayKeyAtOffset(kyivMidnight, 180)).toBe('2026-10-01')
  })
})

describe('streakOf', () => {
  it('is zero with no history', () => {
    expect(streakOf([], TODAY)).toEqual({ days: 0, freezes: 0 })
  })

  it('counts consecutive active days ending today', () => {
    expect(streakOf([day(2), day(1), day(0)], TODAY)).toEqual({ days: 3, freezes: 0 })
  })

  it('stays alive while today is not over yet', () => {
    expect(streakOf([day(3), day(2), day(1)], TODAY)).toEqual({ days: 3, freezes: 0 })
  })

  it('ignores duplicate and unordered days', () => {
    expect(streakOf([day(0), day(1), day(0), day(1)], TODAY).days).toBe(2)
  })

  it('breaks on a missed day when no freeze is held', () => {
    expect(streakOf([day(4), day(3), day(1), day(0)], TODAY)).toEqual({ days: 2, freezes: 0 })
  })

  it('is zero once yesterday was missed too', () => {
    expect(streakOf([day(5), day(4), day(3), day(2)], TODAY).days).toBe(0)
  })

  it('earns a freeze on the seventh day of a run', () => {
    const six = [6, 5, 4, 3, 2, 1].map(day)
    expect(streakOf(six, TODAY)).toEqual({ days: 6, freezes: 0 })
    expect(streakOf([...six, day(0)], TODAY)).toEqual({ days: 7, freezes: 1 })
  })

  it('holds at most one freeze', () => {
    const fourteen = Array.from({ length: 14 }, (_, i) => day(i))
    expect(streakOf(fourteen, TODAY)).toEqual({ days: 14, freezes: 1 })
  })

  it('spends the freeze on one missed day and keeps the run, without counting the gap', () => {
    // Seven days, a gap, then two more.
    const run = [10, 9, 8, 7, 6, 5, 4, 2, 1].map(day)
    expect(streakOf(run, TODAY)).toEqual({ days: 9, freezes: 0 })
  })

  it('cannot forgive two missed days in a row with one freeze', () => {
    const run = [10, 9, 8, 7, 6, 5, 4, 1].map(day)
    expect(streakOf(run, TODAY)).toEqual({ days: 1, freezes: 0 })
  })

  it('spends a held freeze on yesterday when it was missed', () => {
    const run = [8, 7, 6, 5, 4, 3, 2].map(day)
    expect(streakOf(run, TODAY)).toEqual({ days: 7, freezes: 0 })
  })

  it('earns a second freeze only after spending the first and running seven more days', () => {
    const run = [17, 16, 15, 14, 13, 12, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(day)
    // 7 days (freeze), the gap on day 10 spends it, then seven more days earn a new one.
    expect(streakOf(run, TODAY)).toEqual({ days: 16, freezes: 1 })
  })

  it('ignores days after today', () => {
    expect(streakOf([day(0), addDays(TODAY, 1)], TODAY).days).toBe(1)
  })
})

function at(completedAt: number, elapsedMs: number): AttemptSummary {
  return { ...toSummary(makeAttempt({ completedAt })), elapsedMs }
}

describe('dailyGoal', () => {
  const utc = (ms: number) => dayKeyAtOffset(ms, 0)
  const noon = (key: string) => Date.parse(`${key}T12:00:00Z`)

  it('reports zero minutes and seven empty days with no history', () => {
    const goal = dailyGoal([], { today: TODAY, dayOf: utc })
    expect(goal.minutesToday).toBe(0)
    expect(goal.goalMinutes).toBe(DEFAULT_GOAL_MINUTES)
    expect(goal.last7.map((d) => d.date)).toEqual([6, 5, 4, 3, 2, 1, 0].map(day))
    expect(goal.last7.every((d) => d.minutes === 0)).toBe(true)
  })

  it('sums every attempt of the day, practice and test alike', () => {
    const attempts = [at(noon(TODAY), 4 * 60_000), at(noon(TODAY) + 1, 6 * 60_000 + 20_000)]
    expect(dailyGoal(attempts, { today: TODAY, dayOf: utc }).minutesToday).toBe(10)
  })

  it('takes a goal other than the default', () => {
    expect(dailyGoal([], { today: TODAY, dayOf: utc, goalMinutes: 30 }).goalMinutes).toBe(30)
  })

  it('files each day under its own date, oldest first, today last', () => {
    const attempts = [at(noon(day(6)), 60_000), at(noon(day(1)), 120_000), at(noon(day(9)), 60_000)]
    const { last7 } = dailyGoal(attempts, { today: TODAY, dayOf: utc })
    expect(last7).toEqual([
      { date: day(6), minutes: 1 },
      { date: day(5), minutes: 0 },
      { date: day(4), minutes: 0 },
      { date: day(3), minutes: 0 },
      { date: day(2), minutes: 0 },
      { date: day(1), minutes: 2 },
      { date: TODAY, minutes: 0 },
    ])
  })

  it('splits days at local midnight', () => {
    const kyiv = (ms: number) => dayKeyAtOffset(ms, 180)
    const lateYesterday = Date.UTC(2026, 8, 30, 20, 59) // 23:59 on the 30th in Kyiv
    const earlyToday = Date.UTC(2026, 8, 30, 21, 1) // 00:01 on the 1st in Kyiv
    const goal = dailyGoal([at(lateYesterday, 60_000), at(earlyToday, 120_000)], {
      today: TODAY,
      dayOf: kyiv,
    })
    expect(goal.minutesToday).toBe(2)
    expect(goal.last7.at(-2)).toEqual({ date: day(1), minutes: 1 })
  })
})
