import type { HTMLAttributes } from 'react'
import { cx } from '../cx.js'

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  /** Font size of the lettering in px; the mark scales with it. Without it: 19 px, or whatever
   * the surrounding CSS sets. */
  readonly size?: number
}

/**
 * The typographic logo: "typing race" set in the display face, followed by a red caret block,
 * the one thing every typing screen has in common. No raster image, so it is sharp at any size,
 * follows the theme's ink and costs nothing to load.
 *
 * Decorative text: the link or heading that wraps it carries the accessible name.
 */
export function Wordmark({ size, className, style, ...rest }: WordmarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex items-center font-display font-bold lowercase leading-none whitespace-nowrap',
        'tracking-[-0.05em] text-ink text-[19px]',
        className,
      )}
      style={size === undefined ? style : { fontSize: `${size}px`, ...style }}
      {...rest}
    >
      typing
      <span className="ml-[0.28em]">race</span>
      <span
        className="ml-[0.12em] inline-block h-[0.95em] w-[0.42em] translate-y-[0.04em] rounded-[0.08em] bg-accent"
        data-wordmark-caret=""
      />
    </span>
  )
}
