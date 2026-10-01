import { cx } from '@typing-race/ui'
import type { ReactNode } from 'react'
import './screen.css'

/**
 * The parts every meta screen (Profile, Community, Settings, the reference pages) is built from,
 * in direction B: the Map's head bar, numbered white panels on the frame's paper, and at most one
 * red block per screen. Home and the Map keep their own grids; these screens share this one so
 * they read as one game client rather than five pages.
 */

export function Screen({
  className,
  children,
  ...rest
}: {
  readonly className?: string
  readonly children: ReactNode
  readonly 'data-testid'?: string
}) {
  return (
    <div className={cx('scr', className)} {...rest}>
      {children}
    </div>
  )
}

/** The head bar: the screen's one `h1`, a sentence of context, and its tabs or actions. */
export function ScreenHead({
  title,
  titleId,
  lead,
  children,
}: {
  readonly title: ReactNode
  readonly titleId?: string
  readonly lead?: ReactNode
  readonly children?: ReactNode
}) {
  return (
    <header className="scr-head">
      <h1 className="scr-head__title" id={titleId}>
        {title}
      </h1>
      {lead === undefined ? null : <p className="scr-head__lead">{lead}</p>}
      {children === undefined ? null : <div className="scr-head__actions">{children}</div>}
    </header>
  )
}

/** A numbered panel with a short title; the title names the region for a screen reader. */
export function Panel({
  id,
  n,
  title,
  meta,
  className,
  children,
  testId,
}: {
  readonly id: string
  readonly n?: number
  readonly title: ReactNode
  readonly meta?: ReactNode
  readonly className?: string
  readonly children: ReactNode
  readonly testId?: string
}) {
  return (
    <section className={cx('scr-panel', className)} aria-labelledby={id} data-testid={testId}>
      <div className="scr-panel__head">
        {n === undefined ? null : <span className="scr-idx">{String(n).padStart(2, '0')}</span>}
        <h2 className="scr-panel__title" id={id}>
          {title}
        </h2>
        {meta === undefined ? null : <span className="scr-panel__meta">{meta}</span>}
      </div>
      {children}
    </section>
  )
}
