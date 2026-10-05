import { describe, expect, it } from 'vitest'
import {
  type BestStore,
  isNewBest,
  readBest,
  SPRINT_MS,
  secondsLeft,
  sprintText,
  writeBest,
} from './model.js'

const memory = (): BestStore => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

describe('sprint timer', () => {
  it('counts whole seconds down from 60 and stops at zero', () => {
    expect(secondsLeft(0)).toBe(60)
    expect(secondsLeft(500)).toBe(60)
    expect(secondsLeft(1000)).toBe(59)
    expect(secondsLeft(SPRINT_MS - 1)).toBe(1)
    expect(secondsLeft(SPRINT_MS)).toBe(0)
    expect(secondsLeft(SPRINT_MS + 5000)).toBe(0)
  })
})

describe('sprint best', () => {
  it('needs the accuracy floor to set a best', () => {
    expect(isNewBest({ spm: 200, accuracy: 0.8 }, null, 0.9)).toBe(false)
    expect(isNewBest({ spm: 200, accuracy: 0.95 }, null, 0.9)).toBe(true)
  })

  it('needs a faster pace than the stored best', () => {
    const best = { spm: 150, accuracy: 0.97 }
    expect(isNewBest({ spm: 150, accuracy: 0.99 }, best, 0.9)).toBe(false)
    expect(isNewBest({ spm: 151, accuracy: 0.91 }, best, 0.9)).toBe(true)
  })

  it('keeps one best per language and survives broken storage', () => {
    const store = memory()
    writeBest(store, 'uk', { spm: 120, accuracy: 0.96 })
    expect(readBest(store, 'uk')).toEqual({ spm: 120, accuracy: 0.96 })
    expect(readBest(store, 'en')).toBeNull()
    store.setItem('typing-race:sprint-best:en', '{oops')
    expect(readBest(store, 'en')).toBeNull()
    const throwing: BestStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(readBest(throwing, 'uk')).toBeNull()
    expect(() => writeBest(throwing, 'uk', { spm: 1, accuracy: 1 })).not.toThrow()
  })
})

describe('sprint text', () => {
  it('uses only the given words and never repeats one twice in a row', () => {
    let i = 0
    const text = sprintText(['мама', 'тато'], () => (i++ % 3) / 3, 50)
    const words = text.split(' ')
    expect(words).toHaveLength(50)
    expect(words.every((w) => w === 'мама' || w === 'тато')).toBe(true)
    expect(words.some((w, k) => k > 0 && w === words[k - 1])).toBe(false)
  })
})
