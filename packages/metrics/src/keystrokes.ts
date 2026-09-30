import type { KeystrokeEventLog } from '@typing-race/domain'

/**
 * One character keystroke, with the context every metric needs. Extracted once so that accuracy,
 * rhythm and the aggregates cannot disagree about what a log means.
 */
export interface CharKeystroke {
  /** Position of the event in the log, so `0` is the keystroke with no predecessor. */
  readonly index: number
  /** The character the text awaited here, or `undefined` once the learner has typed past the end. */
  readonly awaited: string | undefined
  /** The awaited character one step earlier, `undefined` at the start of the text. */
  readonly previous: string | undefined
  readonly typed: string
  readonly correct: boolean
  /** Milliseconds since the previous event of any kind. */
  readonly dt: number
  /** The event just before this one was itself a correct character keystroke. */
  readonly followsCorrectChar: boolean
}

/**
 * Replays a log against its text and lists the character keystrokes.
 *
 * What is awaited is the count of correct keystrokes so far: a wrong keystroke never advances the
 * text, and a Backspace neither advances nor retreats it. That holds for the engine's Stage 1
 * stop-on-letter mode and, because the engine marks `correct` against the awaited character, also
 * for free correction — the next correct keystroke is for the same position either way.
 *
 * A log with arrays of unequal length is read as far as it is consistent: a missing `dt` is `0`, a
 * missing `correct` is `false`, and a character keystroke with no character is skipped. Metrics are
 * recomputed server-side from client input (ADR-0007), so they must not throw on a hostile log.
 */
export function charKeystrokes(log: KeystrokeEventLog, text: string): readonly CharKeystroke[] {
  const awaitedText = Array.from(text)
  const result: CharKeystroke[] = []
  let cursor = 0
  let previousWasCorrectChar = false

  for (const [index, kind] of log.kind.entries()) {
    const typed = log.char[index]
    if (kind !== 'char' || typed === undefined || typed === null) {
      previousWasCorrectChar = false
      continue
    }
    const correct = log.correct[index] ?? false
    result.push({
      index,
      awaited: awaitedText[cursor],
      previous: cursor > 0 ? awaitedText[cursor - 1] : undefined,
      typed,
      correct,
      dt: log.dt[index] ?? 0,
      followsCorrectChar: previousWasCorrectChar,
    })
    if (correct) cursor += 1
    previousWasCorrectChar = correct
  }
  return result
}
