import type { Key, Layout } from '@typing-race/domain'

/** Code-point comparison: locale-free, so the order is the same in every runtime (FR-050). */
function compareIds(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Completion order, with the id as a tie-break. The fold must not trust the caller's order: F2's
 * offline outbox delivers attempts out of order and the same history must still give the same
 * progress — FR-050. Two attempts finishing in the same millisecond would otherwise sort by
 * arrival, which is exactly the non-determinism this exists to remove.
 */
export function byCompletion<T extends { readonly completedAt: number; readonly id: string }>(
  attempts: readonly T[],
): T[] {
  return [...attempts].sort((a, b) => a.completedAt - b.completedAt || compareIds(a.id, b.id))
}

/** The key that produces a character, shifted or not. */
export function keyOfChar(layout: Layout, char: string): Key | undefined {
  return layout.keys.find((key) => key.plain === char || key.shifted === char)
}
