import type { AttemptSummary } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { makeAttempt, toSummary } from '../progress/fixtures'
import {
  LEVEL_TABLE,
  levelForPoints,
  levelStanding,
  type MasteryCount,
  masteryPoints,
  XP_MASTERY_BONUS,
  XP_PER_PASS,
  xpPerAttempt,
} from './level'

const FLOOR = 0.95
const floorFor = () => FLOOR

function test(scaleId: string, accuracy = 1, completedAt?: number): AttemptSummary {
  return toSummary(
    makeAttempt({
      scaleId,
      accuracy,
      mode: 'test',
      ...(completedAt === undefined ? {} : { completedAt }),
    }),
  )
}

function practice(scaleId: string, accuracy = 1): AttemptSummary {
  return toSummary(makeAttempt({ scaleId, accuracy, mode: 'practice' }))
}

describe('the level table', () => {
  it('starts at level 1 on zero points and only climbs', () => {
    expect(LEVEL_TABLE[0]?.minPoints).toBe(0)
    for (let i = 1; i < LEVEL_TABLE.length; i++) {
      expect(LEVEL_TABLE[i]?.minPoints).toBeGreaterThan(LEVEL_TABLE[i - 1]?.minPoints ?? 0)
    }
  })

  it('maps points to the highest level whose threshold they reach', () => {
    expect(levelForPoints(0)).toBe(1)
    expect(levelForPoints(1)).toBe(1)
    expect(levelForPoints(LEVEL_TABLE[1]?.minPoints ?? 0)).toBe(2)
    expect(levelForPoints(1_000)).toBe(LEVEL_TABLE.length)
  })

  it('weighs an Academy module above a single key', () => {
    expect(masteryPoints({ keysUnlocked: 4, modulesCompleted: 0 })).toBe(4)
    expect(masteryPoints({ keysUnlocked: 0, modulesCompleted: 1 })).toBeGreaterThan(1)
  })
})

describe('XP per attempt', () => {
  it('gives nothing for an empty history', () => {
    expect(xpPerAttempt([], floorFor)).toEqual([])
  })

  it('pays only Test Attempts at or above the floor', () => {
    const attempts = [practice('a'), test('a', 0.94), test('a', FLOOR), practice('a', 1)]
    expect(xpPerAttempt(attempts, floorFor)).toEqual([0, 0, XP_PER_PASS, 0])
  })

  it('adds the mastery bonus once, on the pass that first completes the streak', () => {
    const attempts = [
      test('a'),
      test('a'),
      test('a'),
      test('a'),
      test('a', 0.5),
      test('a'),
      test('a'),
      test('a'),
    ]
    expect(xpPerAttempt(attempts, floorFor)).toEqual([
      XP_PER_PASS,
      XP_PER_PASS,
      XP_PER_PASS + XP_MASTERY_BONUS,
      XP_PER_PASS,
      0,
      XP_PER_PASS,
      XP_PER_PASS,
      XP_PER_PASS,
    ])
  })

  it('lets practice neither advance nor reset the streak, like the Mastery Rule', () => {
    const attempts = [test('a'), practice('a', 0.1), test('a'), test('a')]
    expect(xpPerAttempt(attempts, floorFor)[3]).toBe(XP_PER_PASS + XP_MASTERY_BONUS)
  })

  it('keeps a streak per scale', () => {
    const attempts = [test('a'), test('b'), test('a'), test('b'), test('a')]
    expect(xpPerAttempt(attempts, floorFor)[4]).toBe(XP_PER_PASS + XP_MASTERY_BONUS)
    expect(xpPerAttempt(attempts, floorFor)[3]).toBe(XP_PER_PASS)
  })

  it('uses the floor of the attempt it is judging', () => {
    const strict = (a: AttemptSummary) => (a.scaleId === 'hard' ? 0.99 : FLOOR)
    expect(xpPerAttempt([test('hard', 0.97), test('easy', 0.97)], strict)).toEqual([0, XP_PER_PASS])
  })

  it('never reads speed', () => {
    const slow = { ...test('a'), metrics: { ...test('a').metrics, spm: 1 } }
    const fast = { ...test('a'), metrics: { ...test('a').metrics, spm: 900 } }
    expect(xpPerAttempt([slow], floorFor)).toEqual(xpPerAttempt([fast], floorFor))
  })
})

