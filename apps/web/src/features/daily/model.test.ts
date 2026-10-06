import type { WordBank } from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearedDays,
  dailySeed,
  dayStreak,
  pickDailyWords,
  readStoredDays,
  writeStoredDays,
} from './model.js'

function bank(language: 'uk' | 'en'): WordBank {
  const words = Array.from({ length: 400 }, (_, i) => ({ word: `w${i}`, rank: i + 1 }))
  return { language, source: 't', algorithmVersion: '1', words } as unknown as WordBank
}

function daily(language: 'uk' | 'en', at: Date, accuracy = 1): AttemptSummary {
  return {
    id: `${language}-${at.getTime()}`,
    scaleId: language === 'uk' ? 'yq.daily' : 'qwerty.daily',
    layoutId: language === 'uk' ? 'yq' : 'qwerty',
    language,
    mode: 'practice',
    seed: 1,
    startedAt: at.getTime() - 30_000,
    completedAt: at.getTime(),
    elapsedMs: 30_000,
    metrics: { accuracy } as AttemptSummary['metrics'],
    aggregates: { keys: {}, transitions: {} },
  }
}

describe('daily challenge', () => {
  afterEach(() => localStorage.clear())

  it('gives the same words for the same day and language', () => {
    expect(pickDailyWords(bank('uk'), '2026-10-05')).toEqual(
      pickDailyWords(bank('uk'), '2026-10-05'),
    )
  })

  it('gives different words the next day and for another language', () => {
    const today = pickDailyWords(bank('uk'), '2026-10-05')
    expect(pickDailyWords(bank('uk'), '2026-10-06')).not.toEqual(today)
    expect(dailySeed('2026-10-05', 'en')).not.toBe(dailySeed('2026-10-05', 'uk'))
  })

  it('picks twenty words', () => {
    expect(pickDailyWords(bank('en'), '2026-10-05')).toHaveLength(20)
  })

  it('counts consecutive cleared days', () => {
    const today = new Date(2026, 9, 5, 12)
    expect(dayStreak(['2026-10-03', '2026-10-04', '2026-10-05'], today)).toBe(3)
    expect(dayStreak(['2026-10-03', '2026-10-04'], today)).toBe(2)
    expect(dayStreak(['2026-10-02'], today)).toBe(0)
  })

  it('clears a day per language: an English daily does not clear the Ukrainian one', () => {
    const attempts = [
      daily('en', new Date(2026, 9, 5, 12)),
      daily('uk', new Date(2026, 9, 4, 12)),
      daily('uk', new Date(2026, 9, 3, 12), 0.5),
    ]
    expect(clearedDays(attempts, 0.95, [], 'uk')).toEqual(['2026-10-04'])
    expect(clearedDays(attempts, 0.95, [], 'en')).toEqual(['2026-10-05'])
  })

  it('does not clear a day with typing no hand produces (ADR-0003, 2026-10-06)', () => {
    const burst = daily('uk', new Date(2026, 9, 5, 12))
    const attempts = [{ ...burst, metrics: { ...burst.metrics, implausible: 'burst' as const } }]
    expect(clearedDays(attempts, 0.95, [], 'uk')).toEqual([])
  })

  it('stores the cleared days per language', () => {
    writeStoredDays('uk', ['2026-10-05'])
    expect(readStoredDays('uk')).toEqual(['2026-10-05'])
    expect(readStoredDays('en')).toEqual([])
  })
})
