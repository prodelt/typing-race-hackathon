/**
 * The tuning constants of the metrics package. Each is published on the Formulas page, so changing
 * one changes a documented formula and needs a `derivedVersion` bump in `curriculum`.
 */

/** 400 ms per character is 150 characters per minute, the floor of the Basic band — research R4. */
export const REFERENCE_IKI_MS = 400

/** Observations after which an element's weight has halved — research R4. */
export const CONFIDENCE_HALF_LIFE = 10

/** Below this many (weighted) observations Confidence is unmeasured, not zero — research R4. */
export const CONFIDENCE_MIN_SAMPLES = 5

/** An interval longer than this is the learner taking a break, not typing — research R5. */
export const RHYTHM_BREAK_MS = 3000
