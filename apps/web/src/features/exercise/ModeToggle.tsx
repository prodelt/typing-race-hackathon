import { useNavigate } from '@tanstack/react-router'
import type { AttemptMode } from '@typing-race/domain'
import { cx } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { Check } from '../screen.js'

export interface ModeToggleProps {
  readonly scaleId: string
  readonly mode: AttemptMode
  /** A Practice Attempt on this scale has already cleared the accuracy floor. */
  readonly testIsPrimary: boolean
}

/**
 * Choosing between a Practice Attempt and a Test Attempt.
 *
 * The mode is a property of the route's search, so switching is a navigation and the screen is
 * rebuilt from scratch: there is no way to flip a running attempt into a guided one. The current
 * mode is the filled ink pill with a check mark (state is never colour alone). Once practice has
 * cleared the floor, "take the test attempt" becomes the red pill, because only a Test Attempt
 * counts toward mastery.
 */
export function ModeToggle({ scaleId, mode, testIsPrimary }: ModeToggleProps) {
  const navigate = useNavigate()

  const go = (next: AttemptMode) => {
    void navigate({ to: '/exercise/$scaleId', params: { scaleId }, search: { mode: next } })
  }

  const options: readonly { value: AttemptMode; label: string }[] = [
    {
      value: 'practice',
      label: mode === 'practice' ? m.exercise_mode_practice() : m.exercise_mode_take_practice(),
    },
    {
      value: 'test',
      label: mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_take_test(),
    },
  ]

  return (
    <fieldset className="mode">
      <legend className="sr-only">{m.exercise_mode_group()}</legend>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          className={cx(
            'mode__option',
            value === 'test' && mode === 'practice' && testIsPrimary && 'mode__option--call',
          )}
          onClick={() => go(value)}
        >
          <Check />
          {label}
        </button>
      ))}
    </fieldset>
  )
}
