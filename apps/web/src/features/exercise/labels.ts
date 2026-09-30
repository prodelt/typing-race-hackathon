import { SHIFT_TOKEN } from '@typing-race/curriculum'
import type { FingerAssignment, FocusElement, LayoutId, ScaleType } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import type { GuideTier } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'

/**
 * Every string this screen builds out of data rather than out of a message. Kept in one file so
 * the typing line, the guide and the pause overlay cannot name a finger three different ways.
 */

/**
 * An explicit map rather than `m[scale.goal]`: the Paraglide namespace has no index signature, and
 * a typed record fails to compile when a ScaleType gains a goal nobody wrote a message for (FR-010).
 */
export const GOAL_MESSAGES: Record<ScaleType, () => string> = {
  run: m.scale_goal_run,
  mirror: m.scale_goal_mirror,
  alternate: m.scale_goal_alternate,
  fingerIsolation: m.scale_goal_finger_isolation,
  vertical: m.scale_goal_vertical,
  fingerSpan: m.scale_goal_finger_span,
  modifiers: m.scale_goal_modifiers,
  tempo: m.scale_goal_tempo,
}

/** Proper names of layouts; they are not translated. */
export const LAYOUT_NAMES: Record<LayoutId, string> = { yq: 'ЙЦУКЕН', qwerty: 'QWERTY' }

const FINGER_MESSAGES = {
  pinky: m.exercise_finger_pinky,
  ring: m.exercise_finger_ring,
  middle: m.exercise_finger_middle,
  index: m.exercise_finger_index,
  thumb: m.exercise_finger_thumb,
} as const

/** "лівий мізинець" / "left pinky". A thumb has no side: either one presses the space bar. */
export function fingerLabel({ hand, finger }: FingerAssignment): string {
  const name = FINGER_MESSAGES[finger]()
  if (hand === 'thumbs') return name
  return `${hand === 'left' ? m.exercise_hand_left() : m.exercise_hand_right()} ${name}`
}

/** Stored as U+0027, shown as U+2019 (docs/adr/0003). */
export function displayChar(char: string): string {
  return char === "'" ? '’' : char
}

/** What the learner reads on a key or in a Focus Element chip for one awaited character. */
export function glyphFor(char: string): string {
  return char === ' ' ? m.exercise_key_space() : displayChar(char)
}

export function focusLabel(focus: FocusElement): string {
  if (focus.kind === 'key') {
    const key = focus.value === SHIFT_TOKEN ? 'Shift' : glyphFor(focus.value)
    return m.exercise_focus_key({ key })
  }
  const parsed = parseTransitionKey(focus.value)
  if (parsed === undefined) return focus.value
  return m.exercise_focus_transition({
    from: displayChar(parsed.from),
    to: displayChar(parsed.to),
  })
}

/**
 * Ticket 20 addendum 18: confidence at or above 0.9 returns the keycap to plain paper, 0.7 to 0.9
 * keeps a pale tint, below 0.7 keeps the full finger colour. No observations yet (`undefined`) is
 * the full colour too: a key the learner has never been measured on should be fully prompted.
 */
export function tierOf(confidence: number | undefined): GuideTier {
  if (confidence === undefined || confidence < 0.7) return 'learning'
  return confidence >= 0.9 ? 'confident' : 'familiar'
}

/** m:ss, from milliseconds running. */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
