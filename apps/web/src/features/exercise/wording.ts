import type { FocusElement, LayoutId, Scale } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { focusLabel, GOAL_MESSAGES } from './labels.js'

/**
 * What the exercise screen needs to know about the thing being typed, whether it is a Stage 1
 * Scale or a Stage 2 Word Drill: its id (the attempt records it), its layout, and its focus.
 */
export interface ExerciseTarget {
  readonly id: string
  readonly layoutId: LayoutId
  readonly focus: FocusElement | null
  /** A tempo scale's starting pace; `null` for everything else. */
  readonly targetSpm: number | null
}

/** The sentences the pre-start card and the rail show for one exercise. */
export interface ExerciseWording {
  readonly title: string
  readonly goalLabel: string
  readonly goal: string
  readonly focus: string
}

export function scaleWording(scale: Scale): ExerciseWording {
  return {
    title: m.exercise_title({ focus: focusLabel(scale.focus) }),
    goalLabel: m.exercise_goal_label(),
    goal: GOAL_MESSAGES[scale.type](),
    focus: focusLabel(scale.focus),
  }
}
