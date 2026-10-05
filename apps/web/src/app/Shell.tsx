import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AccountNotices } from '../features/account/ui.js'
import { m } from '../paraglide/messages.js'
import { BootGate } from './BootGate.js'
import { CommandPalette } from './CommandPalette.js'
import { DESTINATIONS, destinationOf, isOutsideFrame, needsKeyboard } from './destinations.js'
import { GuideHost } from './guide/GuideHost.js'
import { LiveGradient } from './LiveGradient.js'
import { usePlayMode } from './playMode.js'
import { Rail } from './Rail.js'
import { StatusBar } from './StatusBar.js'
import './shell.css'

/**
 * The game client's frame: a fixed, full-height grid of the rail, the status bar and the stage.
 *
 * - The **stage** never scrolls as a page; the screen inside it scrolls in its own panel.
 * - In **Play Mode** (an attempt or a race running) the rail and the status bar leave the screen
 *   with a short animated exit, and only the run remains. The change happens once, at Start,
 *   before the first keystroke — never between two keystrokes.
 * - Keys **1–5** switch destinations when focus is not in a field or the typing surface and Play
 *   Mode is off.
 * - On a **phone** the rail is a bottom dock, and training routes show a calm notice: touch typing
 *   needs a physical keyboard.
 */

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target.closest('input, textarea, select, [contenteditable=""], dialog, [role="dialog"]') !==
    null
  )
}

/** Keys 1–5 open the five destinations. */
function useDestinationKeys(enabled: boolean): void {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditable(event.target)) return
      const destination = DESTINATIONS.find((d) => String(d.key) === event.key)
      if (destination === undefined) return
      event.preventDefault()
      void navigate({ to: destination.to })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, navigate])
}

export function Shell() {
  const play = usePlayMode()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const active = destinationOf(pathname)
  useDestinationKeys(!play)

  if (isOutsideFrame(pathname)) {
    // The product page keeps its own full-bleed, scrolling layout.
    return (
      <div className="landing">
        <main id="main">
          <BootGate>
            <Outlet />
          </BootGate>
        </main>
        <AccountNotices />
      </div>
    )
  }

  return (
    <div
      className="frame"
      data-play={play || undefined}
      data-needs-keyboard={needsKeyboard(pathname) || undefined}
    >
      <a href="#main" className="skip">
        {m.skip_to_content()}
      </a>

      <div className="frame__rail" inert={play || undefined}>
        <Rail active={active} online={null} />
      </div>

      <div className="frame__bar" inert={play || undefined}>
        <StatusBar settingsActive={pathname.startsWith('/settings')} />
      </div>

      <main id="main" className="stage">
        <div className="stage__in">
          <LiveGradient tone={play ? 'soft' : 'bright'} />
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard */}
          <div className="stage__scroll" data-stage-scroll="" tabIndex={0}>
            <div className="stage__content">
              <BootGate>
                <Outlet />
              </BootGate>
            </div>
          </div>
          <section className="keyboard-needed" aria-labelledby="keyboard-needed-title">
            <span className="keyboard-needed__mark" aria-hidden="true">
              ТР
            </span>
            <h1 id="keyboard-needed-title">{m.shell_keyboard_title()}</h1>
            <p>{m.shell_keyboard_body()}</p>
            <div className="keyboard-needed__links">
              <Link to="/profile">{m.shell_dest_profile()}</Link>
              <Link to="/leaderboards">{m.shell_tab_leaderboards()}</Link>
              <Link to="/races">{m.shell_dest_races()}</Link>
            </div>
          </section>
        </div>
      </main>

      <CommandPalette />
      <AccountNotices />
      <GuideHost />
    </div>
  )
}
