import { describe, expect, it } from 'vitest'
import { expectedScore, RATING_START, ratedScore, rateRoom } from './rating.js'

/**
 * The same cases are run against `rate_race` in Postgres (see the migration's header); the numbers
 * here are the contract both sides keep.
 */
describe('race rating', () => {
  it('rates nothing when fewer than two racers count', () => {
    expect(rateRoom([])).toEqual([])
    expect(rateRoom([{ userId: 'a', rating: RATING_START, score: 300 }])).toEqual([])
  })

  it('moves two equal newcomers by half of K each way', () => {
    const changes = rateRoom([
      { userId: 'a', rating: 1000, score: 300 },
      { userId: 'b', rating: 1000, score: 250 },
    ])
    expect(changes).toEqual([
      { userId: 'a', before: 1000, after: 1016, delta: 16 },
      { userId: 'b', before: 1000, after: 984, delta: -16 },
    ])
  })

  it('leaves equal ratings unchanged on a draw', () => {
    const changes = rateRoom([
      { userId: 'a', rating: 1000, score: 0 },
      { userId: 'b', rating: 1000, score: 0 },
    ])
    expect(changes.map((change) => change.delta)).toEqual([0, 0])
  })

  it('pays more for beating a stronger racer than for beating a weaker one', () => {
    const upset = rateRoom([
      { userId: 'low', rating: 900, score: 300 },
      { userId: 'high', rating: 1200, score: 200 },
    ])
    const expected = rateRoom([
      { userId: 'high', rating: 1200, score: 300 },
      { userId: 'low', rating: 900, score: 200 },
    ])
    expect(upset[0]?.delta).toBe(27)
    expect(expected[0]?.delta).toBe(5)
  })

  it('averages a five-racer room over the four opponents', () => {
    const changes = rateRoom([
      { userId: 'a', rating: 1000, score: 500 },
      { userId: 'b', rating: 1000, score: 400 },
      { userId: 'c', rating: 1000, score: 300 },
      { userId: 'd', rating: 1000, score: 200 },
      { userId: 'e', rating: 1000, score: 0 },
    ])
    expect(changes.map((change) => change.delta)).toEqual([16, 8, 0, -8, -16])
  })

  it('never drops below the floor', () => {
    const [low] = rateRoom([
      { userId: 'a', rating: 105, score: 0 },
      { userId: 'b', rating: 105, score: 300 },
    ])
    expect(low?.after).toBe(100)
  })

  it('is symmetric in a pair', () => {
    const [a, b] = rateRoom([
      { userId: 'a', rating: 1043, score: 210 },
      { userId: 'b', rating: 987, score: 340 },
    ])
    expect((a?.delta ?? 0) + (b?.delta ?? 0)).toBe(0)
    expect(expectedScore(1000, 1000)).toBe(0.5)
  })

  it('counts unvalidated, below-floor and unfinished results as zero', () => {
    expect(ratedScore(null)).toBe(0)
    expect(ratedScore({ validated: false, accuracy: 0.99, score: 400 })).toBe(0)
    expect(ratedScore({ validated: true, accuracy: 0.89, score: 400 })).toBe(0)
    expect(ratedScore({ validated: true, accuracy: 0.95, score: 400 })).toBe(400)
  })
})
