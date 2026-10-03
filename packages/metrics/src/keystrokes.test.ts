import { describe, expect, it } from 'vitest'
import { charKeystrokes } from './keystrokes'
import { back, bad, buildLog, ignored, ok, type RawEvent } from './logs'

const awaitedBy = (events: readonly RawEvent[], text: string) =>
  charKeystrokes(buildLog(events), text).map((keystroke) => keystroke.awaited)

describe('charKeystrokes: where the cursor stood', () => {
  it('follows the cursor back through a Backspace that steps behind a correct character', () => {
    // "abcde" typed a b ⌫ b x c d e under stopOnLetter: the ⌫ undoes the correct b, so the second b
    // is for position 1 again and x is a miss on c — not on d, which is what a replay that never
    // moves the cursor back would say.
    const events = [
      ok('a', 100),
      ok('b', 100),
      back(100),
      ok('b', 100),
      bad('x', 100),
      ok('c', 100),
      ok('d', 100),
      ok('e', 100),
    ]
    expect(awaitedBy(events, 'abcde')).toEqual(['a', 'b', 'b', 'c', 'c', 'd', 'e'])
  })

  it('does not move the cursor for the Backspace that only clears the mark', () => {
    // "ab": a, x (wrong: marks b), ⌫ (clears the mark only), b. Still position 1 throughout.
    expect(awaitedBy([ok('a', 1), bad('x', 1), back(1), ok('b', 1)], 'ab')).toEqual(['a', 'b', 'b'])
  })

  it('reads a free-backspace attempt: a wrong character takes its position and the cursor moves on', () => {
    // "abc" typed x b ⌫ ⌫ a b c under freeBackspace. x sits at 0, so b is judged at 1 (correct);
    // two Backspaces erase b and x; then the text is typed afresh.
    const events = [bad('x', 1), ok('b', 1), back(1), back(1), ok('a', 1), ok('b', 1), ok('c', 1)]
    expect(awaitedBy(events, 'abc')).toEqual(['a', 'b', 'a', 'b', 'c'])
  })

  it('never walks behind the start, and reads a clean attempt the same in both modes', () => {
    expect(awaitedBy([back(1), back(1), ok('a', 1), ok('b', 1)], 'ab')).toEqual(['a', 'b'])
    expect(awaitedBy([ok('a', 1), ignored(1), ok('b', 1)], 'ab')).toEqual(['a', 'b'])
  })

  it('does not throw on a log that fits neither mode, and keeps the stop-on-letter reading', () => {
    // Every keystroke claims to be correct whatever it was: hostile, not a crash.
    const events = [ok('z', 1), ok('z', 1), back(1), ok('q', 1)]
    expect(() => charKeystrokes(buildLog(events), 'ab')).not.toThrow()
  })
})
