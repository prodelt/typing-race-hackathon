import type { Random } from '@typing-race/domain'

/**
 * mulberry32, for tests only: a small seeded generator so a property can name its seed and a
 * failure can be replayed. Lives here rather than in `src/` proper because the real `Random` adapter
 * belongs to the web app's seams, and this package may not depend on it.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, nextInt: (maxExclusive) => Math.floor(next() * maxExclusive) }
}

/**
 * A Random that replays a fixed script of `next()` values, then repeats the last. A value outside
 * [0, 1) is how a test makes `nextInt` break its own contract.
 */
export function scriptedRandom(values: readonly number[]): Random {
  let index = 0
  const next = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0
    index += 1
    return value
  }
  return { next, nextInt: (maxExclusive) => Math.floor(next() * maxExclusive) }
}
