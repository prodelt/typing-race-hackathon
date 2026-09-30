import type { Clock } from '@typing-race/domain'

export interface Stopwatch {
  resume(): void
  pause(): void
  elapsed(): number
}

/**
 * Accumulates only the time spent running, so `elapsedMs` excludes a pause and a tab that lost
 * focus (FR-022). It reads the injected `Clock` and nothing else; a test drives it with
 * `manualClock` and never waits.
 */
export function createStopwatch(clock: Clock): Stopwatch {
  let accumulated = 0
  let segmentStart: number | null = null

  return {
    resume() {
      if (segmentStart === null) segmentStart = clock.now()
    },
    pause() {
      if (segmentStart === null) return
      accumulated += clock.now() - segmentStart
      segmentStart = null
    },
    elapsed() {
      return segmentStart === null ? accumulated : accumulated + (clock.now() - segmentStart)
    },
  }
}
