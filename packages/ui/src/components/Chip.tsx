import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.js'

export type ChipTone = 'neutral' | 'sage' | 'terracotta' | 'muted'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: ChipTone
  readonly children: ReactNode
}

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-paper text-ink border-hairline-strong',
  sage: 'bg-sage-tint text-sage border-sage',
  terracotta: 'bg-terracotta-tint text-terracotta border-terracotta',
  muted: 'bg-transparent text-muted border-hairline',
}

/**
 * T029. A small status label: stage, level, mode, unlock state.
 *
 * Tone is never the only signal — every chip carries text, because a learner who cannot
 * distinguish sage from terracotta must still be able to read whether an attempt passed.
 */
export function Chip({ tone = 'neutral', className, ...rest }: ChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5',
        'font-mono text-xs tracking-tight whitespace-nowrap',
        'rounded-[var(--radius-chip)] border-[length:var(--border-hairline)]',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  )
}
