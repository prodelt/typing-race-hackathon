// Public surface of @typing-race/metrics — specs/001-typing-core/contracts/metrics.md.
// Internals (`charKeystrokes`, the per-module helpers) are deliberately not re-exported. This
// barrel is a hot file: it is written in the Foundational phase and never in a story lane.
export { computeAggregates } from './aggregates'
export { computeMetrics } from './compute'
export { confidenceOf, foldConfidence } from './confidence'
export {
  CONFIDENCE_HALF_LIFE,
  CONFIDENCE_MIN_SAMPLES,
  REFERENCE_IKI_MS,
  RHYTHM_BREAK_MS,
} from './constants'
