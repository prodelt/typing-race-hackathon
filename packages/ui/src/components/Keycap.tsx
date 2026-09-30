import type { Finger } from '@typing-race/domain'
import type { CSSProperties, HTMLAttributes } from 'react'
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
 * Tier fades the whole keycap: the guide is supposed to become less eye-catching as a key is
 * learned. The letter is plain ink, so even a faded keycap stays readable.
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
        // The colours are read from custom properties set inline below, never set inline
        // themselves, so a state written to the DOM between keystrokes (the guide's awaited key)
        // can override them from a stylesheet.
        'text-[color:var(--kc-state-ink,var(--kc-ink))] bg-[color:var(--kc-state-bg,var(--kc-bg))] border-[color:var(--kc-state-line,var(--kc-line))]',
        // The inset bottom bevel: the entire tactile budget. An inset shadow rather than a
        // gradient, so it survives the low-vision theme, where gradients read as smudges.
        'shadow-[inset_0_calc(-1*var(--keycap-bevel)_-_1px)_0_0_var(--kc-state-bevel,var(--kc-bevel))]',
        'transition-[background-color,border-color,color,opacity,transform]',
        'duration-[var(--dur-quick)] ease-[var(--ease-enter)]',
        // The awaited key is the one place the keyboard uses the brand red, at full strength
        // whatever its guide tier, so the eye finds it without searching.
        awaited ? 'opacity-100 scale-105' : locked ? 'opacity-30' : TIERS[tier],
        WIDTHS[width],
        className,
      )}
      style={
        (awaited
          ? {
              '--kc-ink': 'var(--color-on-accent)',
              '--kc-bg': 'var(--color-accent)',
              '--kc-line': 'var(--color-accent-deep)',
              '--kc-bevel': 'rgb(0 0 0 / 18%)',
            }
          : locked
            ? {
                '--kc-ink': 'var(--color-muted)',
                '--kc-bg': 'var(--color-paper)',
                '--kc-line': 'var(--color-hairline)',
                '--kc-bevel': 'rgb(0 0 0 / 6%)',
              }
            : {
                // The finger is a legend, not a fill: a pale wash of its tint and a stripe of its
                // ink along the bevel. The letter stays in plain ink, the most legible it can be.
                '--kc-ink': 'var(--color-ink)',
                '--kc-bg': `color-mix(in srgb, ${tint} 72%, var(--color-paper-raised))`,
                '--kc-line': line,
                '--kc-bevel': ink,
              }) as CSSProperties
      }
      {...rest}
    >
      {width === 'space' ? '' : glyph}
    </span>
  )
}
