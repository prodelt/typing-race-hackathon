import type { ErrorMode } from '@typing-race/domain'
import type { AttemptState, EngineView } from './types'

const STRAIGHT_APOSTROPHE = "'"

/**
 * Every apostrophe a keyboard can produce, folded onto the stored U+0027 (FR-007).
 *
 * U+2019 is the display form. **U+02BC is what macOS produces** on a Ukrainian layout, and
 * U+2018 arrives from text pasted out of a word processor. A learner typing the apostrophe
 * correctly on a Mac must not be told they are wrong, and the three lookalikes are visually
 * indistinguishable in the typing line, so judging them apart would be judging something the
 * learner cannot see.
 *
 * Nothing else is folded: `і`, `ї`, `є`, `ґ` are judged as themselves and never substituted (FR-006).
 */
const APOSTROPHES = new Set(['’', 'ʼ', '‘', '´'])

export function foldApostrophe(char: string): string {
  return APOSTROPHES.has(char) ? STRAIGHT_APOSTROPHE : char
}

export function judge(typed: string, awaited: string): boolean {
  return foldApostrophe(typed) === foldApostrophe(awaited)
}

/** The machine's own state: the view minus the clock, which the engine owns. */
export interface MachineState {
  readonly phase: AttemptState
  readonly cursor: number
  readonly markedAt: number | null
  readonly errorCount: number
  readonly lastError: EngineView['lastError']
  /**
   * `freeBackspace` only: ascending positions that hold a wrong character the learner has not yet
   * erased. Always empty under `stopOnLetter`, where a wrong keystroke is never placed in the text.
   */
  readonly wrong: readonly number[]
}

export const initialState: MachineState = {
  phase: 'idle',
  cursor: 0,
  markedAt: null,
  errorCount: 0,
  lastError: null,
  wrong: [],
}

// Lifecycle: idle -> running -> (paused <-> running) -> completed (by the last character, or by
// stop() when a time-boxed run's time is up), and any live phase -> abandoned.
// Each returns the same object when the transition does not apply, so callers can detect a no-op
// by identity and stay silent instead of repainting.

export function begin(state: MachineState): MachineState {
  return state.phase === 'idle' ? { ...state, phase: 'running' } : state
}

export function pause(state: MachineState): MachineState {
  return state.phase === 'running' ? { ...state, phase: 'paused' } : state
}

export function resume(state: MachineState): MachineState {
  return state.phase === 'paused' ? { ...state, phase: 'running' } : state
}

/** A time-boxed run's whistle: a live run ends where it stands, with whatever it has typed. */
export function stop(state: MachineState): MachineState {
  const live = state.phase === 'running' || state.phase === 'paused'
  return live ? { ...state, phase: 'completed' } : state
}

export function abandon(state: MachineState): MachineState {
  const live = state.phase === 'idle' || state.phase === 'running' || state.phase === 'paused'
  return live ? { ...state, phase: 'abandoned' } : state
}

export type CharOutcome =
  | {
      readonly kind: 'judged'
      readonly state: MachineState
      readonly correct: boolean
    }
  /** Nothing is awaited: `freeBackspace` at the end of the text with a wrong character left in it. */
  | { readonly kind: 'overflow' }

/**
 * Judges one character keystroke against the awaited character (FR-015).
 *
 * A wrong keystroke never becomes the correct character (FR-016): under `stopOnLetter` the cursor
 * holds and the mark appears in place (FR-017); under `freeBackspace` the wrong character occupies
 * its position and must be erased. Either way `errorCount` rises and only rises (FR-024).
 */
export function applyChar(
  state: MachineState,
  chars: readonly string[],
  mode: ErrorMode,
  typed: string,
): CharOutcome {
  const awaited = chars[state.cursor]
  if (awaited === undefined) return { kind: 'overflow' }

  if (judge(typed, awaited)) {
    const cursor = state.cursor + 1
    const done = cursor === chars.length && state.wrong.length === 0
    const markedAt = mode === 'stopOnLetter' ? null : (state.wrong[0] ?? null)
    return {
      kind: 'judged',
      correct: true,
      state: {
        ...state,
        cursor,
        markedAt,
        phase: done ? 'completed' : state.phase,
      },
    }
  }

  const errorCount = state.errorCount + 1
  const lastError = { expected: awaited, got: typed, at: state.cursor }
  if (mode === 'stopOnLetter') {
    return {
      kind: 'judged',
      correct: false,
      state: { ...state, errorCount, lastError, markedAt: state.cursor },
    }
  }
  const wrong = [...state.wrong, state.cursor]
  return {
    kind: 'judged',
    correct: false,
    state: {
      ...state,
      errorCount,
      lastError,
      wrong,
      cursor: state.cursor + 1,
      // The earliest unresolved wrong character, which is where the text first went off.
      markedAt: state.wrong[0] ?? state.cursor,
    },
  }
}

/**
 * Backspace clears the mark, may move the cursor back, never walks behind index 0 and never lowers
 * `errorCount` — the requirements' §8.2 check (FR-024). Under `stopOnLetter` the first Backspace
 * only clears the mark: the wrong keystroke was never placed in the text, so there is nothing to
 * erase.
 */
export function applyBackspace(state: MachineState, mode: ErrorMode): MachineState {
  if (mode === 'stopOnLetter') {
    if (state.markedAt !== null) return { ...state, markedAt: null }
    return { ...state, cursor: Math.max(0, state.cursor - 1) }
  }
  if (state.cursor === 0) return state
  const cursor = state.cursor - 1
  const wrong = state.wrong.filter((position) => position !== cursor)
  return { ...state, cursor, wrong, markedAt: wrong[0] ?? null }
}
