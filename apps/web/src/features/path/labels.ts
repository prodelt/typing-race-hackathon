import { SHIFT_TOKEN } from '@typing-race/curriculum'
import type { Finger, NextAction, Scale, ScaleType, StartingLevelChoice } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { displayChar } from './model.js'

/** A record rather than a computed `m[...]` lookup, so a new ScaleType is a compile error here. */
const TYPE_LABELS: Record<ScaleType, () => string> = {
  run: () => m.path_scale_type_run(),
  mirror: () => m.path_scale_type_mirror(),
  alternate: () => m.path_scale_type_alternate(),
  fingerIsolation: () => m.path_scale_type_fingerIsolation(),
  vertical: () => m.path_scale_type_vertical(),
  fingerSpan: () => m.path_scale_type_fingerSpan(),
  modifiers: () => m.path_scale_type_modifiers(),
  tempo: () => m.path_scale_type_tempo(),
}

const FINGER_LABELS: Record<Finger, () => string> = {
  pinky: () => m.path_finger_pinky(),
  ring: () => m.path_finger_ring(),
  middle: () => m.path_finger_middle(),
  index: () => m.path_finger_index(),
  thumb: () => m.path_finger_thumb(),
}

/** The coach passes the finger as a plain string; an unknown one is shown as given. */
function fingerLabel(name: string): string {
  const entry = Object.entries(FINGER_LABELS).find(([finger]) => finger === name)
  return entry === undefined ? name : entry[1]()
}

export function keyLabel(char: string): string {
  if (char === ' ') return m.path_key_space()
  return char === SHIFT_TOKEN ? m.path_key_shift() : displayChar(char)
}

export function scaleName(scale: Scale): string {
  return m.path_scale_name({ type: TYPE_LABELS[scale.type](), key: keyLabel(scale.focus.value) })
}

function text(value: string | number | undefined): string {
  return value === undefined ? '' : String(value)
}

/**
 * The sentence for a Next Action. The coach returns a template key plus values (FR-034); the
 * wording lives in this lane's message files, so the exact sentence stays translatable.
 */
export function nextActionText(
  action: NextAction,
  scaleById: (id: string) => Scale | undefined,
): string {
  const v = action.values
  switch (action.template) {
    case 'coach.lowerTempo':
      return m.path_next_lowerTempo({ accuracy: text(v['accuracy']), floor: text(v['floor']) })
    case 'coach.weakTransition':
      return m.path_next_weakTransition({
        from: keyLabel(text(v['from'])),
        to: keyLabel(text(v['to'])),
        confidence: text(v['confidence']),
      })
    case 'coach.evenRhythm':
      return m.path_next_evenRhythm({ rhythm: text(v['rhythm']) })
    case 'coach.nextKey': {
      return m.path_next_nextKey({
        key: keyLabel(text(v['key'])),
        finger: fingerLabel(text(v['finger'])),
      })
    }
    case 'coach.nextScale': {
      const scale = scaleById(action.startsScaleId)
      return m.path_next_nextScale({ scale: scale === undefined ? '' : scaleName(scale) })
    }
    default:
      // An unknown template is a coach change this lane has not caught up with. Naming the rule
      // keeps the screen honest (one action, never blank) until the message exists.
      return action.template
  }
}

export interface StartingLevelOption {
  readonly choice: StartingLevelChoice
  readonly title: () => string
  readonly body: () => string
}

/**
 * FR-048's three answers, in the order they are offered: least to most experienced. Shared by the
 * Map's starting-level control and the first run, so both say the same thing.
 */
export const STARTING_LEVELS: readonly StartingLevelOption[] = [
  {
    choice: 'neverTouchTyped',
    title: () => m.path_start_never_title(),
    body: () => m.path_start_never_body(),
  },
  {
    choice: 'knowsHomeRow',
    title: () => m.path_start_home_title(),
    body: () => m.path_start_home_body(),
  },
  {
    choice: 'touchTypesWantsAccuracy',
    title: () => m.path_start_accuracy_title(),
    body: () => m.path_start_accuracy_body(),
  },
]
