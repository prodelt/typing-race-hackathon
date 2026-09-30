import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode
  /** Lifts the card off the page for the one element a screen wants read first. */
  readonly raised?: boolean
}

/**
 * T029. The paper surface: a 1px hairline plus a two-layer shadow, 18px radius (ticket 20).
 *
 * That is the entire paper effect. No gradient, no texture image — the "tactile" budget is spent
 * on the keycap bevel, and a card that also competes for attention would make a screen of six
 * cards look like a dashboard rather than a page.
 */
export function Card({ raised = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'bg-paper-raised rounded-[var(--radius-card)]',
        'border-[length:var(--border-hairline)] border-hairline',
        raised ? 'shadow-[var(--shadow-raised)]' : 'shadow-[var(--shadow-paper)]',
        className,
      )}
      {...rest}
    />
  )
}
