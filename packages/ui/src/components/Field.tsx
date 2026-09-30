import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cx } from '../cx.js'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string
  /** Shown under the field. Announced with the input, so it is never decorative. */
  readonly hint?: ReactNode
  readonly invalid?: boolean
}

/**
 * T029. A labelled input.
 *
 * The label is a required prop rather than a slot: an unlabelled input is an accessibility defect
 * the axe gate would catch anyway, and making it a type error catches it three steps earlier.
 * `useId` wires label, input and hint together so the hint is announced, not merely displayed.
 */
export function Field({ label, hint, invalid = false, className, ...rest }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-ui text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint === undefined ? undefined : hintId}
        aria-invalid={invalid || undefined}
        className={cx(
          'h-10 px-3 font-ui text-ink bg-paper-raised',
          'rounded-[var(--radius-field)] border-[length:var(--border-hairline)]',
          invalid ? 'border-terracotta' : 'border-hairline-strong',
          className,
        )}
        {...rest}
      />
      {hint !== undefined && (
        <p
          id={hintId}
          className={cx('font-ui text-xs', invalid ? 'text-terracotta' : 'text-muted')}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
