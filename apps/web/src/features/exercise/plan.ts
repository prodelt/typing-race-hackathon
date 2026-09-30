import { generateText, initialUnlockedSet, REQUIREMENTS_UNMET } from '@typing-race/curriculum'
import type { Layout, Scale } from '@typing-race/domain'
import { seededRandom } from '../../seams/index.js'

/**
 * Which text an attempt types, decided once, before the first keystroke.
 *
 * The seed is stored on the Attempt so the exact text can be reproduced (FR-009). It is derived
 * from the scale and from how many attempts the learner already made on it, so that a repeat gets
 * a different text while the same history always gets the same one.
 */

/** FNV-1a over UTF-16 units: small, dependency-free, and stable across runs. */
function hashOf(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function seedFor(scaleId: string, attemptsOnScale: number): number {
  return (hashOf(scaleId) + Math.imul(attemptsOnScale, 0x9e3779b1)) >>> 0
}

export interface ExercisePlan {
  readonly text: string
  readonly seed: number
  readonly unlocked: readonly string[]
}

/** `null` when the learner's unlocked set cannot serve the scale — it is never offered degraded. */
export function planExercise(args: {
  scale: Scale
  layout: Layout
  unlocked: readonly string[] | undefined
  attemptsOnScale: number
}): ExercisePlan | null {
  const { scale, layout, attemptsOnScale } = args
  // Before FR-048's question is answered there is no progress; the anchors and space are always open.
  const unlocked = args.unlocked ?? initialUnlockedSet(layout)
  const seed = seedFor(scale.id, attemptsOnScale)
  const text = generateText({ scale, layout, unlocked, random: seededRandom(seed) })
  return text === REQUIREMENTS_UNMET ? null : { text, seed, unlocked }
}

export function newAttemptId(): string {
  return globalThis.crypto.randomUUID()
}
