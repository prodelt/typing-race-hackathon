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
 * Apostrophe lookalikes the engine folds onto U+0027 before judging a keystroke (FR-007). Kept in
 * step with `foldApostrophe` in the engine; this package may not import it (it runs in Edge
 * Functions), and the only use here is choosing between two replays, never a verdict.
 */
const APOSTROPHES = new Set(['’', 'ʼ', '‘', '´'])

function fold(char: string): string {
  return APOSTROPHES.has(char) ? "'" : char
}

type Replay = 'stopOnLetter' | 'freeBackspace'

/**
 * Replays the log the way the engine moved its cursor, which differs by error mode:
 *
 * - `stopOnLetter`: a wrong keystroke never enters the text, so the cursor stays and the mark
 *   appears; the first Backspace after it only clears the mark, and any other Backspace steps back.
 * - `freeBackspace`: a wrong keystroke occupies its position and the cursor moves on; Backspace
 *   always steps back, and never behind the start.
 *
 * `mismatches` counts keystrokes whose `correct` flag disagrees with a fresh judgement against the
 * awaited character: the log's own evidence of which mode produced it.
 */
function replay(
  log: KeystrokeEventLog,
  awaitedText: readonly string[],
  mode: Replay,
): { readonly keystrokes: CharKeystroke[]; readonly mismatches: number } {
  const keystrokes: CharKeystroke[] = []
  let mismatches = 0
  let cursor = 0
  let marked = false
  let previousWasCorrectChar = false

  for (const [index, kind] of log.kind.entries()) {
    if (kind === 'backspace') {
      previousWasCorrectChar = false
      if (mode === 'stopOnLetter' && marked) marked = false
      else cursor = Math.max(0, cursor - 1)
      continue
    }
    const typed = log.char[index]
    if (kind !== 'char' || typed === undefined || typed === null) {
      previousWasCorrectChar = false
      continue
    }
    const correct = log.correct[index] ?? false
    const awaited = awaitedText[cursor]
    if ((awaited !== undefined && fold(typed) === fold(awaited)) !== correct) mismatches += 1
    keystrokes.push({
      index,
      awaited,
      previous: cursor > 0 ? awaitedText[cursor - 1] : undefined,
      typed,
      correct,
      dt: log.dt[index] ?? 0,
      followsCorrectChar: previousWasCorrectChar,
    })
    if (correct) {
      cursor += 1
      marked = false
    } else if (mode === 'stopOnLetter') {
      marked = true
    } else if (awaited !== undefined) {
      cursor += 1
    }
    previousWasCorrectChar = correct
  }
  return { keystrokes, mismatches }
}

/**
 * Replays a log against its text and lists the character keystrokes.
 *
 * What is awaited is where the engine's cursor stood. The log does not say which error mode made
 * it, so both are replayed and the one whose judgements reproduce the log's `correct` flags wins;
 * a tie (no wrong keystroke and no Backspace, or a log that fits neither) reads as the default,
 * `stopOnLetter`. The two modes only differ after a wrong keystroke or a Backspace, so a clean
 * attempt reads the same either way. The one thing the log cannot tell apart: a free-backspace run
 * whose wrong keystrokes are never followed by a correct one, which reads as `stopOnLetter`.
 *
 * A log with arrays of unequal length is read as far as it is consistent: a missing `dt` is `0`, a
 * missing `correct` is `false`, and a character keystroke with no character is skipped. Metrics are
 * recomputed server-side from client input (ADR-0007), so they must not throw on a hostile log.
 */
export function charKeystrokes(log: KeystrokeEventLog, text: string): readonly CharKeystroke[] {
  const awaitedText = Array.from(text)
  const stop = replay(log, awaitedText, 'stopOnLetter')
  const free = replay(log, awaitedText, 'freeBackspace')
  return free.mismatches < stop.mismatches ? free.keystrokes : stop.keystrokes
}
