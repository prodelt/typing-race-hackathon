import { keyOf, MASTERY_STREAK, nextLockedKey, SHIFT_TOKEN } from '@typing-race/curriculum'
import type { Key, Layout, Progress, Scale } from '@typing-race/domain'

/**
 * What the Path screen shows, computed from derived `Progress` and nothing else.
 *
 * Nothing in this file keeps a second list of "unlocked" keys or scales. The unlocked set is
 * already a prefix of the Unlock Order plus the anchors and space (FR-042), because the fold builds
 * it that way; every function here only *reads* it. A screen that kept its own bookkeeping could
 * drift from the fold and show a key as open that the next attempt would refuse.
 */

export type KeyState = 'unlocked' | 'next' | 'locked'

export type ScaleState =
  | { readonly kind: 'complete' }
  | { readonly kind: 'inProgress'; readonly count: number }
  | { readonly kind: 'notStarted' }
  | { readonly kind: 'locked'; readonly reason: LockReason }

/** The condition that opens a locked scale, stated to the learner — spec scenario 1. */
export type LockReason =
  | { readonly kind: 'requires'; readonly keys: readonly string[] }
  | { readonly kind: 'focus'; readonly key: string }

/** Anchors and Space are not in the Unlock Order; they are open from the first exercise. */
function isFree(layout: Layout, char: string): boolean {
  return char === ' ' || layout.homeAnchors.includes(char)
}

/** Keys the learner can earn, for the "N of M" count: the Unlock Order without the Shift token. */
export function totalKeyCount(layout: Layout): number {
  return layout.homeAnchors.length + layout.unlockOrder.filter((c) => c !== SHIFT_TOKEN).length
}

/** Space and the Shift token are not counted as keys in the "N of M" line. */
export function unlockedKeyCount(progress: Progress): number {
  return progress.unlockedSet.filter((c) => c !== ' ' && c !== SHIFT_TOKEN).length
}

/**
 * The character a physical key is unlocked by. A modifier key has no character, so Shift stands in
 * for it; everything else unlocks on its plain character, which every key of both layouts has in
 * the Unlock Order or the anchors.
 */
function unlockChar(key: Key): string {
  return key.kind === 'modifier' ? SHIFT_TOKEN : key.plain
}

export function keyStates(layout: Layout, progress: Progress): ReadonlyMap<string, KeyState> {
  const unlocked = new Set(progress.unlockedSet)
  const next = nextLockedKey(layout, progress.unlockedSet)
  // Marked once: `Keycap.awaited` allows one per screen, and Shift is two physical keys.
  const nextKeyCode =
    next === undefined
      ? undefined
      : next === SHIFT_TOKEN
        ? layout.keys.find((key) => key.kind === 'modifier')?.code
        : keyOf(layout, next)?.code

  return new Map(
    layout.keys.map((key) => {
      const char = unlockChar(key)
      const state: KeyState =
        key.code === nextKeyCode
          ? 'next'
          : key.kind === 'space' || isFree(layout, char) || unlocked.has(char)
            ? 'unlocked'
            : 'locked'
      return [key.code, state]
    }),
  )
}

export interface ScaleRow {
  readonly scale: Scale
  readonly state: ScaleState
}

/**
 * Every Stage 1 scale in Unlock Order with its state.
 *
 * A scale is open when the keys it `requires` are unlocked **and** its focus key is either
 * unlocked or the very next one to unlock — the next key's own scale is how it unlocks (FR-041),
 * so it must be startable while its key is still locked. A completed scale stays completed even if
 * later history changes nothing about it.
 */
export function scaleRows(
  layout: Layout,
  catalogue: readonly Scale[],
  progress: Progress,
): readonly ScaleRow[] {
  const unlocked = new Set(progress.unlockedSet)
  const next = nextLockedKey(layout, progress.unlockedSet)
  const completed = new Set(progress.completedScales)

  return catalogue.map((scale) => {
    if (completed.has(scale.id)) return { scale, state: { kind: 'complete' } }

    const missing = scale.requires.filter((char) => !unlocked.has(char))
    if (missing.length > 0) {
      return { scale, state: { kind: 'locked', reason: { kind: 'requires', keys: missing } } }
    }
    const focus = scale.focus.value
    if (scale.focus.kind === 'key' && !unlocked.has(focus) && focus !== next) {
      return { scale, state: { kind: 'locked', reason: { kind: 'focus', key: focus } } }
    }

    const count = progress.consecutivePasses[scale.id] ?? 0
    return { scale, state: count > 0 ? { kind: 'inProgress', count } : { kind: 'notStarted' } }
  })
}

/** The streak Today reports: the one belonging to the scale the Next Action starts (FR-039). */
export function streakFor(progress: Progress, scaleId: string): number {
  return progress.consecutivePasses[scaleId] ?? 0
}

export { MASTERY_STREAK }

/** U+0027 is stored, U+2019 is displayed (DECISIONS.md). */
export function displayChar(char: string): string {
  return char === "'" ? '’' : char
}
