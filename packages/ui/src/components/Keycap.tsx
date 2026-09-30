import type { Finger } from '@typing-race/domain'
import type { HTMLAttributes } from 'react'
import { cx } from '../cx.js'

/**
 * How strongly the guide draws a key. Ticket 20's UX addendum: the keyboard guide fades tier by
 * tier as confidence grows, rather than disappearing at one threshold — a key you have half
 * learned should be half prompted.
 */
export type GuideTier = 'locked' | 'learning' | 'familiar' | 'confident'

export interface KeycapProps extends HTMLAttributes<HTMLSpanElement> {
  /** The character the key produces. Rendered as itself — never transliterated (FR-006). */
  readonly glyph: string
  readonly finger: Finger
  readonly tier?: GuideTier
  /** The key the engine is waiting for. At most one keycap on screen may set this. */
  readonly awaited?: boolean
  /** The learner has not unlocked this key yet. */
  readonly locked?: boolean
  readonly width?: 'unit' | 'wide' | 'space'
}

/**
 * Tier fades the *tint*, not the glyph. The letter stays at full finger ink at every tier,
 * because the guide is supposed to become less eye-catching, not less readable.
 */
const TIERS: Record<GuideTier, string> = {
  locked: 'opacity-35',
  learning: 'opacity-100',
  familiar: 'opacity-70',
  confident: 'opacity-40',
}

const WIDTHS = {
  unit: 'w-11',
  wide: 'w-16',
  space: 'w-56',
} as const

export function Keycap({
  glyph,
  finger,
  tier = 'learning',
  awaited = false,
  locked = false,
  width = 'unit',
  className,
  ...rest
}: KeycapProps) {
  const ink = `var(--color-finger-${finger}-ink)`
  const tint = `var(--color-finger-${finger}-tint)`
  const line = `var(--color-finger-${finger}-line)`

  return (
    <span
      // Decorative by default: the guide repeats what the typing line already says, and a screen
      // reader announcing sixty keycaps would bury it. The awaited key is the exception worth
      // announcing, and the exercise screen labels that one itself.
      aria-hidden={!awaited}
      className={cx(
        'inline-flex items-center justify-center select-none',
        'h-11 font-ui font-medium text-[0.95rem] leading-none',
        'rounded-[var(--radius-keycap)] border-[length:var(--border-hairline)]',
        // The 2px inset bottom bevel: the entire tactile budget. An inset shadow rather than a
        // gradient, so it survives the low-vision theme, where gradients read as smudges.
        'shadow-[inset_0_calc(-1*var(--keycap-bevel))_0_0_rgb(0_0_0/8%)]',
        'transition-[background-color,border-color,color,opacity,transform]',
        'duration-[var(--dur-quick)] ease-[var(--ease-enter)]',
        // The awaited key is the one place the keyboard uses the brand red, at full strength
        // whatever its guide tier, so the eye finds it without searching.
        awaited ? 'opacity-100 scale-105' : locked ? 'opacity-30' : TIERS[tier],
        WIDTHS[width],
        className,
      )}
      style={
        awaited
          ? {
              color: 'var(--color-on-accent)',
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-accent-deep)',
            }
          : {
              color: locked ? 'var(--color-muted)' : ink,
              backgroundColor: locked ? 'var(--color-paper)' : tint,
              borderColor: locked ? 'var(--color-hairline)' : line,
            }
      }
      {...rest}
    >
      {width === 'space' ? '' : glyph}
    </span>
  )
}
