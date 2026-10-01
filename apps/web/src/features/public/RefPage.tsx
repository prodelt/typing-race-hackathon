import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Screen, ScreenHead } from '../../app/Screen.js'
import { m } from '../../paraglide/messages.js'
import './reference.css'

/**
 * The reference pages of the «Про гру» menu — Formulas, Licences, Privacy, About the project — as
 * one readable layout inside the game frame: the head bar, a narrow side panel with the menu's
 * pages (and, on a long page, its sections), and the text in a white panel set to a reading
 * measure. The stage scrolls; the side panel stays put while it does.
 */

type RefPath = '/about/project' | '/formulas' | '/licences' | '/privacy'

const PAGES: readonly { readonly to: RefPath | '/about'; readonly label: () => string }[] = [
  { to: '/about', label: m.shell_menu_about },
  { to: '/about/project', label: m.shell_menu_project },
  { to: '/formulas', label: m.shell_menu_formulas },
  { to: '/licences', label: m.shell_menu_licences },
  { to: '/privacy', label: m.shell_menu_privacy },
]

export interface TocEntry {
  readonly id: string
  readonly label: string
}

export function RefPage({
  title,
  lead,
  current,
  toc,
  tocLabel,
  children,
}: {
  readonly title: string
  readonly lead?: ReactNode
  readonly current: RefPath
  readonly toc?: readonly TocEntry[]
  readonly tocLabel?: string
  readonly children: ReactNode
}) {
  return (
    <Screen className="ref scr--fill">
      <ScreenHead title={title} lead={lead} />
      <div className="ref-grid">
        <aside className="scr-panel ref-aside">
          <div className="ref-aside__in">
            <nav aria-label={m.shell_menu()} className="ref-nav">
              <p className="ref-nav__title">{m.shell_menu()}</p>
              <ul>
                {PAGES.map((page) => (
                  <li key={page.to}>
                    <Link
                      to={page.to}
                      className="ref-nav__link"
                      // Exact: `/about` is the product page, not the parent of `/about/project`.
                      activeOptions={{ exact: true }}
                      aria-current={page.to === current ? 'page' : undefined}
                    >
                      {page.label()}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {toc === undefined ? null : (
              <nav aria-label={tocLabel} className="ref-nav ref-nav--toc">
                <p className="ref-nav__title">{tocLabel}</p>
                <ol>
                  {toc.map((entry, index) => (
                    <li key={entry.id}>
                      <a className="ref-nav__link" href={`#${entry.id}`}>
                        <span className="ref-nav__n">{String(index + 1).padStart(2, '0')}</span>
                        {entry.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>
        </aside>
        <article className="scr-panel ref-read">{children}</article>
      </div>
    </Screen>
  )
}
