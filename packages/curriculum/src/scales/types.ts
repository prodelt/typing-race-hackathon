import type { Layout, ScaleType } from '@typing-race/domain'

export type { FocusElement, Scale, ScaleType } from '@typing-race/domain'

/** The eight mandatory Stage 1 types, in the order of the requirements' list (research R6). */
export const SCALE_TYPES: readonly ScaleType[] = [
  'run',
  'mirror',
  'alternate',
  'fingerIsolation',
  'vertical',
  'fingerSpan',
  'modifiers',
  'tempo',
]

/** What `generateText` returns when the unlocked set cannot serve the scale — never degraded text. */
export const REQUIREMENTS_UNMET = 'requirements-unmet'

/**
 * Everything a generator may look at. A generator is a pure function of this: it has no other
 * input, which is what makes `(scale, unlocked, seed)` reproduce the same text (FR-009).
 */
export interface GeneratorContext {
  readonly layout: Layout
  /** The unlocked set plus the Focus Element's own characters — the only characters allowed. */
  readonly available: ReadonlySet<string>
  /**
   * The ways the Focus Element can appear in an item, each of which satisfies FR-046. One form for
   * a key or a transition; for the Shift entry, a capital of each available letter.
   */
  readonly forms: readonly string[]
  /** Whether capitals may be produced: Shift is unlocked, or Shift is what is being learned. */
  readonly shiftOn: boolean
}

/**
 * Builds the pool of candidate items, every one of which contains the Focus Element. Returns an
 * empty pool when the context cannot serve the generator. The caller draws from the pool with the
 * `Random` port, so the generator itself never sees randomness.
 */
export type Generator = (context: GeneratorContext) => string[]
