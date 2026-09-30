import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly children: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-sage text-paper border-sage hover:brightness-110',
  secondary: 'bg-paper-raised text-ink border-hairline-strong hover:bg-sage-tint',
  quiet: 'bg-transparent text-ink border-transparent hover:bg-sage-tint',
  danger: 'bg-terracotta text-paper border-terracotta hover:brightness-110',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-[0.95rem]',
  lg: 'h-12 px-6 text-base',
}

/**
 * T029. The one button.
 *
 * `type` defaults to `button`, not `submit`: most of these live outside a form, and an
 * accidental submit on the settings screen would reload the app mid-attempt.
 *
 * Focus is never styled away — `themes.css` gives `:focus-visible` a 3px sage outline in all three
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
      className={cx(
        'inline-flex items-center justify-center gap-2 font-ui font-semibold',
        'rounded-[var(--radius-field)] border-[length:var(--border-hairline)]',
        'transition-[background-color,color,filter] ease-[var(--ease-standard)]',
        'duration-[var(--dur-base)] disabled:opacity-50 disabled:pointer-events-none',
        'cursor-pointer select-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  )
}
