import { describe, expect, it } from 'vitest'
import { MAX_HUMAN_SPM, MIN_HUMAN_MEDIAN_IKI_MS } from './constants'
import { back, buildLog, ignored, ok, type RawEvent } from './logs'
import { charIntervals, implausibilityOf } from './plausibility'

/** `n` correct keystrokes of `a`, the first after 400 ms, each later one `gap` ms after the last. */
function typed(n: number, gap: number): RawEvent[] {
  return Array.from({ length: n }, (_, i) => ok('a', i === 0 ? 400 : gap))
}

/** SPM as `computeMetrics` reports it for a clean run of `n` keys `gap` ms apart. */
const spmOf = (n: number, gap: number) => (n * 60_000) / ((n - 1) * gap)

describe('the published thresholds', () => {
  it('are a 1 500 SPM ceiling and a 25 ms median interval', () => {
    // Changing either changes the Formulas page and ADR 0003; this test is the reminder.
    expect(MAX_HUMAN_SPM).toBe(1500)
    expect(MIN_HUMAN_MEDIAN_IKI_MS).toBe(25)
  })
})

describe('charIntervals', () => {
  it('measures from one character keystroke to the next, skipping the delay before the first', () => {
    expect(charIntervals(buildLog([ok('a', 900), ok('b', 120), ok('c', 140)]))).toEqual([120, 140])
  })

  it('folds the time of Backspaces and ignored events into the next interval', () => {
    // A held Shift repeats its keydown every ~30 ms and a held Backspace repeats too; neither is a
    // character keystroke, so neither may shorten the interval between two letters.
    const log = buildLog([
      ok('a', 500),
      ignored(30),
      ignored(30),
      ignored(30),
      ok('B', 20),
      back(30),
      back(30),
      ok('c', 90),
    ])
    expect(charIntervals(log)).toEqual([110, 150])
  })

  it('is empty for a log with one character keystroke or none', () => {
    expect(charIntervals(buildLog([ok('a', 100)]))).toEqual([])
    expect(charIntervals(buildLog([]))).toEqual([])
  })
})

describe('implausibilityOf', () => {
  it('passes a learner typing at an ordinary pace', () => {
    const events = typed(60, 180)
    expect(implausibilityOf(buildLog(events), spmOf(60, 180))).toBeUndefined()
  })

  it('passes a world-class sprint: 60 keys 45 ms apart is about 1 360 SPM', () => {
    // Above the 1 060 SPM record of Barbara Blackburn and the 800+ top rank of Klavogonki: being
    // generous is the point, since a false accusation costs more than an inflated number.
    const spm = spmOf(60, 45)
    expect(spm).toBeGreaterThan(1300)
    expect(implausibilityOf(buildLog(typed(60, 45)), spm)).toBeUndefined()
  })

  it('passes a fast learner whose few rollover intervals are near zero', () => {
    // Every third key overlaps the one before (5 ms); the median interval is still a hand's.
    const events = Array.from({ length: 60 }, (_, i) =>
      ok('a', i === 0 ? 400 : i % 3 === 0 ? 5 : 90),
    )
    expect(implausibilityOf(buildLog(events), 600)).toBeUndefined()
  })

  it('passes a word that an input method committed at one instant', () => {
    // An IME commits a composition as several characters at one timestamp; one such word in a line
    // of ordinary typing must not read as a script.
    const events = [...typed(40, 200), ...Array.from({ length: 6 }, () => ok('a', 0))]
    expect(implausibilityOf(buildLog(events), 300)).toBeUndefined()
  })

  it('flags a whole line that arrived at one instant as a burst', () => {
    // One insertion of 59 characters: every interval is 0 and the elapsed time is next to nothing.
    const events = Array.from({ length: 59 }, (_, i) => ok('a', i === 0 ? 400 : 0))
    expect(implausibilityOf(buildLog(events), 0)).toBe('burst')
  })

  it('flags a burst hidden behind pauses, whose overall speed looks human', () => {
    // Each word arrives whole, then a long pause: 300 SPM overall, but no hand typed it.
    const words = Array.from({ length: 10 }, () => [
      ok('a', 1200),
      ...Array.from({ length: 5 }, () => ok('a', 1)),
    ])
    expect(implausibilityOf(buildLog(words.flat()), 300)).toBe('burst')
  })

  it('flags a script typing 14 ms a key, the pace of an automation tool', () => {
    expect(implausibilityOf(buildLog(typed(73, 14)), spmOf(73, 14))).toBe('burst')
  })

  it('flags a steady pace above the ceiling as too fast', () => {
    // 30 ms a key is a median above the floor but about 2 000 SPM overall.
    const spm = spmOf(60, 30)
    expect(spm).toBeGreaterThan(MAX_HUMAN_SPM)
    expect(implausibilityOf(buildLog(typed(60, 30)), spm)).toBe('tooFast')
  })

  it('takes the ceiling as inclusive: exactly 1 500 SPM still counts', () => {
    expect(implausibilityOf(buildLog(typed(60, 60)), MAX_HUMAN_SPM)).toBeUndefined()
    expect(implausibilityOf(buildLog(typed(60, 60)), MAX_HUMAN_SPM + 0.01)).toBe('tooFast')
  })

  it('cannot judge a single keystroke by its intervals', () => {
    expect(implausibilityOf(buildLog([ok('a', 100)]), 0)).toBeUndefined()
  })
})
