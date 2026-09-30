import { describe, expect, it } from 'vitest'
import { scriptedRandom, seededRandom } from './seeded-random'

describe('seededRandom', () => {
  it('replays the same sequence for the same seed, in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 50; i++) {
      const value = a.next()
      expect(value).toBe(b.next())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('draws integers in [0, max)', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 100; i++) {
      const value = random.nextInt(5)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(5)
    }
  })

  it('differs across seeds', () => {
    expect(seededRandom(1).next()).not.toBe(seededRandom(2).next())
  })
})

describe('scriptedRandom', () => {
  it('replays its script and then repeats the last value', () => {
    const random = scriptedRandom([0.1, 0.9])
    expect([random.next(), random.next(), random.next()]).toEqual([0.1, 0.9, 0.9])
  })

  it('turns a script value into an index, which can be out of range on purpose', () => {
    expect(scriptedRandom([0.5]).nextInt(4)).toBe(2)
    expect(scriptedRandom([1]).nextInt(4)).toBe(4)
  })

  it('falls back to zero for an empty script', () => {
    expect(scriptedRandom([]).next()).toBe(0)
  })
})
