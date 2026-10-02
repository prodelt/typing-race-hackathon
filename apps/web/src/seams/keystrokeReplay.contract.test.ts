import type { ErrorMode, InputEvent } from '@typing-race/domain'
import { createEngine, manualClock, scriptedInput } from '@typing-race/engine'
import { computeAggregates } from '@typing-race/metrics'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

/**
 * The metrics replay a stored log against its text without knowing the error mode or watching the
 * cursor. This pins it to the engine that made the log: for any run of keys, Backspaces and
 * ignored events, the character each keystroke was judged against is the one the
 * replay blames. Errors attributed to the wrong key would skew confidence and every weak-spot list.
 *
 * The text has no repeated character: with one, two readings of the log can be indistinguishable.
 */

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'и', 'і', 'ї', 'є']
const STRAYS = ['x', 'z', 'q', 'w']

// Only the default mode. A free-backspace log whose wrong keys are never followed by a correct one
// reads the same under both modes (the log does not say which was on), so there is no truth to pin
// there; `keystrokes.test.ts` holds the worked free-backspace example.
const modeArb = fc.constantFrom<ErrorMode>('stopOnLetter')
const textArb = fc
  .shuffledSubarray(LETTERS, { minLength: 3, maxLength: LETTERS.length })
  .map((letters) => letters.join(''))
const keyArb = fc.oneof(
  fc.constantFrom(...LETTERS, ...STRAYS).map((c): InputEvent => ({ kind: 'char', char: c, at: 0 })),
  fc.constant<InputEvent>({ kind: 'backspace', at: 0 }),
  fc.constant<InputEvent>({ kind: 'ignored', reason: 'modifier', at: 0 }),
)

describe('the metrics replay agrees with the engine', () => {
  it('blames every keystroke on the character the engine judged it against', () => {
    fc.assert(
      fc.property(textArb, modeArb, fc.array(keyArb, { maxLength: 60 }), (text, mode, keys) => {
        const clock = manualClock()
        const input = scriptedInput([])
        const engine = createEngine({
          text,
          errorMode: mode,
          input,
          clock,
          layout: { id: 'qwerty', language: 'en', keys: [], homeAnchors: [], unlockOrder: [] },
        })
        const chars = Array.from(text)
        const expected: (string | undefined)[] = []
        let at = 0
        let handled = 0
        engine.onChange(() => {
          handled += 1
        })
        const emit = (event: InputEvent): void => {
          const cursor = engine.view.cursor
          const before = handled
          at += 7
          input.emit({ ...event, at })
          if (handled !== before && event.kind === 'char' && event.char !== '') {
            expected.push(chars[cursor])
          }
        }
        for (const key of keys) emit(key)
        // Finish the attempt the way a learner would: erase what is wrong, type what is awaited.
        while (engine.view.state === 'running' || engine.view.state === 'idle') {
          const { cursor, markedAt, wrong } = engine.view
          const awaited = chars[cursor]
          const mustErase = markedAt !== null ? markedAt !== cursor : wrong.length > 0
          if (mustErase || awaited === undefined) emit({ kind: 'backspace', at: 0 })
          else emit({ kind: 'char', char: awaited, at: 0 })
        }
        const log = engine.finish()
        const replayed = computeAggregates({
          log,
          text,
          layout: { id: 'qwerty', language: 'en', keys: [], homeAnchors: [], unlockOrder: [] },
        })
        // Misses by key must be exactly the wrong keystrokes the engine saw, on the keys it awaited.
        const misses: Record<string, number> = {}
        let cursorOfLog = 0
        for (const [index, kind] of log.kind.entries()) {
          if (kind !== 'char' || log.char[index] == null) continue
          if (log.correct[index] !== true) {
            const awaitedKey = expected[cursorOfLog]
            if (awaitedKey !== undefined) misses[awaitedKey] = (misses[awaitedKey] ?? 0) + 1
          }
          cursorOfLog += 1
        }
        expect(cursorOfLog).toBe(expected.length)
        const replayedMisses = Object.fromEntries(
          Object.entries(replayed.keys)
            .filter(([, entry]) => entry.misses > 0)
            .map(([key, entry]) => [key, entry.misses]),
        )
        expect(replayedMisses).toEqual(misses)
      }),
      { numRuns: 300 },
    )
  })
})
