/**
 * The latency probe's browser-side contract, redeclared for the Playwright program.
 *
 * The implementation and its own `declare global` live in `apps/web/src/instrument/latency.ts`,
 * which this program deliberately does not include: the end-to-end suite treats the application
 * as a black box, and importing app internals into it would make a refactor there break tests
 * here for reasons that have nothing to do with behaviour. What crosses the boundary is this
 * shape, and if the two ever drift the spec fails on a missing method rather than silently.
 */

interface LatencyReport {
  readonly samples: number
  readonly p95Ms: number
  readonly maxMs: number
  readonly samplesMs: readonly number[]
}

interface LatencyProbeApi {
  startLatencyProbe(): void
  readLatencyReport(): LatencyReport
}

interface Window {
  __typingRaceLatency?: LatencyProbeApi
}
