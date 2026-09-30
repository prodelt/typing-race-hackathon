import type { KeystrokeEventLog, KeystrokeKind } from '@typing-race/domain'

/** Bumped only when the parallel-array shape changes, so stored logs stay readable (FR-019). */
export const LOG_FORMAT_VERSION = 1

export interface LogBuilder {
  append(dt: number, kind: KeystrokeKind, char: string | null, correct: boolean): void
  /** A copy: a log handed out can never be mutated by a later keystroke. */
  snapshot(): KeystrokeEventLog
}

/**
 * Append-only by construction: there is no method that removes or rewrites an entry. Every metric
 * is derived from this log after the fact, never accumulated while typing (FR-019).
 */
export function createLogBuilder(): LogBuilder {
  const dt: number[] = []
  const kind: KeystrokeKind[] = []
  const char: (string | null)[] = []
  const correct: boolean[] = []

  return {
    append(d, k, c, ok) {
      dt.push(d)
      kind.push(k)
      char.push(c)
      correct.push(ok)
    },
    snapshot() {
      return {
        formatVersion: LOG_FORMAT_VERSION,
        dt: [...dt],
        kind: [...kind],
        char: [...char],
        correct: [...correct],
      }
    },
  }
}
