import type { KeystrokeEventLog } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { ACCURACY_FLOOR, replay, scoreOf } from '../supabase/functions/_shared/race-replay.ts'

/**
 * The server judges a race log itself (finish-race) and never reads the client's `correct` flags.
 * It has to move its cursor the way the client's engine does, or an honest racer who corrects
 * themselves is rejected as "a different race".
 */

type Key = string | 'BS'

/** A log of `keys` 60 ms apart; the `correct` flags are all `true`, as a forger would claim. */
function logOf(keys: readonly Key[]): KeystrokeEventLog {
  return {
    formatVersion: 1,
    dt: keys.map(() => 60),
    kind: keys.map((key) => (key === 'BS' ? 'backspace' : 'char')),
    char: keys.map((key) => (key === 'BS' ? null : key)),
    correct: keys.map(() => true),
  }
}

describe('the race replay', () => {
  it('reaches the end of the text for a clean run', () => {
    expect(replay(logOf([...'hello']), 'hello').reached).toBe(5)
  })

  it('follows a Backspace that steps back behind a correct character', () => {
    // h e ⌫ e l l o: the Backspace undoes the e, which is typed again.
    const { reached, log } = replay(logOf(['h', 'e', 'BS', 'e', 'l', 'l', 'o']), 'hello')
    expect(reached).toBe(5)
    // The e typed twice counts twice: both were right.
    expect(log.correct.filter((flag) => flag)).toHaveLength(6)
  })

  it('lets the first Backspace after a wrong key clear only the mark', () => {
    // h x ⌫ e l l o: x is wrong, the Backspace clears the mark, nothing else moves.
    const { reached, log } = replay(logOf(['h', 'x', 'BS', 'e', 'l', 'l', 'o']), 'hello')
    expect(reached).toBe(5)
    expect(log.correct).toEqual([true, false, false, true, true, true, true])
  })

  it('never walks behind the start', () => {
    expect(replay(logOf(['BS', 'BS', ...'hi']), 'hi').reached).toBe(2)
  })

  it('judges from the text, not from the flags the client sent', () => {
    const { reached, log } = replay(logOf([...'hxllo']), 'hello')
    expect(log.correct.filter((flag) => flag)).toHaveLength(1)
    expect(reached).toBe(1)
  })

  it('ignores keys typed after the text is finished', () => {
    const { log } = replay(logOf([...'hiya']), 'hi')
    expect(log.char.join('')).toBe('hi')
  })

  it('treats the typographic apostrophes as the straight one', () => {
    expect(replay(logOf(['d', 'o', 'n', '’', 't']), "don't").reached).toBe(5)
  })
})

describe('the race score', () => {
  it('is zero below the accuracy floor, whatever the speed', () => {
    expect(scoreOf(900, ACCURACY_FLOOR - 0.01)).toBe(0)
  })

  it('rewards a clean run over a fast dirty one', () => {
    expect(scoreOf(300, 0.99)).toBeGreaterThan(scoreOf(330, 0.91))
  })
})
