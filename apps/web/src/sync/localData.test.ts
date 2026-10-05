import { describe, expect, it } from 'vitest'
import { isLearnerDataKey, wipeLearnerData } from './localData.js'

function fakeStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
}

describe('learner data in localStorage', () => {
  it('names the daily challenge and the sprint bests as learner data', () => {
    expect(isLearnerDataKey('typing-race:daily')).toBe(true)
    expect(isLearnerDataKey('typing-race:daily:uk')).toBe(true)
    expect(isLearnerDataKey('typing-race:sprint-best:en')).toBe(true)
  })

  it('leaves device preferences, the guide flag, auth and the test flag alone', () => {
    expect(isLearnerDataKey('typing-race:guide-seen')).toBe(false)
    expect(isLearnerDataKey('typing-race:race-auth')).toBe(false)
    expect(isLearnerDataKey('typing-race:test-account')).toBe(false)
    expect(isLearnerDataKey('typing-race:dailyish')).toBe(false)
    expect(isLearnerDataKey('other:daily')).toBe(false)
  })

  it('removes exactly the learner data keys', () => {
    const storage = fakeStorage({
      'typing-race:daily:uk': '["2026-10-05"]',
      'typing-race:daily': '["2026-10-04"]',
      'typing-race:sprint-best:uk': '{"spm":200}',
      'typing-race:guide-seen': '{"home":true}',
      'typing-race:test-account': '1',
    })
    wipeLearnerData(storage)
    const left = Array.from({ length: storage.length }, (_, i) => storage.key(i)).sort()
    expect(left).toEqual(['typing-race:guide-seen', 'typing-race:test-account'])
  })

  it('survives a missing or throwing storage', () => {
    expect(() => wipeLearnerData(undefined)).not.toThrow()
    const broken = fakeStorage({})
    Object.defineProperty(broken, 'length', {
      get() {
        throw new Error('denied')
      },
    })
    expect(() => wipeLearnerData(broken)).not.toThrow()
  })
})
