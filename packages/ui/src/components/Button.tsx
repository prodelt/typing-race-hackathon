import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  /** A key hint drawn inside the button, in the one `.kbd` style (e.g. `Enter`). */
  readonly hint?: string
  readonly children: ReactNode
}

/**
 * One button vocabulary for the whole game client:
 *
 * - **primary** — the red pill. The one thing a screen most wants pressed; at most one per screen.
 *   Red is otherwise reserved for the caret, errors and the awaited key.
 * - **secondary** — a 2 px ink-outline pill that fills with ink on hover.
 * - **quiet** — the tertiary action: a text link, underlined, no fill.
 *
 * All three carry key hints in the same `.kbd` style.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'btn-primary bg-accent text-on-accent border-accent hover:bg-accent-deep hover:border-accent-deep',
  secondary:
    'btn-secondary bg-transparent text-ink border-ink hover:bg-ink hover:text-paper-raised',
  quiet:
    'btn-quiet bg-transparent text-ink border-transparent underline underline-offset-4 decoration-[1.5px] hover:text-accent-deep',
  danger: 'bg-transparent text-terracotta-ink border-terracotta hover:bg-terracotta-tint',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-[18px] text-sm',
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-[52px] px-[26px] text-base',
}

/** The same look for an element that is not a `<button>`: a router link styled as a button. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2.5 font-ui font-semibold tracking-[-0.01em]',
    'whitespace-nowrap select-none cursor-pointer',
    variant === 'quiet' ? '' : 'no-underline',
    'rounded-[var(--radius-pill)]',
    // The outline pill is 2 px of ink in every theme; the others follow the theme's hairline.
    variant === 'secondary' ? 'border-2' : 'border-[length:var(--border-hairline)]',
    'transition-[background-color,border-color,color,transform] ease-[var(--ease-enter)]',
    'duration-[var(--dur-base)] active:scale-[0.98]',
    'disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
  )
}

/**
 * The one button.
 *
 * `type` defaults to `button`, not `submit`: most of these live outside a form, and an
 * accidental submit on the settings screen would reload the app mid-attempt.
 *
 * Focus is never styled away: `themes.css` gives `:focus-visible` a 3px offset ring in all three
 * themes, and nothing here overrides it.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  hint,
  className,
  type,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={cx(buttonClass(variant, size), className)} {...rest}>
      {children}
      {hint === undefined ? null : (
        <span className="kbd" aria-hidden="true">
          {hint}
        </span>
      )}
    </button>
  )
}
