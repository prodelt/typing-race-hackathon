import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeMetrics } from './compute'
import { back, bad, buildLog, EMPTY_LAYOUT, ignored, ok, type RawEvent } from './logs'

const metricsOf = (events: readonly RawEvent[], text: string, elapsedMs: number) =>
  computeMetrics({
    log: buildLog(events),
    text,
    layout: EMPTY_LAYOUT,
    elapsedMs,
  })

// Requirements 8.1 (SPM and accuracy on fixed examples) and 8.2 (corrected errors).
describe('computeMetrics: fixed worked examples', () => {
  it('clean run: "cat" in 1.5 s', () => {
    // 3 character keystrokes in 1500 ms: SPM = 3 x 60000 / 1500 = 120; WPM = 120 / 5 = 24.
    // Accuracy 3/3 = 1, no errors. Intervals after the first key: a 300, t 300 (c has no
    // predecessor), so the mean IKI of a and of t is 300, and of c>a and a>t is 300.
    // Rhythm: intervals 300, 300 give sd 0, cv 0, so 100.
    const m = metricsOf([ok('c', 600), ok('a', 300), ok('t', 300)], 'cat', 1500)
    expect(m.spm).toBe(120)
    expect(m.wpm).toBe(24)
    expect(m.accuracy).toBe(1)
    expect(m.errorCount).toBe(0)
    expect(m.errorsByChar).toEqual({})
    expect(m.meanIkiByKey).toEqual({ a: 300, t: 300 })
    expect(m.meanIkiByTransition).toEqual({ 'c>a': 300, 'a>t': 300 })
    expect(m.rhythmConsistency).toEqual({ value: 100, breaksExcluded: 0 })
  })

  it('corrected error: the wrong key stays counted, the Backspace does not', () => {
    // "cat": c, x (wrong, awaited a), Backspace, a, t in 2400 ms.
    // Character keystrokes: c x a t = 4 (Backspace excluded). SPM = 4 x 60000 / 2400 = 100;
    // WPM = 20. Correct 3 of 4 gives accuracy 0.75. errorCount 1, blamed on the awaited a.
    // Key a: one miss (x) and one hit with interval 250, so the mean over hits is 250.
    // Key t: one hit, interval 300. Transition c>a: miss + hit 250; a>t: hit 300.
    // Rhythm: a follows a Backspace and is ineligible; only t (300) is eligible. One interval has
    // no spread to measure, so the value is 0.
    const m = metricsOf(
      [ok('c', 500), bad('x', 200), back(150), ok('a', 250), ok('t', 300)],
      'cat',
      2400,
    )
    expect(m.spm).toBe(100)
    expect(m.wpm).toBe(20)
    expect(m.accuracy).toBe(0.75)
    expect(m.errorCount).toBe(1)
    expect(m.errorsByChar).toEqual({ a: 1 })
    expect(m.meanIkiByKey).toEqual({ a: 250, t: 300 })
    expect(m.meanIkiByTransition).toEqual({ 'c>a': 250, 'a>t': 300 })
    expect(m.rhythmConsistency).toEqual({ value: 0, breaksExcluded: 0 })
  })

  it('two corrections of the same key: "ab" with x, x, Backspace, Backspace, b', () => {
    // a, x, x, Backspace x2, b: 4 character keystrokes, 2 correct, so accuracy 0.5; errorCount 2,
    // both blamed on the awaited b. SPM = 4 x 60000 / 3000 = 80; WPM = 16.
    const m = metricsOf(
      [ok('a', 400), bad('x', 100), bad('x', 100), back(100), back(100), ok('b', 100)],
      'ab',
      3000,
    )
    expect(m.spm).toBe(80)
    expect(m.wpm).toBe(16)
    expect(m.accuracy).toBe(0.5)
    expect(m.errorCount).toBe(2)
    expect(m.errorsByChar).toEqual({ b: 2 })
  })

  it('an ignored event is neither a keystroke nor an error', () => {
    // "ab": a, ignored, b in 1000 ms: 2 keystrokes, SPM = 2 x 60000 / 1000 = 120.
    const m = metricsOf([ok('a', 100), ignored(50), ok('b', 100)], 'ab', 1000)
    expect(m.spm).toBe(120)
    expect(m.accuracy).toBe(1)
    expect(m.errorCount).toBe(0)
  })

  it('names the typed character for an error made past the end of the text', () => {
    // Nothing is awaited after "a", so the stray z is blamed on itself.
    const m = metricsOf([ok('a', 100), bad('z', 100)], 'a', 1000)
    expect(m.errorsByChar).toEqual({ z: 1 })
    expect(m.errorCount).toBe(1)
  })

  it('reports no speed, rather than infinity, for a non-positive elapsed time', () => {
    const m = metricsOf([ok('a', 100)], 'a', 0)
    expect(m.spm).toBe(0)
    expect(m.wpm).toBe(0)
    expect(metricsOf([ok('a', 100)], 'a', -5).spm).toBe(0)
  })

  it('omits the mean interval of an element that was only ever missed', () => {
    const m = metricsOf([bad('x', 100)], 'a', 1000)
    expect(m.meanIkiByKey).toEqual({})
    expect(m.errorsByChar).toEqual({ a: 1 })
  })

  it('does not throw on a log whose arrays disagree in length', () => {
    const log = {
      formatVersion: 1,
      dt: [100],
      kind: ['char', 'char', 'char'] as const,
      char: ['a', null],
      correct: [true],
    }
    // Event 0 is a correct a. Event 1 has no character and event 2 has no char entry at all, so
    // both are skipped.
    const m = computeMetrics({
      log,
      text: 'ab',
      layout: EMPTY_LAYOUT,
      elapsedMs: 1000,
    })
    expect(m.accuracy).toBe(1)
    // A missing correct flag is read as wrong, a missing dt as 0.
    const short = {
      formatVersion: 1,
      dt: [],
      kind: ['char'] as const,
      char: ['a'],
      correct: [],
    }
    const shortMetrics = computeMetrics({
      log: short,
      text: 'a',
      layout: EMPTY_LAYOUT,
      elapsedMs: 1000,
    })
    expect(shortMetrics.accuracy).toBe(0)
  })
})

