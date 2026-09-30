import { useId } from 'react'

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
 * One native radio group: a fieldset with a legend, real radios, real labels. A native group gives
 * arrow-key traversal and a visible focus ring for free (FR-066), and the checked state is carried
 * by the radio dot as well as by the tint, so selection is never colour alone.
 *
 * `value` comes from the store on every render and no copy is kept here, so the control cannot
 * drift from what `theme.ts` is applying (FR-049).
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

  return (
    <fieldset
      className="m-0 border-0 p-0"
      aria-describedby={hint === undefined ? undefined : hintId}
    >
      <legend className="mb-1 font-ui text-base font-semibold text-ink">{legend}</legend>
      {hint !== undefined && (
        <p id={hintId} className="mb-3 font-ui text-sm text-ink/80">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-w-44 max-w-80 flex-1 cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline-strong bg-paper-raised p-3 has-[:checked]:border-sage has-[:checked]:bg-sage-tint"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 accent-[var(--color-sage)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-ui font-semibold text-ink">{option.label}</span>
              {option.hint !== undefined && (
                <span className="font-ui text-sm text-ink/80">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