describe('levelStanding', () => {
  const none: MasteryCount = { keysUnlocked: 0, modulesCompleted: 0 }

  it('is level 1 with an empty bar for an empty history', () => {
    const standing = levelStanding({ attempts: [], masteryAt: () => none, floorFor })
    expect(standing).toEqual({
      level: 1,
      xp: 0,
      xpInLevel: 0,
      xpForNextLevel: LEVEL_TABLE[0]?.xpToNext,
    })
  })

  it('takes the level from mastery alone, however much XP there is', () => {
    const attempts = Array.from({ length: 30 }, (_, i) => test(`s${i % 2}`))
    const standing = levelStanding({ attempts, masteryAt: () => none, floorFor })
    expect(standing.level).toBe(1)
    expect(standing.xp).toBeGreaterThan(LEVEL_TABLE[0]?.xpToNext ?? 0)
    // The bar fills but waits for mastery to move the level.
    expect(standing.xpInLevel).toBe(standing.xpForNextLevel)
  })

  it('counts only XP earned since the attempt that reached the current level', () => {
    const second = LEVEL_TABLE[1]?.minPoints ?? 0
    // Mastery reaches level 2 after the third attempt (the one that completes scale a).
    const attempts = [test('a'), test('a'), test('a'), test('b'), test('b')]
    const masteryAt = (prefix: readonly AttemptSummary[]): MasteryCount => ({
      keysUnlocked: prefix.length >= 3 ? second : 0,
      modulesCompleted: 0,
    })
    const standing = levelStanding({ attempts, masteryAt, floorFor })
    expect(standing.level).toBe(2)
    expect(standing.xp).toBe(5 * XP_PER_PASS + XP_MASTERY_BONUS)
    expect(standing.xpInLevel).toBe(2 * XP_PER_PASS)
    expect(standing.xpForNextLevel).toBe(LEVEL_TABLE[1]?.xpToNext)
  })

  it('counts all XP when the level was already held before any attempt', () => {
    const second = LEVEL_TABLE[1]?.minPoints ?? 0
    const masteryAt = (): MasteryCount => ({ keysUnlocked: second, modulesCompleted: 0 })
    const standing = levelStanding({ attempts: [test('a'), test('a')], masteryAt, floorFor })
    expect(standing.level).toBe(2)
    expect(standing.xpInLevel).toBe(2 * XP_PER_PASS)
  })

  it('folds in completion order whatever order it is handed', () => {
    const second = LEVEL_TABLE[1]?.minPoints ?? 0
    const attempts = [
      test('a', 1, 3000),
      test('a', 1, 1000),
      test('b', 1, 4000),
      test('a', 1, 2000),
    ]
    const masteryAt = (prefix: readonly AttemptSummary[]): MasteryCount => ({
      keysUnlocked: prefix.some((a) => a.completedAt === 3000) ? second : 0,
      modulesCompleted: 0,
    })
    const standing = levelStanding({ attempts, masteryAt, floorFor })
    expect(standing.xp).toBe(4 * XP_PER_PASS + XP_MASTERY_BONUS)
    expect(standing.xpInLevel).toBe(XP_PER_PASS)
  })

  it('asks for mastery only a logarithmic number of times', () => {
    const attempts = Array.from({ length: 512 }, () => test('a'))
    let calls = 0
    const masteryAt = (prefix: readonly AttemptSummary[]): MasteryCount => {
      calls++
      return { keysUnlocked: prefix.length >= 300 ? 4 : 0, modulesCompleted: 0 }
    }
    levelStanding({ attempts, masteryAt, floorFor })
    expect(calls).toBeLessThanOrEqual(12)
  })
})
