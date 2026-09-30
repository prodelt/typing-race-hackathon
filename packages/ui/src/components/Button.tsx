import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly children: ReactNode
}

/**
 * Primary is the red pill: the one thing a screen most wants pressed, so a screen should have at
 * most one. Secondary is a light pill with a visible edge, because it often sits on a near-white
 * surface where a borderless light pill would disappear.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent border-accent hover:bg-accent-deep hover:border-accent-deep',
  secondary:
    'bg-paper-raised text-ink border-hairline-strong hover:border-ink hover:bg-paper-raised',
  quiet: 'bg-transparent text-ink border-transparent hover:bg-paper-deep',
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
    'inline-flex items-center justify-center gap-2 font-ui font-semibold tracking-[-0.01em]',
    'whitespace-nowrap no-underline select-none cursor-pointer',
    'rounded-[var(--radius-pill)] border-[length:var(--border-hairline)]',
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
  className,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(buttonClass(variant, size), className)}
      {...rest}
    />
  )
}
