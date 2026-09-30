import type { Random } from '@typing-race/domain'

/**
 * T015. There is no unseeded variant, on purpose.
 *
 * The scale generators are pure functions of `(scale, unlocked, seed)` (research R6), and an
 * attempt stores its seed so its exact text can be reproduced from the record. A caller that could
 * reach for an unseeded generator would eventually produce an exercise nobody can replay — so the
 * only way to get randomness in this application is to name a seed.
 *
 * This is the only file permitted to hold a pseudo-random generator (Constitution III); `Math.random`
 * is not used here either, because it cannot be seeded.
 */

/**
 * mulberry32: 32-bit state, one multiply-xorshift round. Chosen over a linear congruential
 * generator because the low bits of an LCG are famously non-random, and the generators index into
 * small arrays — which reads exactly those low bits.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    /**
     * Rejection sampling rather than `Math.floor(next() * max)`. The naive form is biased whenever
     * `max` does not divide 2^32, and a generator that slightly prefers the first few keys of a
     * scale is a pedagogical bug that no test would notice.
     */
    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`nextInt needs a positive integer bound, got ${maxExclusive}`)
      }
      const limit = Math.floor(4294967296 / maxExclusive) * maxExclusive
      let draw = 0
      do {
        draw = next() * 4294967296
      } while (draw >= limit)
      return Math.floor(draw) % maxExclusive
    },
  }
}
