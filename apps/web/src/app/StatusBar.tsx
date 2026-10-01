import { Link } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import {
  IconCog,
  IconFlame,
  IconGoogle,
  IconInfo,
  IconSnow,
  IconSwords,
  IconVolume,
  IconVolumeOff,
} from '@typing-race/ui'
import { type ReactNode, useId } from 'react'
import { m } from '../paraglide/messages.js'
import { useGameStats } from './state/gameStats.js'
import { useAppStore } from './state/index.js'

/**
 * The status bar: who is playing, their Level and XP, the Streak with its freeze, the Race Rating
 * (only once there is one), and the controls — layout, sound, settings, the «Про гру» menu and a
 * quiet sign-in chip that waits for the cloud tickets.
 */

const NUMBER = new Intl.NumberFormat('uk-UA')

/** A stat with a tooltip that keyboard users reach too: focusable, and described by the bubble. */
function Stat({
  tip,
  className,
  children,
}: {
  readonly tip: string
  readonly className?: string
  readonly children: ReactNode
}) {
  const id = useId()
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so the explanation reaches keyboard users
    <div className={`sb tip ${className ?? ''}`} tabIndex={0} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="tip__bubble">
        {tip}
      </span>
    </div>
  )
}

const LAYOUTS: readonly { readonly value: Language; readonly label: string }[] = [
  { value: 'uk', label: 'УКР' },
  { value: 'en', label: 'ENG' },
]

function LayoutSwitch() {
  const current = useAppStore((state) => state.settings.typingLanguage)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const id = useId()
  return (
    // biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, not a fieldset of inputs
    <div role="group" aria-label={m.shell_layout()} aria-describedby={id} className="seg tip">
      {LAYOUTS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === current}
          onClick={() => {
            if (value !== current) void changeSettings({ typingLanguage: value })
          }}
        >
          {label}
        </button>
      ))}
      <span role="tooltip" id={id} className="tip__bubble">
        {m.shell_layout_hint()}
      </span>
    </div>
  )
}

function SoundToggle() {
  const sound = useAppStore((state) => state.settings.sound)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const on = sound === 'on'
  const label = on ? m.shell_sound_on() : m.shell_sound_off()
  return (
    <button
      type="button"
      className="iconbtn"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => void changeSettings({ sound: on ? 'off' : 'on' })}
    >
      {on ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
    </button>
  )
}

/** Settings, Formulas, Licences, Privacy and About: reached from here, never from the rail. */
function AboutMenu() {
  const id = useId()
  const close = () => document.getElementById(id)?.hidePopover?.()
  return (
    <>
      <button
        type="button"
        className="iconbtn"
        popoverTarget={id}
        aria-label={m.shell_menu()}
        title={m.shell_menu()}
      >
        <IconInfo size={20} />
      </button>
      <div id={id} popover="auto" className="menu">
        <p className="menu__title">{m.shell_menu()}</p>
        <ul>
          <li>
            <Link to="/about" onClick={close}>
              {m.shell_menu_about()}
            </Link>
          </li>
          <li>
            <Link to="/settings" onClick={close}>
              {m.shell_settings()}
            </Link>
          </li>
          <li>
            <Link to="/formulas" onClick={close}>
              {m.shell_menu_formulas()}
            </Link>
          </li>
          <li>
            <Link to="/licences" onClick={close}>
              {m.shell_menu_licences()}
            </Link>
          </li>
          <li>
            <Link to="/privacy" onClick={close}>
              {m.shell_menu_privacy()}
            </Link>
          </li>
          <li>
            <Link to="/about/project" onClick={close}>
              {m.shell_menu_project()}
            </Link>
          </li>
        </ul>
      </div>
    </>
  )
}

function GoogleChip() {
  const id = useId()
  return (
    <button
      type="button"
      className="gchip tip"
      aria-disabled="true"
      aria-describedby={id}
      onClick={(event) => event.preventDefault()}
    >
      <IconGoogle size={16} />
      <span>
        <span className="gchip__short">{m.shell_google_short()}</span>
        <span className="gchip__full">{m.shell_google()}</span>
      </span>
      <span role="tooltip" id={id} className="tip__bubble tip__bubble--end">
        {m.shell_google_soon()}
      </span>
    </button>
  )
}

export function StatusBar({ settingsActive }: { readonly settingsActive: boolean }) {
  const stats = useGameStats()
  const xpShare = stats.xpForNextLevel > 0 ? Math.min(1, stats.xpInLevel / stats.xpForNextLevel) : 0

  return (
    <section className="bar" aria-label={m.shell_status_label()}>
      <div className="who">
        <span className="avatar" aria-hidden="true">
          {m.shell_guest().slice(0, 1).toUpperCase()}
        </span>
        <div className="who__text">
          <div className="who__name">{m.shell_guest()}</div>
          <div className="who__sub">{m.shell_guest_sub()}</div>
        </div>
      </div>

      <Stat
        className="lvl"
        tip={m.shell_level_hint({
          next: String(stats.level + 1),
          left: NUMBER.format(Math.max(0, stats.xpForNextLevel - stats.xpInLevel)),
        })}
      >
        <div className="sb__col">
          <div className="sb__top">
            <span className="sb__lab">{m.shell_level()}</span>
            <span className="num" data-testid="status-level">
              {stats.level}
            </span>
          </div>
          <div className="xp" aria-hidden="true">
            <span className="xp__fill" style={{ width: `${Math.round(xpShare * 100)}%` }} />
          </div>
          <div className="xp__txt">
            {m.shell_xp_of({
              have: NUMBER.format(stats.xpInLevel),
              need: NUMBER.format(stats.xpForNextLevel),
            })}
          </div>
        </div>
      </Stat>

      <Stat tip={m.shell_streak_hint({ days: String(stats.streak.days) })}>
        <IconFlame size={24} className="flame" />
        <div className="sb__col">
          <div className="sb__top">
            <span className="num">{stats.streak.days}</span>
            <span className="sb__lab">{m.shell_streak_days()}</span>
          </div>
          <span className="freeze">
            <IconSnow size={12} />
            {m.shell_freeze({ n: String(stats.streak.freezes) })}
          </span>
        </div>
      </Stat>

      {stats.raceRating === null ? null : (
        <Stat tip={m.shell_rating_hint()}>
          <IconSwords size={22} className="swords" />
          <div className="sb__col">
            <span className="num">{NUMBER.format(stats.raceRating)}</span>
            <span className="sb__lab">{m.shell_rating()}</span>
          </div>
        </Stat>
      )}

      <div className="bar__right">
        <LayoutSwitch />
        <SoundToggle />
        <Link
          to="/settings"
          className="iconbtn"
          aria-label={m.shell_settings()}
          title={m.shell_settings()}
          aria-current={settingsActive ? 'page' : undefined}
        >
          <IconCog size={20} />
        </Link>
        <AboutMenu />
        <GoogleChip />
      </div>
    </section>
  )
}
