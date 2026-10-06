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

/**
 * The speed above which typing is not counted as a hand's (ADR-0003, 2026-10-06): 25 characters a
 * second over a whole exercise. Klavogonki, the oldest typing-race site in the region, treats
 * anything above 1 500 зн/мин as certain cheating (docs/research/02-typing-trainers.md); its top
 * rank starts at 800, and Barbara Blackburn's record peak is about 1 060. The race check on the
 * server reads the same verdict.
 */
export const MAX_HUMAN_SPM = 1500

/**
 * The median interval between character keystrokes below which typing is a burst, not a hand
 * (ADR-0003, 2026-10-06). Half the keys under 25 ms apart is a sustained 2 400 SPM, while even a
 * record typist's median sits near 50 ms; a paste-like insertion, a whole-line composition or a
 * script's event series sits at 0–15 ms. A median, so that the near-zero intervals real hands do
 * make (rollover, an input method committing a word at once) cannot tip it.
 */
export const MIN_HUMAN_MEDIAN_IKI_MS = 25
