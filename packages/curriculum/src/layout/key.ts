import type { FingerAssignment, Key, KeyKind, Row } from '@typing-race/domain'

/** Shorthand for the finger assignments the two finger maps are written in. */
export const LP = {
  hand: 'left',
  finger: 'pinky',
} as const satisfies FingerAssignment
export const LR = {
  hand: 'left',
  finger: 'ring',
} as const satisfies FingerAssignment
export const LM = {
  hand: 'left',
  finger: 'middle',
} as const satisfies FingerAssignment
export const LI = {
  hand: 'left',
  finger: 'index',
} as const satisfies FingerAssignment
export const RI = {
  hand: 'right',
  finger: 'index',
} as const satisfies FingerAssignment
export const RM = {
  hand: 'right',
  finger: 'middle',
} as const satisfies FingerAssignment
export const RR = {
  hand: 'right',
  finger: 'ring',
} as const satisfies FingerAssignment
export const RP = {
  hand: 'right',
  finger: 'pinky',
} as const satisfies FingerAssignment
export const TH = {
  hand: 'thumbs',
  finger: 'thumb',
} as const satisfies FingerAssignment

/**
 * One physical key. The tables in `yq.ts` and `qwerty.ts` are nothing but these calls, so a wrong
 * finger is a wrong line of data and never a wrong branch of code (FR-003).
 */
export function key(
  code: string,
  row: Row,
  assignment: FingerAssignment,
  plain: string,
  shifted: string | null,
  kind: KeyKind = 'letter',
): Key {
  return {
    code,
    row,
    hand: assignment.hand,
    finger: assignment.finger,
    plain,
    shifted,
    kind,
  }
}

/**
 * The space bar and the two Shift keys are the same in both layouts. Shift keys produce no
 * character, so `plain` is empty; they are in the table so the on-screen keyboard can draw them and
 * so the opposite-hand rule has a key to point at (FR-004).
 */
export const commonKeys: readonly Key[] = [
  key('Space', 'bottom', TH, ' ', null, 'space'),
  key('ShiftLeft', 'bottom', LP, '', null, 'modifier'),
  key('ShiftRight', 'bottom', RP, '', null, 'modifier'),
]
