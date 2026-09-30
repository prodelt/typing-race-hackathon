import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  cx,
  IconLeaderboard,
  IconPath,
  IconRace,
  IconReview,
  IconStats,
  IconToday,
  Mark,
} from '@typing-race/ui'
import type { ComponentType } from 'react'
import { m } from '../paraglide/messages.js'
import { BootGate } from './BootGate.js'
import { CommandPalette } from './CommandPalette.js'
import { useAppStore } from './state/index.js'

/**
 * T060. The app shell.
 *
 * Two rules from the specification shape everything here:
 *
 * - **FR-055**: all six destinations are present, and the ones F1 does not build are *disabled*,
 *   not removed. A navigation that grows over five features teaches the learner a new layout each
 *   time; one that is complete from the first release teaches it once. It also keeps the
 *   requirements' §9 demo route intact, since the jury can see where the rest will live.
 * - **FR-057**: during an attempt the navigation stays put and **dims**, with a note saying it is
 *   muted until the attempt ends. Removing it would reflow the page mid-keystroke, and FR-069 says
 *   nothing outside the typing line may change between two keystrokes.
 */

interface Destination {
  readonly to: string
  readonly label: string
  readonly icon: ComponentType<{ size?: number }>
  /** Arrives with a later feature. Present and disabled — FR-055. */
  readonly arrivesIn?: string
}

const DESTINATIONS: Destination[] = [
  { to: '/today', label: 'nav_today', icon: IconToday },
  { to: '/path', label: 'nav_path', icon: IconPath },
  { to: '/review', label: 'nav_review', icon: IconReview, arrivesIn: 'F4' },
  { to: '/races', label: 'nav_races', icon: IconRace, arrivesIn: 'F5' },
  { to: '/leaderboards', label: 'nav_leaderboards', icon: IconLeaderboard, arrivesIn: 'F5' },
  { to: '/statistics', label: 'nav_statistics', icon: IconStats, arrivesIn: 'F4' },
]

const NAV_LABELS: Record<string, () => string> = {
  nav_today: m.nav_today,
  nav_path: m.nav_path,
  nav_review: m.nav_review,
  nav_races: m.nav_races,
  nav_leaderboards: m.nav_leaderboards,
  nav_statistics: m.nav_statistics,
}

function PrimaryNavigation({ dimmed }: { readonly dimmed: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label={m.nav_primary()}
      className={cx(
        'flex items-center gap-1',
        'transition-opacity duration-[var(--dur-base)] ease-[var(--ease-standard)]',
        dimmed && 'opacity-45',
      )}
    >
      {DESTINATIONS.map(({ to, label, icon: Icon, arrivesIn }) => {
        const disabled = arrivesIn !== undefined || dimmed
        const active = pathname.startsWith(to)
        const text = NAV_LABELS[label]?.() ?? label

        const className = cx(
          'inline-flex items-center gap-2 h-9 px-3 font-ui text-sm rounded-[var(--radius-chip)]',
          'transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)]',
          active ? 'bg-sage-tint text-sage font-semibold' : 'text-ink hover:bg-sage-tint',
          disabled && 'pointer-events-none text-nav-dimmed',
        )

        // A disabled destination is still announced, with its reason — "present but not yet
        // available" is information, and hiding it would make the nav silently incomplete.
        return disabled ? (
          <span
            key={to}
            aria-disabled="true"
            title={arrivesIn === undefined ? undefined : m.nav_arrives_later()}
            className={className}
          >
            <Icon size={18} />
            {text}
          </span>
        ) : (
          <Link key={to} to={to} className={className}>
            <Icon size={18} />
            {text}
          </Link>
        )
      })}
    </nav>
  )
}

export function Shell() {
  const attemptInProgress = useAppStore((state) => state.attemptInProgress)

  return (
    <div className="min-h-dvh flex flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded-[var(--radius-field)] focus:bg-paper-raised focus:px-3 focus:py-2"
      >
        {m.skip_to_content()}
      </a>

      <header className="border-b-[length:var(--border-hairline)] border-hairline">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link to="/" className="flex items-center gap-2 font-ui font-bold">
            <Mark size={26} />
            <span>{m.app_name()}</span>
          </Link>
          <PrimaryNavigation dimmed={attemptInProgress} />
        </div>
        {attemptInProgress && (
          // FR-057: not merely dimmed — it says why, in the mono voice the design uses for
          // machine-state notes.
          <p
            role="status"
            className="border-t-[length:var(--border-hairline)] border-hairline bg-sage-tint/40 px-6 py-1 text-center font-mono text-xs text-muted"
          >
            {m.nav_muted_during_attempt()}
          </p>
        )}
      </header>

      {/*
        FR-067. Below 1024 px the learner is *told the target platform*, not shown a broken typing
        line. A media query rather than a JavaScript check, because it must be right on the first
        paint and must follow a window resize with no re-render — and because the typing screen
        below it is genuinely unusable, not merely cramped: ticket 20's rail plus a full keyboard
        guide does not fit, and a squeezed guide teaches the wrong finger positions.
      */}
      <div className="hidden max-[1023px]:block px-6 py-10">
        <p className="mx-auto max-w-md text-center font-ui leading-relaxed text-ink">
          {m.narrow_window_notice()}
        </p>
      </div>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 max-[1023px]:hidden">
        <BootGate>
          <Outlet />
        </BootGate>
      </main>

      <CommandPalette />

      <footer className="border-t-[length:var(--border-hairline)] border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-4 font-ui text-xs text-muted">
          <Link to="/formulas" className="hover:text-sage">
            {m.footer_formulas()}
          </Link>
          <Link to="/licences" className="hover:text-sage">
            {m.footer_licences()}
          </Link>
          <Link to="/privacy" className="hover:text-sage">
            {m.footer_privacy()}
          </Link>
          <Link to="/about" className="hover:text-sage">
            {m.footer_about()}
          </Link>
          <span className="ml-auto font-mono">{m.footer_note()}</span>
        </div>
      </footer>
    </div>
  )
}
