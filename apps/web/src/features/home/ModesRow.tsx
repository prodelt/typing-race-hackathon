import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Tip } from '../../app/Tip.js'
import { m } from '../../paraglide/messages.js'

/**
 * 06 Modes: Home's row of free-practice modes. A chunk of its own, loaded as Home renders, so the
 * cards and their copy stay out of the initial-JS budget.
 */

interface Mode {
  readonly id: string
  readonly glyph: string
  /** The glyph is a mark rather than letters, so it is drawn larger. */
  readonly mark?: boolean
  readonly name: string
  readonly sub: string
  /** The route it opens, or `onOpen` for one that starts something here. */
  readonly to?: '/daily' | '/sprint' | '/own'
  readonly onOpen?: () => void
  /** A locked mode is dimmed and says, on hover and focus, how it opens. */
  readonly locked?: string
  readonly chip?: string
}

/**
 * The free-practice modes, one quiet card each, so a learner finds them from Home rather than only
 * from the Map or the review screen. None of them earns XP or counts toward mastery, so none of
 * them competes with Continue.
 */
export function ModesRow(props: {
  readonly dailyDone: boolean
  readonly sprintOpen: boolean
  readonly onDrill: (() => void) | undefined
}) {
  const modes: readonly Mode[] = [
    {
      id: 'daily',
      glyph: String(new Date().getDate()),
      name: m.home_mode_daily(),
      sub: m.home_mode_daily_sub(),
      to: '/daily',
      ...(props.dailyDone ? { chip: m.home_mode_daily_done() } : {}),
    },
    {
      id: 'sprint',
      glyph: '60',
      name: m.home_mode_sprint(),
      sub: m.home_mode_sprint_sub(),
      ...(props.sprintOpen ? { to: '/sprint' } : { locked: m.home_mode_sprint_locked() }),
    },
    {
      id: 'own',
      glyph: m.home_mode_own_glyph(),
      name: m.home_mode_own(),
      sub: m.home_mode_own_sub(),
      to: '/own',
    },
    {
      id: 'mistakes',
      glyph: '×',
      mark: true,
      name: m.home_mode_mistakes(),
      sub: m.home_mode_mistakes_sub(),
      ...(props.onDrill === undefined
        ? { locked: m.home_mode_mistakes_locked() }
        : { onOpen: props.onDrill }),
    },
  ]

  return (
    <section
      className="hub-panel hub-modes"
      aria-labelledby="hub-modes-title"
      data-guide="home-modes"
      data-testid="home-modes"
    >
      <div className="hub-modes__head">
        <span className="hub-idx">06</span>
        <h2 className="hub-panel__title" id="hub-modes-title">
          {m.home_modes_title()}
        </h2>
        <p className="hub-modes__sub">{m.home_modes_sub()}</p>
      </div>
      <ul className="hub-modes__list">
        {modes.map((mode) => (
          <li key={mode.id} data-mode={mode.id}>
            <ModeCard mode={mode} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModeCard({ mode }: { readonly mode: Mode }) {
  const chip = mode.locked === undefined ? mode.chip : m.home_mode_locked()
  const body: ReactNode = (
    <>
      <span
        className={`hub-mode__glyph${mode.mark === true ? ' hub-mode__glyph--mark' : ''}`}
        aria-hidden="true"
      >
        {mode.glyph}
      </span>
      <span className="hub-mode__text">
        <span className="hub-mode__name">
          {mode.name}
          {chip === undefined ? null : (
            <>
              {' '}
              <span className={`hub-mode__chip${mode.locked === undefined ? ' is-done' : ''}`}>
                {chip}
              </span>
            </>
          )}
        </span>
        <span className="hub-mode__sub">{mode.sub}</span>
      </span>
    </>
  )
  if (mode.locked !== undefined) {
    return (
      <Tip text={mode.locked} above>
        <button type="button" className="hub-mode is-locked" aria-disabled="true">
          {body}
        </button>
      </Tip>
    )
  }
  if (mode.to !== undefined) {
    return (
      <Link to={mode.to} className="hub-mode">
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className="hub-mode" onClick={mode.onOpen}>
      {body}
    </button>
  )
}
