import { cx, Index } from '@typing-race/ui'
import type { CSSProperties, ReactNode } from 'react'
import './screen.css'

/** `--i` orders a staggered arrival; typed once here instead of cast at every use. */
export function order(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

export interface ScreenHeadProps {
  /** The screen's place in the app, rendered as `[01] label` above the title. */
  readonly n: number
  readonly label: string
  readonly title: ReactNode
  readonly titleId?: string
  readonly lede?: ReactNode
  /** Ends the title with the brand's red full stop. */
  readonly dot?: boolean
  readonly small?: boolean
  readonly children?: ReactNode
  readonly className?: string
}

/**
 * The head every learning screen opens with, the way each section of the brand site does: a
 * bracketed index, a huge Unbounded title, one lede in Onest. The title is the page's `h1`.
 */
export function ScreenHead({
  n,
  label,
  title,
  titleId,
  lede,
  dot = false,
  small = false,
  children,
  className,
}: ScreenHeadProps) {
  return (
    <header className={cx('screen-head', className)}>
      <Index n={n}>{label}</Index>
      <h1 id={titleId} className={cx('screen-title', small && 'screen-title--sm')}>
        {title}
        {dot && <span className="red-dot" aria-hidden="true" />}
      </h1>
      {lede !== undefined && <p className="screen-lede">{lede}</p>}
      {children}
    </header>
  )
}

/** The arrow of the poster button and the pill links: a drawn line, not a glyph. */
export function Arrow({ size = 32 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round((size * 24) / 44)}
      viewBox="0 0 44 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 12h40M30 2l10 10-10 10" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}

/** The check mark inside a chosen pill. */
export function Check() {
  return (
    <svg
      className="pill__check"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 7.5 5.5 11 12 3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
