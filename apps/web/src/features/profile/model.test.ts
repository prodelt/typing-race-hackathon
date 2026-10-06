import type { AttemptSummary } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { attemptKind, badges, careerTotals, recentAttempts, speedTrend } from './model'

describe('badges', () => {
  const none = {
    attempts: 0,
    tests: 0,
    bestSpm: null,
    streakDays: 0,
    keysOpen: 0,
    modulesComplete: 0,
    raceRating: null,
  }

  it('a new player sees every badge, none earned', () => {
    const list = badges(none)
    expect(list).toHaveLength(7)
    expect(list.every((badge) => !badge.earned)).toBe(true)
  })

  it('earns each badge at its threshold', () => {
    const list = badges({
      attempts: 3,
      tests: 1,
      bestSpm: 200,
      streakDays: 7,
      keysOpen: 10,
      modulesComplete: 1,
      raceRating: 1000,
    })
    expect(list.every((badge) => badge.earned)).toBe(true)
  })
})

const DAY = 86_400_000
const T0 = Date.UTC(2026, 8, 1, 12)

function attempt(
  n: number,
  over: {
    scaleId?: string
    mode?: 'practice' | 'test'
    spm?: number
    accuracy?: number
    implausible?: 'burst' | 'tooFast'
  } = {},
): AttemptSummary {
  return {
    id: `a${n}`,
    scaleId: over.scaleId ?? 'yq.run.anchors',
    layoutId: 'yq',
    language: 'uk',
    mode: over.mode ?? 'practice',
    seed: n,
    startedAt: T0 + n * DAY - 120_000,
    completedAt: T0 + n * DAY,
    elapsedMs: 120_000,
    metrics: {
      spm: over.spm ?? 100 + n,
      wpm: (over.spm ?? 100 + n) / 5,
      accuracy: over.accuracy ?? 0.95,
      errorCount: 2,
      errorsByChar: {},
      rhythmConsistency: { value: 80, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
      ...(over.implausible === undefined ? {} : { implausible: over.implausible }),
    },
    aggregates: { keys: {}, transitions: {} },
  } as AttemptSummary
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

describe('careerTotals', () => {
  it('is empty and honest before the first attempt', () => {
    expect(careerTotals([], dayOf)).toEqual({
      attempts: 0,
      tests: 0,
      minutes: 0,
      days: 0,
      bestSpm: null,
      recentAccuracy: null,
    })
  })

  it('counts attempts, tests, whole minutes and distinct days', () => {
    const list = [
      attempt(0, { mode: 'test' }),
      attempt(0.1),
      attempt(1, { mode: 'test' }),
      attempt(3),
    ]
    const totals = careerTotals(list, dayOf)
    expect(totals.attempts).toBe(4)
    expect(totals.tests).toBe(2)
    expect(totals.minutes).toBe(8)
    expect(totals.days).toBe(3)
  })

  it('takes the best speed from tests only, so practice at a crawl or a sprint never sets it', () => {
    const list = [
      attempt(0, { mode: 'practice', spm: 400 }),
      attempt(1, { mode: 'test', spm: 180 }),
      attempt(2, { mode: 'test', spm: 150 }),
    ]
    expect(careerTotals(list, dayOf).bestSpm).toBe(180)
    expect(careerTotals([attempt(0, { spm: 400 })], dayOf).bestSpm).toBeNull()
  })

  it('never takes a record, or a counted test, from typing that was not by hand', () => {
    // The audit's case: a script at 4 264 SPM became the personal best.
    const list = [
      attempt(1, { mode: 'test', spm: 180 }),
      attempt(2, { mode: 'test', spm: 4264, implausible: 'burst' }),
      attempt(3, { mode: 'test', spm: 1600, implausible: 'tooFast' }),
    ]
    const totals = careerTotals(list, dayOf)
    expect(totals.bestSpm).toBe(180)
    expect(totals.tests).toBe(1)
    expect(totals.attempts).toBe(3)
  })

  it('averages accuracy over the last ten attempts, newest by completion', () => {
    const old = Array.from({ length: 5 }, (_, i) => attempt(i, { accuracy: 0.5 }))
    const recent = Array.from({ length: 10 }, (_, i) => attempt(10 + i, { accuracy: 0.9 }))
    expect(careerTotals([...recent, ...old], dayOf).recentAccuracy).toBeCloseTo(0.9)
  })
})

describe('recentAttempts', () => {
  it('lists the newest first and stops at the limit', () => {
    const list = [attempt(2), attempt(5), attempt(1), attempt(4)]
    expect(recentAttempts(list, 3).map((a) => a.id)).toEqual(['a5', 'a4', 'a2'])
  })
})

describe('speedTrend', () => {
  it('gives the speed of the last n attempts, oldest first', () => {
    const list = [attempt(3, { spm: 30 }), attempt(1, { spm: 10 }), attempt(2, { spm: 20 })]
    expect(speedTrend(list, 2)).toEqual([20, 30])
    expect(speedTrend(list, 10)).toEqual([10, 20, 30])
  })

  it('leaves out typing that was not by hand: it is not the learner speed', () => {
    const list = [attempt(1, { spm: 10 }), attempt(2, { spm: 9949, implausible: 'burst' })]
    expect(speedTrend(list, 5)).toEqual([10])
  })

  it('rounds to whole characters per minute', () => {
    expect(speedTrend([attempt(1, { spm: 123.6 })], 5)).toEqual([124])
  })
})

describe('attemptKind', () => {
  it('names the part of the route an exercise id belongs to', () => {
    expect(attemptKind('yq.run.anchors')).toBe('scale')
    expect(attemptKind('qwerty.words.first')).toBe('words')
    expect(attemptKind('academy.uk.bigrams.1')).toBe('academy')
    expect(attemptKind('yq.review.f-j')).toBe('review')
  })
})
