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

/* ---- The game shell's glyphs (prototype b-red) ------------------------------------------- */

/** Home, rail destination 01. */
export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7V20.5h-5.5v-6h-6v6H3.5z" />
  </Icon>
)

/** Map, rail destination 02. */
export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14" />
  </Icon>
)

/** Races, rail destination 03: a flag with a dash forward. */
export const IconFlag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    <path d="M19 15l2 2-2 2M15 17h6" />
  </Icon>
)

/** Community, rail destination 04. */
export const IconPeople = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16.5 14.5c2.4.2 4.2 1.8 5 4.5" />
  </Icon>
)

/** Profile, rail destination 05. */
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6" />
  </Icon>
)

/** A streak freeze. */
export const IconSnow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" />
  </Icon>
)

/** The race rating. */
export const IconSwords = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4l11 11M13 17l4-4M16.5 16.5 20 20M20 4 9 15M11 17l-4-4M7.5 16.5 4 20" />
  </Icon>
)

/** Sound on. */
export const IconVolume = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
)

/** Sound off. */
export const IconVolumeOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
)

/** The settings cog. */
export const IconCog = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9 1.65 1.65 0 0 0 20.83 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
)

/** «Про гру»: an i in a circle. */
export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </Icon>
)

/** The streak flame — filled, the one solid glyph. */
export const IconFlame = ({ size = 24, ...rest }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M12 22.5c4.1 0 7.2-2.9 7.2-6.9 0-3.3-2-5.8-3.7-7.6-.3 2-1.3 3.3-2.5 3.7.4-3.7-1.2-7-4.1-9.7.2 3.5-1.6 5.8-3.3 7.8C4.3 11.4 4.8 13 4.8 15.6c0 4 3.1 6.9 7.2 6.9z" />
  </svg>
)

/** The Google "G", in its own colours. */
export const IconGoogle = ({ size = 16, ...rest }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"
    />
    <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z" />
    <path
      fill="#EA4335"
      d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
    />
  </svg>
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
