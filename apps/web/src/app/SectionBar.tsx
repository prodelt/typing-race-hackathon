import { Link } from '@tanstack/react-router'
import { buttonClass, cx } from '@typing-race/ui'
import { useEffect, useState } from 'react'
import { m } from '../paraglide/messages.js'

/**
 * The brand site's fixed bottom bar (b-red v4 `.pbar`): where you are on the left as `[02] Path`,
 * the page's own sections as `[01]`, `[02]`, … on the right, and the red pill.
 *
 * The sections are whatever the page marks with `data-section` (an `id` and a label), found in the
 * document rather than declared here, so a screen adds a section by marking it. The label is shown
 * as a tooltip and given as the link's description, not its name: a link named after a section
 * would compete with the page's own links of the same name.
 *
 * During an attempt the bar stays where it is and steps back, as the header does, and it stops
 * looking at the document: nothing may change outside the typing line between two keystrokes.
 */

interface Place {
  readonly n: number
  readonly label: () => string
}

/** Each screen's place in the app; the same number the screen's own `[0n]` index shows. */
function placeOf(pathname: string): Place | null {
  if (pathname.startsWith('/today')) return { n: 1, label: m.nav_today }
  if (/^\/(path|exercise|result)/.test(pathname)) return { n: 2, label: m.nav_path }
  if (pathname.startsWith('/session')) return { n: 1, label: m.session_title }
  if (pathname.startsWith('/academy')) return { n: 3, label: m.academy_nav }
  if (pathname.startsWith('/races')) return { n: 4, label: m.nav_races }
  if (pathname.startsWith('/settings')) return { n: 5, label: m.nav_settings }
  if (pathname.startsWith('/formulas')) return { n: 6, label: m.footer_formulas }
  if (pathname.startsWith('/licences')) return { n: 7, label: m.footer_licences }
  if (pathname.startsWith('/privacy')) return { n: 8, label: m.footer_privacy }
  return null
}

interface Section {
  readonly id: string
  readonly label: string
}

const two = (n: number) => `[${String(n).padStart(2, '0')}]`

function readSections(root: HTMLElement): Section[] {
  return [...root.querySelectorAll<HTMLElement>('[data-section][id]')].map((node) => ({
    id: node.id,
    label: node.dataset['section'] ?? '',
  }))
}

function same(a: readonly Section[], b: readonly Section[]): boolean {
  return a.length === b.length && a.every((s, i) => s.id === b[i]?.id && s.label === b[i]?.label)
}

export function SectionBar({
  pathname,
  dimmed,
}: {
  readonly pathname: string
  readonly dimmed: boolean
}) {
  const [sections, setSections] = useState<readonly Section[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const place = placeOf(pathname)

  // The page renders lazily, so its sections are read when the main column settles, and read again
  // whenever it changes shape. Not during an attempt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on every navigation
  useEffect(() => {
    const main = document.getElementById('main')
    if (main === null || dimmed) return
    let timer = 0
    const read = () => {
      const next = readSections(main)
      setSections((previous) => (same(previous, next) ? previous : next))
    }
    read()
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(read, 120)
    })
    observer.observe(main, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [pathname, dimmed])

  // The section in view is the one the bar marks, as the brand site's bar does.
  useEffect(() => {
    if (sections.length === 0 || dimmed || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top !== undefined) setCurrent(top.target.id)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    for (const section of sections) {
      const node = document.getElementById(section.id)
      if (node !== null) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [sections, dimmed])

  const active = sections.find((section) => section.id === current)

  return (
    <nav className="pbar" data-dimmed={dimmed || undefined} aria-label={m.bar_label()}>
      <span className="pbar__cur">
        {active !== undefined ? (
          <>
            <b>{two(sections.indexOf(active) + 1)}</b>
            {active.label}
          </>
        ) : place !== null ? (
          <>
            <b>{two(place.n)}</b>
            {place.label()}
          </>
        ) : null}
      </span>
      <div className="pbar__right">
        {sections.length > 1 && (
          <ol className="pbar__list">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  title={section.label}
                  className={cx(section.id === current && 'is-on')}
                  aria-current={section.id === current ? 'location' : undefined}
                  tabIndex={dimmed ? -1 : undefined}
                >
                  {two(i + 1)}
                  <span className="pbar__tip" aria-hidden="true">
                    {section.label}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
        {dimmed ? (
          <span aria-disabled="true" className={buttonClass('primary', 'sm')}>
            {m.nav_cta()}
          </span>
        ) : (
          <Link to="/today" className={buttonClass('primary', 'sm')}>
            {m.nav_cta()}
          </Link>
        )}
      </div>
    </nav>
  )
}
