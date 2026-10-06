import { useNavigate } from '@tanstack/react-router'
import type { AttemptMode } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'

export interface ModeToggleProps {
  readonly scaleId: string
  readonly mode: AttemptMode
  /** A Practice Attempt on this scale has already cleared the accuracy floor (FR-036). */
  readonly testIsPrimary: boolean
}

/**
 * T092. Choosing between a Practice Attempt and a Test Attempt (FR-036).
 *
 * The mode is a property of the route's search, so switching is a navigation and the screen is
 * rebuilt from scratch: there is no way to flip a running attempt into a guided one. Once practice
 * has cleared the floor, "take the test attempt" is the filled button, because only a Test Attempt
 * counts toward mastery (FR-039).
 *
 * The two buttons keep one pair of names in both states, the same as the HUD and the result say:
 * which one is on is the pressed state and the ring, never a different wording.
 */
/** The chosen mode is ringed as well as pressed: state is never colour alone (FR-066). */
const CURRENT = 'ring-2 ring-sage ring-offset-1'

export function ModeToggle({ scaleId, mode, testIsPrimary }: ModeToggleProps) {
  const navigate = useNavigate()

  const go = (next: AttemptMode) => {
    void navigate({ to: '/exercise/$scaleId', params: { scaleId }, search: { mode: next } })
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">{m.exercise_mode_group()}</legend>
      <Button
        aria-pressed={mode === 'practice'}
        variant="secondary"
        className={mode === 'practice' ? CURRENT : undefined}
        onClick={() => go('practice')}
      >
        {m.exercise_mode_practice()}
      </Button>
      <Button
        aria-pressed={mode === 'test'}
        variant={mode === 'practice' && testIsPrimary ? 'primary' : 'secondary'}
        className={mode === 'test' ? CURRENT : undefined}
        onClick={() => go('test')}
      >
        {m.exercise_mode_test()}
      </Button>
    </fieldset>
  )
}
