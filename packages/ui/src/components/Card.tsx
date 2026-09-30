import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode
  /** Lifts the card off the page for the one element a screen wants read first. */
  readonly raised?: boolean
}

/**
 * A near-white surface on the grey canvas, with a large radius.
 *
 * The separation is mostly lightness: a hairline that is barely there in the light theme and
 * becomes a real 2px border in the low-vision one. Only a `raised` card gets a shadow, so a
 * screen of several cards reads as a page rather than as a stack of floating tiles.
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
