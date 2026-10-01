import { Link } from '@tanstack/react-router'
import { IconFlag, IconHome, IconMap, IconPeople, IconUser } from '@typing-race/ui'
import type { ComponentType } from 'react'
import { m } from '../paraglide/messages.js'
import { DESTINATIONS, type DestinationId } from './destinations.js'

/**
 * The rail: the brand mark, the five destinations with their index numbers and key hints, and a
 * footer with the season card. On a phone the same element becomes the bottom dock (`shell.css`).
 */

const LABELS: Record<DestinationId, () => string> = {
  home: m.shell_dest_home,
  map: m.shell_dest_map,
  races: m.shell_dest_races,
  community: m.shell_dest_community,
  profile: m.shell_dest_profile,
}

const ICONS: Record<DestinationId, ComponentType<{ size?: number; className?: string }>> = {
  home: IconHome,
  map: IconMap,
  races: IconFlag,
  community: IconPeople,
  profile: IconUser,
}

/** Seasons are calendar months, counted from the first one, October 2026. */
export function seasonOf(now: Date): { number: number; daysLeft: number; elapsed: number } {
  const number = Math.max(1, (now.getFullYear() - 2026) * 12 + (now.getMonth() - 9) + 1)
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const day = now.getDate()
  return { number, daysLeft: days - day + 1, elapsed: (day - 1) / days }
}

export function Rail({
  active,
  online,
}: {
  readonly active: DestinationId | null
  /** Racers online now; `null` hides the line rather than inventing a number. */
  readonly online: number | null
}) {
  const season = seasonOf(new Date())

  return (
    <nav className="rail" aria-label={m.nav_primary()}>
      <div className="rail__brand">
        <Link to="/" className="rail__mark" aria-label={m.shell_brand()}>
          <span aria-hidden="true">ТР</span>
        </Link>
      </div>

      <div className="rail__nav">
        {DESTINATIONS.map(({ id, key, to }) => {
          const Icon = ICONS[id]
          const label = LABELS[id]()
          const current = id === active
          return (
            <Link
              key={id}
              to={to}
              className="rail__item"
              aria-current={current ? 'page' : undefined}
              aria-keyshortcuts={String(key)}
              title={m.shell_dest_key_hint({ name: label, key: String(key) })}
              data-destination={id}
            >
              <span className="rail__n" aria-hidden="true">
                {String(key).padStart(2, '0')}
              </span>
              <Icon size={24} className="rail__icon" />
              <span className="rail__label">{label}</span>
            </Link>
          )
        })}
      </div>

      <div className="rail__foot">
        <div className="season tip" title={m.shell_season_hint()}>
          <span className="season__lab">{m.shell_season()}</span>
          <span className="season__n">{String(season.number).padStart(2, '0')}</span>
          <small>{m.shell_season_left({ days: String(season.daysLeft) })}</small>
          <i className="season__bar" aria-hidden="true">
            <b style={{ width: `${Math.round(season.elapsed * 100)}%` }} />
          </i>
        </div>
        {online === null ? null : (
          <p className="online">
            <span className="online__dot" aria-hidden="true" />
            {m.shell_online()} <b>{online}</b>
          </p>
        )}
      </div>
    </nav>
  )
}
