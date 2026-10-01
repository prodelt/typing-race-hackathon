import { renderHook } from '@testing-library/react'
import {
  ACADEMY_FORMAT,
  type AcademyCourse,
  catalogue,
  LEVEL_TABLE,
  layouts,
  XP_MASTERY_BONUS,
  XP_PER_PASS,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { deriveGameStats, localDay, useGameStats } from './gameStats'
import { initialState } from './reduce'
import { useAppStore } from './store'

const layout = layouts.yq
const firstKeyScale = catalogue.yq.find(
  (scale) => scale.focus.kind === 'key' && scale.focus.value === layout.unlockOrder[0],
)
if (firstKeyScale === undefined) throw new Error('the yq catalogue has no scale for its first key')

const TODAY = '2026-10-01'
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const noon = Date.parse(`${TODAY}T12:00:00Z`)

let counter = 0
function attempt(over: Partial<AttemptSummary> = {}): AttemptSummary {
  counter++
  const completedAt = over.completedAt ?? noon + counter
  return {
    id: `a-${counter}`,
    scaleId: firstKeyScale?.id ?? '',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: completedAt - 60_000,
    completedAt,
    elapsedMs: 60_000,
    metrics: {
      spm: 120,
      wpm: 24,
      accuracy: 1,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
    ...over,
  }
}

const base = {
  layoutId: 'yq',
  startingLevelChoice: 'neverTouchTyped',
  academyCourse: null,
  today: TODAY,
  dayOf: utc,
} as const

describe('deriveGameStats', () => {
  it('starts everyone at level 1 with nothing earned', () => {
    expect(deriveGameStats({ ...base, attempts: [] })).toEqual({
      level: 1,
      xpInLevel: 0,
      xpForNextLevel: LEVEL_TABLE[0]?.xpToNext,
      streak: { days: 0, freezes: 0 },
      dailyGoal: {
        minutesToday: 0,
        goalMinutes: 20,
        last7: expect.any(Array),
      },
      raceRating: null,
    })
  })

  it('pays XP for passing tests and none for practice or a failed test', () => {
    const attempts = [
      attempt({ mode: 'practice' }),
      attempt({ metrics: { ...attempt().metrics, accuracy: 0.5 } }),
      attempt(),
    ]
    expect(deriveGameStats({ ...base, attempts }).xpInLevel).toBe(XP_PER_PASS)
  })

  it('does not count another layout toward level or XP, but does count its minutes', () => {
    const stats = deriveGameStats({ ...base, attempts: [attempt({ layoutId: 'qwerty' })] })
    expect(stats.xpInLevel).toBe(0)
    expect(stats.dailyGoal.minutesToday).toBe(1)
    expect(stats.streak.days).toBe(1)
  })

  it('raises the level when a starting level already unlocks keys', () => {
    const fresh = deriveGameStats({ ...base, attempts: [] })
    const typist = deriveGameStats({
      ...base,
      startingLevelChoice: 'touchTypesWantsAccuracy',
      attempts: [],
    })
    expect(typist.level).toBeGreaterThan(fresh.level)
  })

  it('treats an unanswered starting level as nothing unlocked', () => {
    expect(deriveGameStats({ ...base, startingLevelChoice: null, attempts: [] }).level).toBe(1)
  })

  it('moves the level with mastered keys, never with speed', () => {
    const fast = { ...attempt().metrics, spm: 900 }
    const order = layout.unlockOrder.slice(0, 2)
    const attempts = order.flatMap((char) => {
      const scale = catalogue.yq.find((s) => s.focus.kind === 'key' && s.focus.value === char)
      return [1, 2, 3].map(() => attempt({ scaleId: scale?.id ?? '', metrics: fast }))
    })
    const stats = deriveGameStats({ ...base, attempts })
    expect(stats.level).toBe(2)
    // The second key's mastery reached level 2, so its own XP closed level 1's bar.
    expect(stats.xpInLevel).toBe(0)
    expect(deriveGameStats({ ...base, attempts: attempts.slice(0, 3) }).xpInLevel).toBe(
      3 * XP_PER_PASS + XP_MASTERY_BONUS,
    )
  })

  it('counts completed Academy modules toward the level', () => {
    const course: AcademyCourse = {
      format: ACADEMY_FORMAT,
      language: 'uk',
      layout: 'yq',
      algorithmVersion: 'test',
      modules: [
        {
          id: 'm1',
          step: 'keys',
          kind: 'warmup',
          title: { uk: 'm', en: 'm' },
          summary: { uk: 'm', en: 'm' },
          exercises: [
            {
              id: 'academy.uk.m1.1',
              title: 'e',
              text: 'e',
              focus: null,
              targetSpm: null,
              source: 'derived',
            },
          ],
        },
      ],
    }
    const attempts = [1, 2, 3].map(() => attempt({ scaleId: 'academy.uk.m1.1' }))
    const without = deriveGameStats({ ...base, attempts })
    const withCourse = deriveGameStats({ ...base, academyCourse: course, attempts })
    expect(withCourse.level).toBeGreaterThan(without.level)
  })

  it('reports streak and daily minutes from local days', () => {
    const yesterday = Date.parse('2026-09-30T12:00:00Z')
    const attempts = [
      attempt({ completedAt: yesterday, elapsedMs: 5 * 60_000 }),
      attempt({ elapsedMs: 3 * 60_000 }),
    ]
    const stats = deriveGameStats({ ...base, attempts })
    expect(stats.streak).toEqual({ days: 2, freezes: 0 })
    expect(stats.dailyGoal.minutesToday).toBe(3)
    expect(stats.dailyGoal.last7.slice(-2)).toEqual([
      { date: '2026-09-30', minutes: 5 },
      { date: TODAY, minutes: 3 },
    ])
  })
})

describe('localDay', () => {
  it('reads the local calendar, whatever the machine zone', () => {
    expect(localDay(new Date(2026, 9, 1, 0, 0, 1).getTime())).toBe('2026-10-01')
    expect(localDay(new Date(2026, 8, 30, 23, 59, 59).getTime())).toBe('2026-09-30')
  })
})

describe('useGameStats', () => {
  afterEach(() => {
    useAppStore.setState({ ...initialState })
  })

  it('derives from the store and keeps the same object across unrelated store changes', () => {
    act(() => {
      useAppStore.setState({ startingLevelChoice: 'neverTouchTyped', attempts: [attempt()] })
    })
    const { result, rerender } = renderHook(() => useGameStats())
    const first = result.current
    expect(first.dailyGoal.last7).toHaveLength(7)

    act(() => {
      useAppStore.setState({ attemptInProgress: true })
    })
    rerender()
    expect(result.current).toBe(first)

    act(() => {
      useAppStore.setState({ attempts: [attempt(), attempt()] })
    })
    expect(result.current).not.toBe(first)
  })
})
