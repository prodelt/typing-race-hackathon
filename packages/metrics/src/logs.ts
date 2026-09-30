import type { KeystrokeEventLog, KeystrokeKind, Layout } from '@typing-race/domain'

/**
 * Test-only builders. They live beside the tests rather than in a shared package because nothing
 * outside this package builds logs by hand; the engine records real ones.
 */
export interface RawEvent {
  readonly kind: KeystrokeKind
  readonly char: string | null
  readonly correct: boolean
  readonly dt: number
}

/** A correct character keystroke, `dt` ms after the previous event. */
export const ok = (char: string, dt: number): RawEvent => ({
  kind: 'char',
  char,
  correct: true,
  dt,
})
/** A wrong character keystroke. */
export const bad = (char: string, dt: number): RawEvent => ({
  kind: 'char',
  char,
  correct: false,
  dt,
})
export const back = (dt: number): RawEvent => ({
  kind: 'backspace',
  char: null,
  correct: false,
  dt,
})
export const ignored = (dt: number): RawEvent => ({
  kind: 'ignored',
  char: null,
  correct: false,
  dt,
})

export function buildLog(events: readonly RawEvent[]): KeystrokeEventLog {
  return {
    formatVersion: 1,
    dt: events.map((event) => event.dt),
    kind: events.map((event) => event.kind),
    char: events.map((event) => event.char),
    correct: events.map((event) => event.correct),
  }
}

/** The metrics package never reads a layout today, so an empty one is honest. */
export const EMPTY_LAYOUT: Layout = {
  id: 'qwerty',
  language: 'en',
  keys: [],
  homeAnchors: [],
  unlockOrder: [],
}
