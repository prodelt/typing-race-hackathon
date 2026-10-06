import type {
  Clock,
  ErrorMode,
  InputEvent,
  InputSource,
  KeystrokeEventLog,
  Layout,
} from '@typing-race/domain'
import { createStopwatch } from './clock-accounting'
import { createLogBuilder } from './log'
import {
  abandon as abandonState,
  applyBackspace,
  applyChar,
  begin,
  foldApostrophe,
  initialState,
  type MachineState,
  pause as pauseState,
  resume as resumeState,
  stop as stopState,
} from './machine'
import type { EngineView } from './types'

export {
  type ManualClock,
  manualClock,
  type ScriptedInput,
  scriptedInput,
} from './testing'
export type { AttemptState, EngineView } from './types'

export interface Engine {
  readonly view: EngineView
  /** Fires once per processed event. The typing line is the only subscriber that repaints (FR-069). */
  onChange(listener: (view: EngineView) => void): () => void
  start(): void
  pause(): void
  resume(): void
  abandon(): void
  /**
   * Ends a running or paused attempt where it stands, as `completed`: the whistle of a time-boxed
   * run (Sprint 60 s), whose line is longer than anyone types in the time. `finish()` then returns
   * the log so far. Does nothing to an idle or finished attempt.
   */
  stop(): void
  /** Only after `completed`. Throws otherwise — an unfinished attempt has no log (spec edge case). */
  finish(): KeystrokeEventLog
}

export interface EngineOptions {
  text: string
  errorMode: ErrorMode
  input: InputSource
  clock: Clock
  /**
   * Accepted for the contract's sake and deliberately unused: judging compares the typed character
   * with the awaited one, and the layout only matters to the pre-start probe and to the views.
   */
  layout: Layout
}

/**
 * The keystroke state machine. It reads events from an `InputSource` and time from a `Clock`, and
 * touches no DOM: that is what lets the whole package run under plain Node, and what lets F2
 * replay a stored log on a server.
 *
 * It computes no metric. Events that arrive in `idle` (other than the first printable character),
 * in `paused`, or after the attempt ended are dropped and not logged: they belong to no attempt.
 */
export function createEngine(options: EngineOptions): Engine {
  // Code points, not UTF-16 units, so the cursor always sits on a whole character.
  const chars = Array.from(options.text)
  if (chars.length === 0) throw new RangeError('An exercise text must not be empty')

  const { errorMode, input, clock } = options
  const watch = createStopwatch(clock)
  const log = createLogBuilder()
  const listeners = new Set<(view: EngineView) => void>()
  let machine: MachineState = initialState
  let lastAt = 0

  const snapshot = (): EngineView => ({
    state: machine.phase,
    cursor: machine.cursor,
    markedAt: machine.markedAt,
    wrong: machine.wrong,
    errorCount: machine.errorCount,
    elapsedMs: watch.elapsed(),
    lastError: machine.lastError,
  })

  const notify = (): void => {
    const view = snapshot()
    for (const listener of [...listeners]) listener(view)
  }

  /** Delta since the previous entry, clamped so a late-arriving timestamp can never go negative. */
  const deltaTo = (at: number): number => {
    const delta = Math.max(0, at - lastAt)
    lastAt = at
    return delta
  }

  /** Once the attempt is over the clock stops and the input is released. */
  const settle = (): void => {
    if (machine.phase === 'running' || machine.phase === 'paused') return
    watch.pause()
    unsubscribe()
  }

  const onEvent = (event: InputEvent): void => {
    if (machine.phase === 'idle') {
      // FR-014: the first printable character starts the attempt; nothing else does.
      if (event.kind !== 'char' || event.char === '') return
      machine = begin(machine)
      lastAt = event.at
      watch.resume()
    }
    if (machine.phase !== 'running') return

    if (event.kind === 'ignored' || (event.kind === 'char' && event.char === '')) {
      // FR-020: consumes nothing, counts nothing, yet recorded so that it is provable.
      log.append(deltaTo(event.at), 'ignored', null, false)
    } else if (event.kind === 'backspace') {
      machine = applyBackspace(machine, errorMode)
      log.append(deltaTo(event.at), 'backspace', null, false)
    } else {
      // A composition can deliver several characters at once: judge each, in order, none skipped.
      let judged = false
      for (const typed of Array.from(event.char)) {
        const outcome = applyChar(machine, chars, errorMode, typed)
        if (outcome.kind === 'overflow') break
        machine = outcome.state
        judged = true
        // Stored as U+0027 whichever apostrophe was typed (FR-007).
        log.append(deltaTo(event.at), 'char', foldApostrophe(typed), outcome.correct)
        if (machine.phase === 'completed') break
      }
      if (!judged) return
    }
    settle()
    notify()
  }

  // Declared after `onEvent` and read only inside callbacks, so it is initialised by then.
  const unsubscribe = input.subscribe(onEvent)

  /** Applies a lifecycle transition and repaints only if something actually changed. */
  const transition = (next: (state: MachineState) => MachineState, after?: () => void): void => {
    const updated = next(machine)
    if (updated === machine) return
    machine = updated
    after?.()
    settle()
    notify()
  }

  return {
    get view() {
      return snapshot()
    },
    onChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      transition(begin, () => {
        lastAt = clock.now()
        watch.resume()
      })
    },
    pause() {
      transition(pauseState, () => watch.pause())
    },
    resume() {
      transition(resumeState, () => watch.resume())
    },
    abandon() {
      transition(abandonState)
    },
    stop() {
      transition(stopState)
    },
    finish() {
      if (machine.phase !== 'completed') {
        throw new Error(`finish() needs a completed attempt, but it is ${machine.phase}`)
      }
      return log.snapshot()
    },
  }
}

/**
 * Splits the text into what the learner has typed, the awaited character and what is upcoming, so
 * the three can be styled apart (FR-015). Pure and view-only: it reads the cursor and nothing else.
 */
export function segmentText(
  text: string,
  view: Pick<EngineView, 'cursor'>,
): { typed: string; awaited: string; upcoming: string } {
  const chars = Array.from(text)
  return {
    typed: chars.slice(0, view.cursor).join(''),
    awaited: chars[view.cursor] ?? '',
    upcoming: chars.slice(view.cursor + 1).join(''),
  }
}
