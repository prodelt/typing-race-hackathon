
/**
 * A keystroke log as `finish-race` reads it. Structurally the `KeystrokeEventLog` of
 * `@typing-race/domain`, written out here so this file imports nothing and a unit test (which has
 * no Deno import map) can load it.
 */
export interface RaceLog {
  readonly formatVersion: number
  readonly dt: readonly number[]
  readonly kind: readonly ('char' | 'backspace' | 'ignored')[]
  readonly char: readonly (string | null)[]
  readonly correct: readonly boolean[]
}

/**
 * The server's own judgement of a race log, kept apart from `finish-race/index.ts` (which starts a
 * server on import) so a plain unit test can drive it.
 */

/** Speed weighted by accuracy, with a floor: fast and dirty must not beat clean. */
export const ACCURACY_FLOOR = 0.9

const APOSTROPHES = new Set(['’', 'ʼ', '‘', '´'])
const fold = (char: string): string => (APOSTROPHES.has(char) ? "'" : char)

export function scoreOf(spm: number, accuracy: number): number {
  if (accuracy < ACCURACY_FLOOR) return 0
  // Squared, so the gap between 92% and 99% matters more than a linear weight would make it.
  return Math.round(spm * accuracy * accuracy * 100) / 100
}

/**
 * Re-judges every character keystroke against the text under the race's error mode, moving the
 * cursor exactly as the client's engine does in `stopOnLetter`: a wrong key holds the cursor and
 * marks it; the first Backspace after that only clears the mark; any other Backspace steps back one
 * character. A replay that ignored the Backspace that steps back would read every later key of a
 * learner who corrected themselves as wrong, and reject an honest race.
 *
 * Returns the log with the server's own `correct` flags and how far into the text it got. What the
 * client claimed about correctness is never read.
 */
export function replay(log: RaceLog, text: string): { log: RaceLog; reached: number } {
  const awaited = Array.from(text)
  const length = Math.min(log.kind.length, log.dt.length, log.char.length)
  const dt: number[] = []
  const kind: RaceLog['kind'][number][] = []
  const char: (string | null)[] = []
  const correct: boolean[] = []
  let cursor = 0
  let marked = false

  for (let i = 0; i < length; i++) {
    const k = log.kind[i]
    const delta = Number(log.dt[i])
    if (!Number.isFinite(delta) || delta < 0) continue
    if (k === 'char') {
      const typed = log.char[i]
      if (typeof typed !== 'string' || typed.length === 0 || cursor >= awaited.length) continue
      const right = fold(typed) === fold(awaited[cursor] ?? '')
      dt.push(delta)
      kind.push('char')
      char.push(fold(typed))
      correct.push(right)
      if (right) {
        cursor += 1
        marked = false
      } else {
        marked = true
      }
    } else if (k === 'backspace') {
      dt.push(delta)
      kind.push(k)
      char.push(null)
      correct.push(false)
      if (marked) marked = false
      else cursor = Math.max(0, cursor - 1)
    } else if (k === 'ignored') {
      dt.push(delta)
      kind.push(k)
      char.push(null)
      correct.push(false)
    }
  }

  return {
    log: { formatVersion: log.formatVersion, dt, kind, char, correct },
    reached: cursor,
  }
}
