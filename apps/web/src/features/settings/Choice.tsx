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
 * by shape as well as tint — a tile's radio dot and ink ring, a strip's filled ink pill — so
 * selection is never colour alone.
 *
 * Two looks, picked by the options themselves. Options that are each explained (the error modes)
 * are tiles, one per row, the explanation inside. Short options are a segmented strip, like the
 * status bar's layout switch; when one of them still needs a word of explanation (the low-vision
 * preset) it is said under the strip and tied to that radio by `aria-describedby`.
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
  const tiles = options.every((option) => option.hint !== undefined)
  const notes = tiles ? [] : options.filter((option) => option.hint !== undefined)
  const noteId = (option: ChoiceOption<T>) => `${name}-${option.value}-note`

  return (
    <fieldset className="set-group" aria-describedby={hint === undefined ? undefined : hintId}>
      <legend className="set-group__legend">{legend}</legend>
      {hint !== undefined && (
        <p id={hintId} className="set-hint">
          {hint}
        </p>
      )}
      <div className={tiles ? 'set-choices' : 'set-seg'} data-count={options.length}>
        {options.map((option) => (
          <label key={option.value} className={tiles ? 'set-choice' : 'set-seg__opt'}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-describedby={!tiles && option.hint !== undefined ? noteId(option) : undefined}
              className="set-choice__radio"
            />
            {tiles ? (
              <span className="set-choice__text">
                <span className="set-choice__label">{option.label}</span>
                <span className="set-choice__hint">{option.hint}</span>
              </span>
            ) : (
              <span className="set-seg__label">{option.label}</span>
            )}
          </label>
        ))}
      </div>
      {notes.map((option) => (
        <p key={option.value} id={noteId(option)} className="set-note">
          <b>{option.label}</b> — {option.hint}
        </p>
      ))}
    </fieldset>
  )
}
