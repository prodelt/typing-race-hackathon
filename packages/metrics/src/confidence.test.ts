import type { AttemptAggregates, ConfidenceState, ElementStats } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { confidenceOf, foldConfidence } from './confidence'
import {
  CONFIDENCE_HALF_LIFE,
  CONFIDENCE_MIN_SAMPLES,
  REFERENCE_IKI_MS,
  RHYTHM_BREAK_MS,
} from './constants'

const EMPTY: ConfidenceState = { keys: {}, transitions: {} }
const LAMBDA = 2 ** (-1 / 10)

/** `hitIkis.length` hits, each with the given interval, plus `misses` misses. */
function statsOf(hitIkis: readonly number[], misses: number): ElementStats {
  return {
    count: hitIkis.length + misses,
    misses,
    sumIki: hitIkis.reduce((sum, iki) => sum + iki, 0),
    sumIkiSq: hitIkis.reduce((sum, iki) => sum + iki ** 2, 0),
  }
}
const keyAttempt = (stats: ElementStats): AttemptAggregates => ({
  keys: { a: stats },
  transitions: {},
})
const foldAll = (attempts: readonly ElementStats[]): ConfidenceState =>
  attempts.reduce((state, stats) => foldConfidence(state, keyAttempt(stats)), EMPTY)

describe('constants', () => {
  it('match the published formulas', () => {
    expect(REFERENCE_IKI_MS).toBe(400)
    expect(CONFIDENCE_HALF_LIFE).toBe(10)
    expect(CONFIDENCE_MIN_SAMPLES).toBe(5)
    expect(RHYTHM_BREAK_MS).toBe(3000)
  })
})

describe('confidenceOf: fixed worked examples (research R4)', () => {
  it('is undefined below five observations, not zero', () => {
    // 4 hits: n = 4 < 5.
    expect(confidenceOf(foldAll([statsOf([200, 200, 200, 200], 0)]), 'a')).toBeUndefined()
  })

  it('is undefined for an element never observed', () => {
    expect(confidenceOf(EMPTY, 'a')).toBeUndefined()
    expect(confidenceOf(foldAll([statsOf([200], 0)]), 'z')).toBeUndefined()
  })

  it('is 1 for five fast, accurate hits', () => {
    // n = 5; accuracy 5/5 = 1; mean IKI 200 < 400, so speed clamps to 1.
    expect(confidenceOf(foldAll([statsOf([200, 200, 200, 200, 200], 0)]), 'a')).toBe(1)
  })

  it('multiplies accuracy by speed', () => {
    // 4 hits at 400 ms and 1 miss: n = 5, accuracy 4/5 = 0.8, mean 400, speed 400/400 = 1 -> 0.8.
    expect(confidenceOf(foldAll([statsOf([400, 400, 400, 400], 1)]), 'a')).toBeCloseTo(0.8, 12)
    // 5 hits at 800 ms: accuracy 1, speed 400/800 = 0.5 -> 0.5.
    expect(confidenceOf(foldAll([statsOf([800, 800, 800, 800, 800], 0)]), 'a')).toBeCloseTo(0.5, 12)
    // 4 hits at 800 ms and 1 miss: 0.8 x 0.5 = 0.4. Neither factor masks the other.
    expect(confidenceOf(foldAll([statsOf([800, 800, 800, 800], 1)]), 'a')).toBeCloseTo(0.4, 12)
  })

  it('is 0 when every observation is a miss', () => {
    expect(confidenceOf(foldAll([statsOf([], 5)]), 'a')).toBe(0)
  })

  it('treats an instantaneous mean as full speed instead of dividing by zero', () => {
    // 5 hits at 0 ms: mean 0, speed 1, accuracy 1.
    expect(confidenceOf(foldAll([statsOf([0, 0, 0, 0, 0], 0)]), 'a')).toBe(1)
  })

  it('weights the recent attempt more: decay lambda = 2^(-1/10) before each fold', () => {
    // Attempt 1: 5 hits at 400 ms. Attempt 2: 5 misses.
    // wHits = 5 x lambda, wMisses = 5, so accuracy = lambda / (1 + lambda) = 0.48268...
    // Mean IKI = (2000 x lambda) / (5 x lambda) = 400, speed 1.
    const state = foldAll([statsOf([400, 400, 400, 400, 400], 0), statsOf([], 5)])
    expect(confidenceOf(state, 'a')).toBeCloseTo(LAMBDA / (1 + LAMBDA), 12)
    // Reversed, the misses are older and count for less, so confidence is higher: order matters.
    const reversed = foldAll([statsOf([], 5), statsOf([400, 400, 400, 400, 400], 0)])
    expect(confidenceOf(reversed, 'a')).toBeCloseTo(1 / (1 + LAMBDA), 12)
  })

  it('halves an element weight after ten further observations of it', () => {
    // 12 hits, then empty observations of the same element. After 10 of them n = 12 / 2 = 6 >= 5;
    // after 14, n = 12 x 2^(-1.4) = 4.5 < 5 and the element is unmeasured again.
    const hits = statsOf(
      Array.from({ length: 12 }, () => 200),
      0,
    )
    const empty = statsOf([], 0)
    const after = (extra: number) => foldAll([hits, ...Array.from({ length: extra }, () => empty)])
    expect(confidenceOf(after(0), 'a')).toBe(1)
    expect(confidenceOf(after(10), 'a')).toBe(1)
    expect(confidenceOf(after(14), 'a')).toBeUndefined()
  })

  it('leaves an element untouched by an attempt that never observed it', () => {
    const before = foldAll([statsOf([200, 200, 200, 200, 200], 0)])
    const after = foldConfidence(before, { keys: { b: statsOf([200], 0) }, transitions: {} })
    expect(after.keys['a']).toEqual(before.keys['a'])
  })

  it('reads a Transition by its a>b key, separately from keys', () => {
    const hits = statsOf([300, 300, 300, 300, 300], 0)
    const state = foldConfidence(EMPTY, { keys: {}, transitions: { 'a>b': hits } })
    expect(confidenceOf(state, 'a>b')).toBe(1)
    expect(confidenceOf(state, 'a')).toBeUndefined()
  })

  it('does not mutate the prior state', () => {
    const prior = foldAll([statsOf([200], 0)])
    const snapshot = JSON.stringify(prior)
    foldConfidence(prior, keyAttempt(statsOf([200], 1)))
    expect(JSON.stringify(prior)).toBe(snapshot)
  })
})

