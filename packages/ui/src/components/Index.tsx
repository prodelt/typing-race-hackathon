import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export interface IndexProps extends HTMLAttributes<HTMLSpanElement> {
  /** 1-based position; rendered two digits wide, in brackets: `[01]`. */
  readonly n: number
  /** Optional label after the number, e.g. the section's name. */
  readonly children?: ReactNode
}

/**
 * The bracketed index label, `[01] Method`: how a step, a stage or a section says where it sits
 * in a sequence. The number is the red half, the label the ink half.
 */
export function Index({ n, children, className, ...rest }: IndexProps) {
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-2 font-ui text-sm font-medium tabular-nums',
        className,
      )}
      {...rest}
    >
      <span className="index__n text-terracotta-ink">[{String(n).padStart(2, '0')}]</span>
      {children !== undefined && <span>{children}</span>}
    </span>
  )
}
