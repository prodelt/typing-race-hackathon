/**
 * T067. The keystroke-to-paint probe (research R8; FR-070, SC-002).
 *
 * `t0` is taken on entry to the `beforeinput` handler. Inside the next animation frame a macrotask
 * is scheduled, and `t1` is taken when it runs. The report is the p95 of `t1 - t0`.
 *
 * This is a **deliberate upper bound**. The macrotask after the frame runs strictly later than the
 * commit, so the number can fail a frame that made it and can never pass one that did not (FR-070
 * demands an instrument that cannot under-report). Do not "improve" it: `requestAnimationFrame`
 * alone stops before paint and under-reports; the Event Timing API rounds to 8 ms, half the budget.
 *
 * The probe listens on `document` in the capture phase. The engine's own `beforeinput` handler sits
 * on the hidden textarea, which is a descendant, so the capture listener runs first and `t0` is
 * taken before any handler work, never after it.
 *
 * Dead in production: both `import.meta.env` reads are dot accesses, which Vite folds to literals
 * (`DEV` false, the flag undefined), so the branch is `if (false)` and the bundler drops
 * `createProbe` with it. Verified by building a one-line entry that calls `installLatencyProbe()`
 * with `vite build` (minified, flag unset): the output chunk is empty, with neither the marker
 * `__typingRaceLatency` nor `beforeinput`; with `VITE_LATENCY_PROBE=true` both appear. Bracket access
 * (`env[X]`) defeats the folding: Vite inlines the whole env object and nothing is dropped.
 *
 * This is the only file besides the seams allowed to call `performance.now()` (Constitution III).
 */

export interface LatencyReport {
  readonly samples: number
  readonly p95Ms: number
  readonly maxMs: number
  readonly samplesMs: readonly number[]
}

export interface LatencyProbeApi {
  /** Clears earlier samples and starts listening. Idempotent. */
  startLatencyProbe(): void
  /** Stops listening and returns everything measured since `startLatencyProbe`. */
  readLatencyReport(): LatencyReport
}

declare global {
  interface ImportMetaEnv {
    /** `true` in the e2e latency build. Read with dot access so Vite folds it to a literal. */
    readonly VITE_LATENCY_PROBE?: string
  }

  interface Window {
    __typingRaceLatency?: LatencyProbeApi
  }
}

/** Nearest-rank p95: the smallest sample with at least 95% of samples at or below it. */
export function p95(sortedAscending: readonly number[]): number {
  if (sortedAscending.length === 0) return 0
  const rank = Math.ceil(0.95 * sortedAscending.length)
  return sortedAscending[rank - 1] ?? 0
}

function createProbe(): LatencyProbeApi {
  const samples: number[] = []
  let listening = false

  const onBeforeInput = (): void => {
    const t0 = performance.now()
    requestAnimationFrame(() => {
      // A macrotask, not a microtask: it must run after the frame has been committed.
      setTimeout(() => {
        samples.push(performance.now() - t0)
      }, 0)
    })
  }

  return {
    startLatencyProbe() {
      samples.length = 0
      if (listening) return
      listening = true
      document.addEventListener('beforeinput', onBeforeInput, { capture: true })
    },
    readLatencyReport() {
      document.removeEventListener('beforeinput', onBeforeInput, { capture: true })
      listening = false
      const sorted = [...samples].sort((a, b) => a - b)
      return {
        samples: sorted.length,
        p95Ms: p95(sorted),
        maxMs: sorted[sorted.length - 1] ?? 0,
        samplesMs: [...samples],
      }
    },
  }
}

/**
 * Called once from the entry. Live in development and in the dedicated e2e build, which sets
 * `VITE_LATENCY_PROBE=true`; in any other production build the condition is a literal `false`.
 */
export function installLatencyProbe(): void {
  if (import.meta.env.DEV || import.meta.env.VITE_LATENCY_PROBE === 'true') {
    window.__typingRaceLatency = createProbe()
  }
}
