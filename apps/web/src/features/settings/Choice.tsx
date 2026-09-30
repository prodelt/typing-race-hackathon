import { cx } from '@typing-race/ui'
import { useId } from 'react'
import { Check } from '../screen.js'

export interface ChoiceOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly hint?: string
}

interface ChoiceGroupProps<T extends string> {
  readonly legend: string
  readonly hint?: string
  readonly value: T
  readonly options: readonly ChoiceOption<T>[]
  readonly onChange: (value: T) => void
}

/**
 * One native radio group, drawn as the brand's pills: a fieldset with a legend, real radios, real
 * labels. A native group gives arrow-key traversal and a visible focus ring for free, and the
 * chosen pill is filled ink **and** carries a check mark, so selection is never colour alone.
 *
 * Options that carry a hint wrap to two lines, so they are square blocks rather than pills (the
 * brand's rule: pills for one line, blocks for anything that wraps).
 *
 * `value` comes from the store on every render and no copy is kept here, so the control cannot
 * drift from what `theme.ts` is applying.
 */
export function ChoiceGroup<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
}: ChoiceGroupProps<T>) {
  const name = useId()
  const hintId = `${name}-hint`
  const blocks = options.some((option) => option.hint !== undefined)

  return (
    <fieldset className="choice" aria-describedby={hint === undefined ? undefined : hintId}>
      <legend className="choice__legend">{legend}</legend>
      {hint !== undefined && (
        <p id={hintId} className="choice__hint">
          {hint}
        </p>
      )}
      <div className={cx('pills', blocks && 'pills--blocks')}>
        {options.map((option) => (
          <label key={option.value} className={cx('pill', blocks && 'pill--block')}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="pill__face">
              <span className="pill__label">
                <Check />
                {option.label}
              </span>
              {option.hint !== undefined && <span className="pill__hint">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
