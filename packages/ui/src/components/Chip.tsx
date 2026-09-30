import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export type ChipTone = 'neutral' | 'sage' | 'terracotta' | 'muted' | 'accent'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: ChipTone
  readonly children: ReactNode
}

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-paper-raised text-ink border-hairline-strong',
  sage: 'bg-sage-tint text-sage-ink border-transparent',
  terracotta: 'bg-terracotta-tint text-terracotta-ink border-terracotta',
  muted: 'bg-transparent text-muted border-hairline-strong',
  accent: 'bg-accent text-on-accent border-accent',
}

/**
 * A small status pill: stage, level, mode, unlock state.
 *
 * Tone is never the only signal: every chip carries text, because a learner who cannot tell the
 * colours apart must still be able to read whether an attempt passed.
 */
export function Chip({ tone = 'neutral', className, ...rest }: ChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5',
        'font-ui text-xs font-medium tabular-nums whitespace-nowrap',
        'rounded-[var(--radius-chip)] border-[length:var(--border-hairline)]',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  )
}
