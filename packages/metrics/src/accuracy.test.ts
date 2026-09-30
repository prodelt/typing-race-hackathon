import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { accuracyOf, countKeystrokes } from './accuracy'
import { back, bad, buildLog, ignored, ok, type RawEvent } from './logs'

// Requirements §8.2: a wrong keystroke stays counted after a Backspace correction, and Backspace is
// not in the denominator. Every expected value below is worked out in the comment above it.
describe('accuracyOf — fixed worked examples', () => {
  it('is 1 for a clean run', () => {
    // c a t, all correct: 3 / 3.
    expect(accuracyOf(buildLog([ok('c', 500), ok('a', 200), ok('t', 200)]))).toBe(1)
  })

  it('keeps a corrected error in the denominator', () => {
    // c, x (wrong), Backspace, a, t. Character keystrokes: c x a t = 4; correct: c a t = 3.
    // 3 / 4 = 0.75. Had the Backspace been counted it would be 3 / 5 = 0.6; had the erased x
    // been forgotten it would be 3 / 3 = 1.
    const log = buildLog([ok('c', 500), bad('x', 200), back(150), ok('a', 250), ok('t', 300)])
    expect(countKeystrokes(log)).toEqual({ correct: 3, total: 4 })
    expect(accuracyOf(log)).toBe(0.75)
  })

  it('counts every wrong keystroke, not only the last one before a correction', () => {
    // a, x, x, Backspace, Backspace, b. Characters: a x x b = 4; correct: a b = 2. 2 / 4 = 0.5.
    // With the two Backspaces in the denominator it would be 2 / 6 = 1/3.
    const log = buildLog([
      ok('a', 400),
      bad('x', 100),
      bad('x', 100),
      back(100),
      back(100),
      ok('b', 100),
    ])
    expect(accuracyOf(log)).toBe(0.5)
  })

  it('ignores ignored events entirely', () => {
    // a, ignored modifier, b: 2 / 2. An ignored event consumed no awaited character (FR-020).
    expect(accuracyOf(buildLog([ok('a', 100), ignored(50), ok('b', 100)]))).toBe(1)
  })

  it('reports 0 for an attempt with no character keystrokes, not a flattering 1', () => {
    expect(accuracyOf(buildLog([]))).toBe(0)
    expect(accuracyOf(buildLog([back(100), ignored(100)]))).toBe(0)
  })

  it('is 0 when every keystroke is wrong', () => {
    expect(accuracyOf(buildLog([bad('x', 100), bad('y', 100)]))).toBe(0)
  })
})

const eventArbitrary: fc.Arbitrary<RawEvent> = fc.oneof(
  fc.record({ dt: fc.nat(5000) }).map(({ dt }) => ok('a', dt)),
  fc.record({ dt: fc.nat(5000) }).map(({ dt }) => bad('x', dt)),
  fc.record({ dt: fc.nat(5000) }).map(({ dt }) => back(dt)),
  fc.record({ dt: fc.nat(5000) }).map(({ dt }) => ignored(dt)),
)
const logArbitrary = fc.array(eventArbitrary, { maxLength: 60 })

describe('accuracyOf — properties', () => {
  it('is always within [0, 1]', () => {
    fc.assert(
      fc.property(logArbitrary, (events) => {
        const accuracy = accuracyOf(buildLog(events))
        expect(accuracy).toBeGreaterThanOrEqual(0)
        expect(accuracy).toBeLessThanOrEqual(1)
      }),
    )
  })

  it('equals correct over all character keystrokes, computed independently', () => {
    fc.assert(
      fc.property(logArbitrary, (events) => {
        const chars = events.filter((event) => event.kind === 'char')
        const expected =
          chars.length === 0 ? 0 : chars.filter((event) => event.correct).length / chars.length
        expect(accuracyOf(buildLog(events))).toBe(expected)
      }),
    )
  })

  it('is unchanged by inserting Backspaces anywhere', () => {
    fc.assert(
      fc.property(logArbitrary, fc.nat(60), fc.nat(5000), (events, at, dt) => {
        const position = Math.min(at, events.length)
        const withBackspace = [...events.slice(0, position), back(dt), ...events.slice(position)]
        expect(accuracyOf(buildLog(withBackspace))).toBe(accuracyOf(buildLog(events)))
      }),
    )
  })

  it('never rises when a wrong keystroke is appended, and never falls when a correct one is', () => {
    fc.assert(
      fc.property(logArbitrary, (events) => {
        const before = accuracyOf(buildLog(events))
        expect(accuracyOf(buildLog([...events, bad('x', 100)]))).toBeLessThanOrEqual(before)
        const hasChars = events.some((event) => event.kind === 'char')
        if (hasChars) {
          expect(accuracyOf(buildLog([...events, ok('a', 100)]))).toBeGreaterThanOrEqual(before)
        }
      }),
    )
  })
})
