import type { InputSource, Layout } from '@typing-race/domain'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { LAYOUT_NAMES } from './labels.js'
import { FOREIGN_STREAK, nextForeignStreak } from './layoutHint.js'

/**
 * Whether the learner is typing letters the exercise's layout cannot produce: the one signal that
 * names a wrong Active layout in every browser (`getLayoutMap()` never says which layout is active).
 * Three in a row raise it, a letter of the right layout clears it. State changes only on that
 * transition, so a keystroke never re-renders the screen (FR-069).
 */
export function useTypedWrongLayout(
  input: InputSource | null,
  layout: Layout,
  active: boolean,
): boolean {
  const [wrong, setWrong] = useState(false)
  useEffect(() => {
    if (!active || input === null) return
    let streak = 0
    let shown = false
    const unsubscribe = input.subscribe((event) => {
      streak = nextForeignStreak(streak, layout, event)
      const next = streak >= FOREIGN_STREAK
      if (next === shown) return
      shown = next
      setWrong(next)
    })
    return () => {
      unsubscribe()
      setWrong(false)
    }
  }, [input, layout, active])
  return wrong
}

/**
 * The reason a line full of red letters is red. It floats above the page instead of taking room in
 * it, so the typing line never moves while the learner reads it, and it never blocks typing.
 */
export function TypedLayoutNotice({
  layout,
  wrong,
}: {
  readonly layout: Layout
  readonly wrong: boolean
}) {
  if (!wrong) return null
  return (
    <p className="layout-toast" role="alert" data-testid="typed-layout-notice">
      {m.exercise_layout_typed_wrong({ layout: LAYOUT_NAMES[layout.id] })}
    </p>
  )
}
