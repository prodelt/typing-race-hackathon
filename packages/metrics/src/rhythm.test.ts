import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { back, bad, buildLog, ignored, ok } from './logs'
import { rhythmConsistencyOf } from './rhythm'

describe('rhythmConsistencyOf: fixed worked examples (research R5)', () => {
  it('is 100 for a perfect metronome', () => {
    // Intervals 200, 200, 200: sd 0, cv 0, so 100 x (1 - 0).
    const log = buildLog([ok('a', 900), ok('b', 200), ok('c', 200), ok('d', 200)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 100, breaksExcluded: 0 })
  })

  it('is 50 for intervals of 100 and 300', () => {
    // mean 200; deviations +-100; variance 100^2 = 10000; sd 100; cv 0.5, so 100 x 0.5 = 50.
    const log = buildLog([ok('a', 1000), ok('b', 100), ok('c', 300)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 50, breaksExcluded: 0 })
  })

  it('excludes an interval over 3000 ms and reports it', () => {
    // a, b(100), c(4000, a break), d(300): eligible 100 and 300 give 50; one break excluded.
    // Without the exclusion the 4000 would dominate and the value would be 0.
    const log = buildLog([ok('a', 1000), ok('b', 100), ok('c', 4000), ok('d', 300)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 50, breaksExcluded: 1 })
  })

  it('still counts an interval of exactly 3000 ms', () => {
    // 3000 is the limit, not over it: intervals 3000 and 3000 give cv 0, so 100.
    const log = buildLog([ok('a', 1), ok('b', 3000), ok('c', 3000)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 100, breaksExcluded: 0 })
  })

  it('clamps to 0 when the spread exceeds the mean', () => {
    // Intervals 0, 0, 0, 3000: mean 750; variance (3 x 750^2 + 2250^2) / 4 = 1 687 500;
    // sd about 1299; cv about 1.73, so max(0, -0.73) = 0.
    const log = buildLog([ok('a', 1), ok('b', 0), ok('c', 0), ok('d', 0), ok('e', 3000)])
    expect(rhythmConsistencyOf(log).value).toBe(0)
  })

  it('skips an interval that follows a wrong key, a Backspace or an ignored event', () => {
    // The 700, 600 and 600 ms intervals follow a wrong key, a Backspace and an ignored event
    // respectively, so they are out. The eligible ones are b 100, f 100, g 100: cv 0, so 100.
    const log = buildLog([
      ok('a', 500),
      ok('b', 100),
      bad('x', 900),
      ok('c', 700),
      back(50),
      ok('d', 600),
      ignored(10),
      ok('e', 600),
      ok('f', 100),
      ok('g', 100),
    ])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 100, breaksExcluded: 0 })
  })

  it('ignores the delay before the very first key', () => {
    const log = buildLog([ok('a', 2999), ok('b', 100), ok('c', 100)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 100, breaksExcluded: 0 })
  })

  it('reports 0 with fewer than two eligible intervals', () => {
    expect(rhythmConsistencyOf(buildLog([]))).toEqual({
      value: 0,
      breaksExcluded: 0,
    })
    expect(rhythmConsistencyOf(buildLog([ok('a', 10), ok('b', 100)]))).toEqual({
      value: 0,
      breaksExcluded: 0,
    })
  })

  it('reports 0 when every interval is zero, where cv is undefined', () => {
    const log = buildLog([ok('a', 0), ok('b', 0), ok('c', 0)])
    expect(rhythmConsistencyOf(log)).toEqual({ value: 0, breaksExcluded: 0 })
  })
})

describe('rhythmConsistencyOf: properties', () => {
  it('stays within [0, 100] and counts breaks exactly', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(6000), { maxLength: 60 }), (dts) => {
        const { value, breaksExcluded } = rhythmConsistencyOf(
          buildLog(dts.map((dt) => ok('a', dt))),
        )
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
        expect(breaksExcluded).toBe(dts.slice(1).filter((dt) => dt > 3000).length)
      }),
    )
  })

  it('is scale-free: multiplying every interval by k leaves the value unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), {
          minLength: 3,
          maxLength: 30,
        }),
        fc.integer({ min: 2, max: 3 }),
        (dts, k) => {
          const scaled = rhythmConsistencyOf(buildLog(dts.map((dt) => ok('a', dt * k))))
          const base = rhythmConsistencyOf(buildLog(dts.map((dt) => ok('a', dt))))
          expect(scaled.value).toBeCloseTo(base.value, 6)
        },
      ),
    )
  })
})