const eventArbitrary: fc.Arbitrary<RawEvent> = fc.oneof(
  fc.nat(5000).map((dt) => ok('a', dt)),
  fc.nat(5000).map((dt) => bad('x', dt)),
  fc.nat(5000).map((dt) => back(dt)),
  fc.nat(5000).map((dt) => ignored(dt)),
)
const eventsArbitrary = fc.array(eventArbitrary, { maxLength: 60 })
const TEXT = 'a'.repeat(64)

describe('computeMetrics: properties', () => {
  it('keeps accuracy in [0, 1] and rhythm in [0, 100]', () => {
    fc.assert(
      fc.property(eventsArbitrary, fc.integer({ min: -10, max: 600_000 }), (events, elapsedMs) => {
        const m = metricsOf(events, TEXT, elapsedMs)
        expect(m.accuracy).toBeGreaterThanOrEqual(0)
        expect(m.accuracy).toBeLessThanOrEqual(1)
        expect(m.rhythmConsistency.value).toBeGreaterThanOrEqual(0)
        expect(m.rhythmConsistency.value).toBeLessThanOrEqual(100)
        expect(m.rhythmConsistency.breaksExcluded).toBeGreaterThanOrEqual(0)
      }),
    )
  })

  it('has wpm exactly spm / 5, and wpm x 5 equal to spm within one rounding step', () => {
    // wpm * 5 === spm cannot hold bit for bit for every float: (x / 5) * 5 can land one ulp away.
    // The contract says wpm is exactly spm / 5, which is what is asserted exactly.
    fc.assert(
      fc.property(eventsArbitrary, fc.integer({ min: 1, max: 600_000 }), (events, elapsedMs) => {
        const m = metricsOf(events, TEXT, elapsedMs)
        expect(m.wpm).toBe(m.spm / 5)
        expect(Math.abs(m.wpm * 5 - m.spm)).toBeLessThanOrEqual(m.spm * Number.EPSILON * 2)
      }),
    )
  })

  it('counts errors as the wrong character keystrokes, however many Backspaces follow', () => {
    fc.assert(
      fc.property(eventsArbitrary, (events) => {
        const m = metricsOf(events, TEXT, 1000)
        const wrong = events.filter((event) => event.kind === 'char' && !event.correct).length
        expect(m.errorCount).toBe(wrong)
        const blamed = Object.values(m.errorsByChar).reduce((sum, count) => sum + count, 0)
        expect(blamed).toBe(wrong)
      }),
    )
  })

  it('recomputes byte-identically from the same log', () => {
    fc.assert(
      fc.property(eventsArbitrary, (events) => {
        const first = JSON.stringify(metricsOf(events, TEXT, 12_345))
        const second = JSON.stringify(metricsOf(events, TEXT, 12_345))
        expect(second).toBe(first)
      }),
    )
  })
})
