import type { WordBank } from '@typing-race/curriculum'
import { describe, expect, it } from 'vitest'
import { dailySeed, dayStreak, isDailyId, pickDailyWords } from './model.js'

function bank(language: 'uk' | 'en'): WordBank {
  const words = Array.from({ length: 400 }, (_, i) => ({ word: `w${i}`, rank: i + 1 }))
  return { language, source: 't', algorithmVersion: '1', words } as unknown as WordBank
}

describe('daily challenge', () => {
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

  it('recognises its id', () => {
    expect(isDailyId('uk-jcuken.daily')).toBe(true)
    expect(isDailyId('uk-jcuken.realtext')).toBe(false)
  })
})
