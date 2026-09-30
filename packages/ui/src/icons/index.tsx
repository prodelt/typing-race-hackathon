import type { SVGProps } from 'react'

/**
 * T030. The icon set and the mark, from ticket 20's Identity board.
 *
 * Hand-written inline SVG rather than an icon package: the set is eleven glyphs, every one of
 * them is in the initial bundle, and an icon library's tree-shaken output is still larger than
 * this file. `currentColor` throughout, so a single `text-*` class themes them all.
 *
 * Every icon is `aria-hidden` by default. An icon that carries meaning on its own is a defect —
 * the button next to it has the label.
 */

export type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number }

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Today — the daily practice screen. */
export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
)

/** Path — the key unlock ladder. */
export const IconPath = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 20v-4a4 4 0 0 1 4-4h4a4 4 0 0 0 4-4V4" />
    <circle cx="6" cy="20" r="2" />
    <circle cx="18" cy="4" r="2" />
  </Icon>
)

/** Review — the Academy and error work. */
export const IconReview = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M9 8h6M9 12h4" />
  </Icon>
)

/** Races. */
export const IconRace = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />
  </Icon>
)

/** Leaderboards. */
export const IconLeaderboard = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21h16M7 21v-7M12 21V6M17 21v-4" />
  </Icon>
)

/** Statistics. */
export const IconStats = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19 9 12l4 4 7-9" />
    <path d="M20 7v5h-5" />
  </Icon>
)

/** The keyboard guide. */
export const IconKeyboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </Icon>
)

/** A key unlocking. */
export const IconUnlock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </Icon>
)

/** Zero-peek: the guide is hidden. */
export const IconZeroPeek = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.4" />
    <path d="M6.3 7.3C3.9 8.9 3 11.2 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.35 3.8-.9" />
  </Icon>
)

/** Settings. */
export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Icon>
)

/** The one next action. */
export const IconNextAction = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8 5 4-5 4z" />
  </Icon>
)

/**
 * The product mark: a caret resting on a baseline. It reads at 16px and at 96px, which is the
 * only real requirement — it appears in the browser tab and on the product page and nowhere else.
 */
export function Mark({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--color-sage-tint)" />
      <rect x="14.6" y="7" width="2.8" height="14" rx="1.4" fill="var(--color-sage)" />
      <rect x="8" y="23" width="16" height="2.4" rx="1.2" fill="var(--color-terracotta)" />
    </svg>
  )
}
