import type { LayoutId } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import type { ExerciseWording } from '../exercise/wording.js'

/** A text the learner chose to type, as accepted by the form. */
export interface OwnText {
  readonly text: string
  /** The pasted text was longer than the limit and was cut at a sentence boundary. */
  readonly cut: boolean
  readonly layoutId: LayoutId
}

/**
 * The last own text, in memory only: "again" on the result screen re-runs it. It does not survive a
 * reload (the text is the learner's and is never stored), and then "again" opens the form.
 */
let last: OwnText | null = null

export function rememberOwnText(own: OwnText): void {
  last = own
}

/** The last own text typed on this layout in this tab, or `null`. */
export function lastOwnText(layoutId: LayoutId): OwnText | null {
  return last?.layoutId === layoutId ? last : null
}

/** What the pre-start card says: own text is free practice, and a cut text says so up front. */
export function ownTextWording(own: OwnText): ExerciseWording {
  return {
    title: m.map_own_title(),
    goalLabel: m.session_realtext_goal_label(),
    goal: m.map_own_goal(),
    focus: m.map_own_chip(),
    ...(own.cut ? { notice: m.map_own_cut({ count: [...own.text].length }) } : {}),
  }
}
