import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeAggregates } from './aggregates'
import { back, bad, buildLog, EMPTY_LAYOUT, ignored, ok, type RawEvent } from './logs'

const aggregatesOf = (events: readonly RawEvent[], text: string) =>
  computeAggregates({ log: buildLog(events), text, layout: EMPTY_LAYOUT })

describe('computeAggregates: fixed worked examples', () => {
  it('records count, misses and the sum and sum of squares of hit intervals', () => {
    // "aba": a (first key, no usable interval), b 200, a 400.
    // Key b: one hit, sum 200, sq 40000. Key a: only the second a has an interval, so one hit,
    // sum 400, sq 160000. Transitions: a>b one hit 200; b>a one hit 400.
    const a = aggregatesOf([ok('a', 900), ok('b', 200), ok('a', 400)], 'aba')
    expect(a.keys).toEqual({
      b: { count: 1, misses: 0, sumIki: 200, sumIkiSq: 40000 },
      a: { count: 1, misses: 0, sumIki: 400, sumIkiSq: 160000 },
    })
    expect(a.transitions).toEqual({
      'a>b': { count: 1, misses: 0, sumIki: 200, sumIkiSq: 40000 },
      'b>a': { count: 1, misses: 0, sumIki: 400, sumIkiSq: 160000 },
    })
  })

  it('blames a miss on the awaited key and leaves its timing out', () => {
    // "ab": a, x (wrong, awaited b, dt 700), Backspace, b (dt 300).
    // Key b: one miss, then one hit with interval 300: count 2, misses 1, sum 300, sq 90000.
    // The 700 ms before the wrong key is hesitation and is not recorded.
    const a = aggregatesOf([ok('a', 500), bad('x', 700), back(100), ok('b', 300)], 'ab')
    expect(a.keys).toEqual({
      b: { count: 2, misses: 1, sumIki: 300, sumIkiSq: 90000 },
    })
    expect(a.transitions).toEqual({
      'a>b': { count: 2, misses: 1, sumIki: 300, sumIkiSq: 90000 },
    })
  })

  it('records a miss on the very first key, which has no previous character', () => {
    // A wrong first key is a miss on a, but there is no transition into the first character.
    const a = aggregatesOf([bad('x', 800), ok('a', 300)], 'a')
    expect(a.keys).toEqual({
      a: { count: 2, misses: 1, sumIki: 300, sumIkiSq: 90000 },
    })
    expect(a.transitions).toEqual({})
  })

  it('drops a hit whose interval is a break, but keeps every miss', () => {
    // "ab": a, then b after 3001 ms (a break: not a usable interval, so not recorded at all).
    expect(aggregatesOf([ok('a', 100), ok('b', 3001)], 'ab')).toEqual({
      keys: {},
      transitions: {},
    })
    // An interval of exactly 3000 ms is still usable.
    expect(aggregatesOf([ok('a', 100), ok('b', 3000)], 'ab').keys).toEqual({
      b: { count: 1, misses: 0, sumIki: 3000, sumIkiSq: 9000000 },
    })
    // A miss after a long pause is still a miss.
    expect(aggregatesOf([ok('a', 100), bad('x', 9000)], 'ab').keys).toEqual({
      b: { count: 1, misses: 1, sumIki: 0, sumIkiSq: 0 },
    })
  })

  it('ignores ignored events and keystrokes typed past the end of the text', () => {
    // "a": a, ignored, then a stray z with nothing awaited, wrong and then right.
    expect(aggregatesOf([ok('a', 100), ignored(50), bad('z', 100), ok('z', 100)], 'a')).toEqual({
      keys: {},
      transitions: {},
    })
  })

  it('walks the text by code point, so a surrogate pair is one character', () => {
    const a = aggregatesOf([ok('a', 100), ok('\u{1D4B3}', 200)], 'a\u{1D4B3}')
    expect(Object.keys(a.keys)).toEqual(['\u{1D4B3}'])
    expect(Object.keys(a.transitions)).toEqual(['a>\u{1D4B3}'])
  })

  it('is empty for an empty log', () => {
    expect(aggregatesOf([], 'abc')).toEqual({ keys: {}, transitions: {} })
  })
})

describe('computeAggregates: properties', () => {
  const events = fc.array(
    fc.oneof(
      fc.nat(5000).map((dt) => ok('a', dt)),
      fc.nat(5000).map((dt) => bad('x', dt)),
      fc.nat(5000).map((dt) => back(dt)),
    ),
    { maxLength: 60 },
  )
  const TEXT = 'a'.repeat(80)

  it('never records more misses than observations, and the sums are consistent', () => {
    fc.assert(
      fc.property(events, (list) => {
        const { keys, transitions } = aggregatesOf(list, TEXT)
        for (const stats of [...Object.values(keys), ...Object.values(transitions)]) {
          expect(stats.misses).toBeGreaterThanOrEqual(0)
          expect(stats.misses).toBeLessThanOrEqual(stats.count)
          expect(stats.sumIki).toBeGreaterThanOrEqual(0)
          // Cauchy-Schwarz: hits x sum of squares is at least the square of the sum.
          const hits = stats.count - stats.misses
          expect(stats.sumIkiSq * hits).toBeGreaterThanOrEqual(stats.sumIki ** 2)
        }
      }),
    )
  })

  it('counts exactly the wrong keystrokes as misses', () => {
    fc.assert(
      fc.property(events, (list) => {
        const wrong = list.filter((event) => event.kind === 'char' && !event.correct).length
        const { keys } = aggregatesOf(list, TEXT)
        const misses = Object.values(keys).reduce((sum, stats) => sum + stats.misses, 0)
        expect(misses).toBe(wrong)
      }),
    )
  })
})
