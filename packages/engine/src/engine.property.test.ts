import type { ErrorMode, InputEvent } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { EngineView } from './index'
import { backspace, char, completeFrom, ignored, setup, typeText } from './support'

const ALPHABET = ['a', 'b', 'c', 'и', 'і', 'ї', 'є', 'ґ', "'", '’', ' ']
const STRAYS = ['x', 'z', 'i', 'ï', 'e', 'г', '`']

const modeArb = fc.constantFrom<ErrorMode>('stopOnLetter', 'freeBackspace')
const textArb = fc
  .array(fc.constantFrom(...ALPHABET), { minLength: 1, maxLength: 25 })
  .map((a) => a.join(''))
const eventOf = (maxChars: number): fc.Arbitrary<InputEvent> =>
  fc.oneof(
    fc
      .array(fc.constantFrom(...ALPHABET, ...STRAYS), { maxLength: maxChars })
      .map((cs) => char(cs.join(''), 0)),
    fc.constant(backspace(0)),
    fc.constant(ignored(0)),
  )
/** Gives each event a strictly increasing timestamp so the log's deltas are meaningful. */
const withTimes = (events: InputEvent[]): InputEvent[] =>
  events.map((e, i) => ({ ...e, at: (i + 1) * 7 }))
const eventsArb = fc.array(eventOf(4), { maxLength: 80 }).map(withTimes)
const singleKeyEventsArb = fc.array(eventOf(1), { maxLength: 80 }).map(withTimes)

function drive(text: string, mode: ErrorMode, events: InputEvent[]) {
  const t = setup(text, mode)
  for (const e of events) t.input.emit(e)
  return t
}

describe('engine properties', () => {
  it('errorCount never decreases and the cursor stays within the text', () => {
    fc.assert(
      fc.property(textArb, modeArb, eventsArb, (text, mode, events) => {
        const { views } = drive(text, mode, events)
        const length = Array.from(text).length
        let previous = 0
        for (const view of views) {
          expect(view.errorCount).toBeGreaterThanOrEqual(previous)
          expect(view.cursor).toBeGreaterThanOrEqual(0)
          expect(view.cursor).toBeLessThanOrEqual(length)
          previous = view.errorCount
        }
      }),
    )
  })

  it('under stopOnLetter the mark always sits on the awaited character', () => {
    fc.assert(
      fc.property(textArb, eventsArb, (text, events) => {
        for (const view of drive(text, 'stopOnLetter', events).views) {
          if (view.markedAt !== null) expect(view.markedAt).toBe(view.cursor)
        }
      }),
    )
  })

  it('under stopOnLetter the cursor never advances past a mark a keystroke leaves set', () => {
    fc.assert(
      fc.property(textArb, singleKeyEventsArb, (text, events) => {
        const { views } = drive(text, 'stopOnLetter', events)
        let previous: EngineView | undefined
        for (const view of views) {
          if (view.markedAt !== null && previous?.markedAt != null) {
            expect(view.cursor).toBe(previous.cursor)
          }
          previous = view
        }
      }),
    )
  })

  it('typing the text exactly completes it with no errors, in either mode', () => {
    fc.assert(
      fc.property(textArb, modeArb, (text, mode) => {
        const { engine } = drive(text, mode, typeText(text))
        expect(engine.view.state).toBe('completed')
        expect(engine.view.errorCount).toBe(0)
        expect(engine.finish().correct.every(Boolean)).toBe(true)
      }),
    )
  })

  it('inserting ignored events into a correct run changes only the log length', () => {
    fc.assert(
      fc.property(
        textArb,
        modeArb,
        fc.array(fc.nat({ max: 3 }), { minLength: 30, maxLength: 30 }),
        (text, mode, gaps) => {
          const plain = drive(text, mode, typeText(text))
          const events: InputEvent[] = []
          let at = 0
          const tick = (): number => {
            at += 1
            return at
          }
          for (const [i, c] of Array.from(text).entries()) {
            // The first character must come first: ignored events before it start nothing.
            for (let k = 0; i > 0 && k < (gaps[i] ?? 0); k++) events.push(ignored(tick()))
            events.push(char(c, tick()))
          }
          const noisy = drive(text, mode, events)
          expect(noisy.engine.view).toEqual(plain.engine.view)
          expect(noisy.engine.finish().kind.length).toBe(events.length)
          expect(noisy.engine.finish().kind.filter((k) => k === 'char')).toHaveLength(
            Array.from(text).length,
          )
        },
      ),
    )
  })

  it('replaying a finished attempt reproduces its errorCount and final cursor', () => {
    fc.assert(
      fc.property(textArb, modeArb, eventsArb, (text, mode, events) => {
        const first = setup(text, mode)
        for (const e of events) first.input.emit(e)
        completeFrom(first.engine, (e) => first.input.emit(e), text, events.length * 7 + 7)
        const log = first.engine.finish()

        // What F2's server does: rebuild events from the stored parallel arrays and judge again.
        const replayEvents: InputEvent[] = []
        let at = 0
        for (const [i, kind] of log.kind.entries()) {
          at += log.dt[i] ?? 0
          const c = log.char[i]
          if (kind === 'char' && typeof c === 'string') replayEvents.push(char(c, at))
          else if (kind === 'backspace') replayEvents.push(backspace(at))
          else replayEvents.push(ignored(at))
        }
        const second = drive(text, mode, replayEvents)
        expect(second.engine.view.errorCount).toBe(first.engine.view.errorCount)
        expect(second.engine.view.cursor).toBe(first.engine.view.cursor)
        expect(second.engine.finish()).toEqual(log)
      }),
    )
  })

  it('Backspace never lowers errorCount and never passes index 0', () => {
    fc.assert(
      fc.property(textArb, modeArb, fc.nat({ max: 10 }), (text, mode, presses) => {
        const t = setup(text, mode)
        t.input.emit(char('x', 1))
        const raised = t.engine.view.errorCount
        for (let i = 0; i < presses; i++) t.input.emit(backspace(2 + i))
        expect(t.engine.view.errorCount).toBe(raised)
        expect(t.engine.view.cursor).toBeGreaterThanOrEqual(0)
      }),
    )
  })

  it('Ukrainian і ї є ґ are judged as themselves and lookalikes are wrong', () => {
    const lookalike: Record<string, string> = { і: 'i', ї: 'ï', є: 'e', ґ: 'г' }
    fc.assert(
      fc.property(fc.constantFrom('і', 'ї', 'є', 'ґ'), modeArb, (c, mode) => {
        const right = drive(c, mode, [char(c, 1)])
        expect(right.engine.view).toMatchObject({ state: 'completed', errorCount: 0 })
        const wrong = drive(c, mode, [char(lookalike[c] ?? '', 1)])
        expect(wrong.engine.view.errorCount).toBe(1)
        expect(wrong.engine.view.state).toBe('running')
      }),
    )
  })

  it('the apostrophe folds both ways for any mix of the two forms', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("'", '’'), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom("'", '’'), { minLength: 10, maxLength: 10 }),
        modeArb,
        (textParts, typedParts, mode) => {
          const text = textParts.join('')
          const typed = typedParts.slice(0, textParts.length).join('')
          const { engine } = drive(text, mode, typeText(typed))
          expect(engine.view).toMatchObject({ state: 'completed', errorCount: 0 })
          expect(engine.finish().char.every((c) => c === "'")).toBe(true)
        },
      ),
    )
  })
})
