import type { Clock, InputEvent, InputSource, LayoutProbe } from '@typing-race/domain'

export type ManualClock = Clock & { advance(ms: number): void }

/**
 * A clock that moves only when told to. Every duration the engine reports can be asserted exactly,
 * with no waiting and no flakiness.
 */
export function manualClock(start = 0): ManualClock {
  let current = start
  return {
    now: () => current,
    advance(ms) {
      current += ms
    },
  }
}

export interface ScriptedInput extends InputSource {
  /** Delivers every remaining scripted event to the current listeners, in order. */
  play(): void
  /** Delivers the next scripted event. Returns `false` once the script is exhausted. */
  step(): boolean
  /** Delivers an event that was not in the script. */
  emit(event: InputEvent): void
  readonly focusCalls: number
}

/**
 * An `InputSource` with no DOM behind it. Nothing is delivered on `subscribe`; the test decides
 * when each event arrives, so it can interleave `pause()` and clock advances between keystrokes.
 */
export function scriptedInput(events: readonly InputEvent[]): ScriptedInput {
  const listeners = new Set<(event: InputEvent) => void>()
  let next = 0
  let focusCalls = 0

  const emit = (event: InputEvent): void => {
    for (const listener of [...listeners]) listener(event)
  }
  const step = (): boolean => {
    const event = events[next]
    if (event === undefined) return false
    next += 1
    emit(event)
    return true
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    probeLayout: (): Promise<LayoutProbe> => Promise.resolve({ producible: true }),
    focus() {
      focusCalls += 1
    },
    play() {
      while (step()) {
        // step() delivers one event per call
      }
    },
    step,
    emit,
    get focusCalls() {
      return focusCalls
    },
  }
}
