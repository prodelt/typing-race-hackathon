import type { Clock } from '@typing-race/domain'

/**
 * T014. Monotonic milliseconds, never wall-clock: an attempt in progress must survive the system
 * clock being corrected, a daylight-saving jump or an NTP step, none of which move
 * `performance.now()`.
 *
 * This is the only file in the application permitted to call it (Constitution III).
 */
export const systemClock: Clock = {
  now: () => performance.now(),
}

export interface ManualClock extends Clock {
  advance(ms: number): void
  set(ms: number): void
}

/**
 * The in-memory adapter. Every metric in research R4, R5 and R8 is a function of time, and there
 * is no way to test the 3000 ms rhythm-break rule against a real clock without sleeping for three
 * seconds — which would be both slow and flaky.
 */
export function manualClock(start = 0): ManualClock {
  let current = start
  return {
    now: () => current,
    advance(ms) {
      if (ms < 0) throw new Error(`manualClock cannot go backwards (advance(${ms}))`)
      current += ms
    },
    set(ms) {
      current = ms
    },
  }
}