const ikiArbitrary = fc.integer({ min: 100, max: 3000 })
const statsArbitrary = fc
  .tuple(fc.array(ikiArbitrary, { maxLength: 15 }), fc.nat(10))
  .map(([hitIkis, misses]) => statsOf(hitIkis, misses))
const historyArbitrary = fc.array(statsArbitrary, { maxLength: 8 })
const EPS = 1e-12

describe('confidence: properties', () => {
  it('is undefined or within [0, 1]', () => {
    fc.assert(
      fc.property(historyArbitrary, (history) => {
        const value = confidenceOf(foldAll(history), 'a')
        if (value !== undefined) {
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
      }),
    )
  })

  it('never lowers when a hit at least as fast as every other is added', () => {
    // A hit faster than the running mean cannot raise the mean interval, and it raises accuracy.
    // Every generated interval is >= 100, so a 100 ms hit is at least as fast as all of them.
    fc.assert(
      fc.property(historyArbitrary, statsArbitrary, (history, latest) => {
        const before = confidenceOf(foldAll([...history, latest]), 'a')
        const withHit = statsOf([...hitsOf(latest), 100], latest.misses)
        const after = confidenceOf(foldAll([...history, withHit]), 'a')
        if (before !== undefined) {
          expect(after).toBeDefined()
          expect(after ?? 0).toBeGreaterThanOrEqual(before - EPS)
        }
      }),
    )
  })

  it('never rises when a miss is added', () => {
    fc.assert(
      fc.property(historyArbitrary, statsArbitrary, (history, latest) => {
        const before = confidenceOf(foldAll([...history, latest]), 'a')
        const withMiss = { ...latest, count: latest.count + 1, misses: latest.misses + 1 }
        const after = confidenceOf(foldAll([...history, withMiss]), 'a')
        if (before !== undefined) {
          expect(after).toBeDefined()
          expect(after ?? 0).toBeLessThanOrEqual(before + EPS)
        }
      }),
    )
  })

  it('never lowers when an interval gets shorter', () => {
    fc.assert(
      fc.property(
        historyArbitrary,
        fc.array(ikiArbitrary, { minLength: 1, maxLength: 15 }),
        fc.nat(10),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 1, max: 500 }),
        (history, hitIkis, misses, which, cut) => {
          const index = which % hitIkis.length
          const shorter = hitIkis.map((iki, i) => (i === index ? Math.max(0, iki - cut) : iki))
          const slow = confidenceOf(foldAll([...history, statsOf(hitIkis, misses)]), 'a')
          const fast = confidenceOf(foldAll([...history, statsOf(shorter, misses)]), 'a')
          expect(fast === undefined).toBe(slow === undefined)
          if (slow !== undefined && fast !== undefined) {
            expect(fast).toBeGreaterThanOrEqual(slow - EPS)
          }
        },
      ),
    )
  })

  it('folds to the identical state when repeated from the same history', () => {
    fc.assert(
      fc.property(historyArbitrary, (history) => {
        expect(JSON.stringify(foldAll(history))).toBe(JSON.stringify(foldAll(history)))
      }),
    )
  })
})

/**
 * Recovers the hit intervals a `statsOf` produced well enough for the properties above: only the
 * count and the total matter to Confidence, so one representative interval per hit is exact.
 */
function hitsOf(stats: ElementStats): number[] {
  const hits = stats.count - stats.misses
  return hits === 0 ? [] : Array.from({ length: hits }, () => stats.sumIki / hits)
}
