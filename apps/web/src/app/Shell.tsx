import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import { buttonClass, cx, IconSettings, Wordmark } from '@typing-race/ui'
import { m } from '../paraglide/messages.js'
import { setLocale } from '../paraglide/runtime.js'
import { BootGate } from './BootGate.js'
import { CommandPalette } from './CommandPalette.js'
import { useAppStore } from './state/index.js'
import './shell.css'

/**
 * The app shell: a header in the shape of the brand site's (wordmark left, a quiet text nav, the
 * language switch and one red pill), the main column, and a small footer.
 *
 * Two rules shape everything here:
 *
 * - All six destinations are present, and the ones not built yet are *disabled*, not removed. A
 *   navigation that grows feature by feature teaches the learner a new layout each time; one that
 *   is complete from the first release teaches it once.
 * - During an attempt the header stays put and **dims**, with a note saying it is muted until the
 *   attempt ends. Removing it would reflow the page mid-keystroke, and nothing outside the typing
 *   line may change between two keystrokes.
 */

interface Destination {
  readonly to: string
  readonly label: () => string
  /** Arrives with a later release. Present and disabled. */
  readonly later?: boolean
}

const DESTINATIONS: Destination[] = [
  { to: '/today', label: m.nav_today },
  { to: '/path', label: m.nav_path },
  { to: '/academy', label: m.academy_nav },
  { to: '/review', label: m.nav_review, later: true },
  { to: '/races', label: m.nav_races, later: true },
  { to: '/leaderboards', label: m.nav_leaderboards, later: true },
  { to: '/statistics', label: m.nav_statistics, later: true },
]

function PrimaryNavigation({
  pathname,
  dimmed,
}: {
  readonly pathname: string
  readonly dimmed: boolean
}) {
  return (
    <nav aria-label={m.nav_primary()} className="shell-nav">
      {DESTINATIONS.map(({ to, label, later }) => {
        const disabled = later === true || dimmed
        const active = pathname.startsWith(to)
        const text = label()

        // A disabled destination is still announced, with its reason: "present but not yet
        // available" is information, and hiding it would make the nav silently incomplete.
        return disabled ? (
          <span
            key={to}
            aria-disabled="true"
            title={later === true ? m.nav_arrives_later() : undefined}
            className={cx('shell-nav__link', later === true && 'shell-nav__link--later')}
            data-active={active || undefined}
          >
            {text}
          </span>
        ) : (
          <Link
            key={to}
            to={to}
            className="shell-nav__link"
            data-active={active || undefined}
            aria-current={active ? 'page' : undefined}
          >
            {text}
          </Link>
        )
      })}
    </nav>
  )
}

const LANGUAGES: readonly { readonly value: Language; readonly short: string }[] = [
  { value: 'uk', short: 'UA' },
  { value: 'en', short: 'EN' },
]

/**
 * UA / EN, as on the brand site. Persisted first, then Paraglide's locale switched, which reloads
 * the document: the one way every already-rendered string is guaranteed to switch. The same order
 * the settings screen uses, for the same reason: the reload must not race the write.
 */
function LanguageSwitch({ disabled }: { readonly disabled: boolean }) {
  const current = useAppStore((state) => state.settings.interfaceLanguage)
  const changeSettings = useAppStore((state) => state.changeSettings)

  async function choose(language: Language): Promise<void> {
    if (language === current) return
    await changeSettings({ interfaceLanguage: language })
    await setLocale(language)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, not a fieldset of inputs
    <div role="group" aria-label={m.nav_language()} className="shell-lang">
      {LANGUAGES.map(({ value, short }) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={value === current}
          disabled={disabled}
          onClick={() => void choose(value)}
          className="shell-lang__option"
        >
          {short}
        </button>
      ))}
    </div>
  )
}

export function Shell() {
  const attemptInProgress = useAppStore((state) => state.attemptInProgress)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // The product page is a full-bleed landing page; every other screen is an app column.
  const landing = pathname === '/'

  return (
    <div className="shell" data-landing={landing || undefined}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-[var(--radius-pill)] focus:bg-ink focus:px-4 focus:py-2.5 focus:text-paper"
      >
        {m.skip_to_content()}
      </a>

      <header className="shell-head" data-dimmed={attemptInProgress || undefined}>
        <div className="shell-head__inner shell-container">
          <Link to="/" className="shell-head__logo" aria-label={m.nav_home()}>
            <Wordmark />
          </Link>

          <PrimaryNavigation pathname={pathname} dimmed={attemptInProgress} />

          <div className="shell-head__right">
            {attemptInProgress ? (
              <span aria-disabled="true" className="shell-head__settings">
                <IconSettings size={18} />
                <span className="shell-head__settings-label">{m.nav_settings()}</span>
              </span>
            ) : (
              <Link
                to="/settings"
                className="shell-head__settings"
                data-active={pathname.startsWith('/settings') || undefined}
              >
                <IconSettings size={18} />
                <span className="shell-head__settings-label">{m.nav_settings()}</span>
              </Link>
            )}
            <LanguageSwitch disabled={attemptInProgress} />
            {attemptInProgress ? (
              <span aria-disabled="true" className={buttonClass('primary', 'sm')}>
                {m.nav_cta()}
              </span>
            ) : (
              <Link to="/today" className={buttonClass('primary', 'sm')}>
                {m.nav_cta()}
              </Link>
            )}
          </div>
        </div>
        {attemptInProgress && (
          // Not merely dimmed: it says why.
          <p role="status" className="shell-head__note">
            {m.nav_muted_during_attempt()}
          </p>
        )}
      </header>

      {/*
        Below 1024 px the learner is *told the target platform*, not shown a broken typing line.
        A media query rather than a JavaScript check, because it must be right on the first paint
        and must follow a window resize with no re-render, and because the typing screen below it
        is genuinely unusable, not merely cramped: the rail plus a full keyboard guide does not
        fit, and a squeezed guide teaches the wrong finger positions.
      */}
      <div className="hidden max-[1023px]:block px-6 py-16">
        <div className="mx-auto max-w-md">
          <Wordmark size={22} />
          <p className="mt-6 font-ui text-lg leading-relaxed text-ink">
            {m.narrow_window_notice()}
          </p>
        </div>
      </div>

      <main
        id="main"
        className={cx('shell-main max-[1023px]:hidden', !landing && 'shell-container')}
      >
        <BootGate>
          <Outlet />
        </BootGate>
      </main>

      <CommandPalette />

      <footer className="shell-foot">
        <div className="shell-foot__inner shell-container">
          <nav aria-label={m.footer_nav()} className="shell-foot__links">
            <Link to="/formulas">{m.footer_formulas()}</Link>
            <Link to="/licences">{m.footer_licences()}</Link>
            <Link to="/privacy">{m.footer_privacy()}</Link>
            <Link to="/about">{m.footer_about()}</Link>
          </nav>
          <span className="shell-foot__note">{m.footer_note()}</span>
        </div>
      </footer>
    </div>
  )
}
