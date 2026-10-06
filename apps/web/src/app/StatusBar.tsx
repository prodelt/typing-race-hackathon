import { Link } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import {
  IconCog,
  IconFlame,
  IconHelp,
  IconInfo,
  IconSnow,
  IconSwords,
  IconVolume,
  IconVolumeOff,
} from '@typing-race/ui'
import { type ReactNode, useEffect, useId } from 'react'
import { initialOf } from '../features/account/model.js'
import { useAccount } from '../features/account/state.js'
import { AccountChip } from '../features/account/ui.js'
import { m } from '../paraglide/messages.js'
import { replayGuide, useGuide } from './guide/model.js'
import { useGameStats } from './state/gameStats.js'
import { useAppStore } from './state/index.js'
import { refreshRaceStanding, signed, useRaceStanding } from './state/raceStanding.js'
import { Tip } from './Tip.js'

/**
 * The status bar: who is playing, their Level and XP, the Streak with its freeze, the Race Rating
 * (only once there is one), and the controls — layout, sound, settings, the «Про гру» menu and the
 * account chip: «Увійти через Google» for a guest, the sync state once signed in.
 */

const NUMBER = new Intl.NumberFormat('uk-UA')

/**
 * A stat with a tooltip that keyboard users reach too: focusable, described by the bubble, Esc
 * hides it. A focus stop needs a role and a name, so it is a group whose `label` says the value.
 */
function Stat({
  tip,
  label,
  className,
  children,
}: {
  readonly tip: string
  readonly label: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <Tip text={tip}>
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled read-out, not a fieldset of inputs */}
      <div
        role="group"
        aria-label={label}
        className={`sb ${className ?? ''}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so the explanation reaches keyboard users
        tabIndex={0}
      >
        {children}
      </div>
    </Tip>
  )
}

const LAYOUTS: readonly { readonly value: Language; readonly label: string }[] = [
  { value: 'uk', label: 'УКР' },
  { value: 'en', label: 'ENG' },
]

function LayoutSwitch() {
  const current = useAppStore((state) => state.settings.typingLanguage)
  const changeSettings = useAppStore((state) => state.changeSettings)
  return (
    <Tip text={m.shell_layout_hint()}>
      {/* biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, not a fieldset of inputs */}
      <div role="group" aria-label={m.shell_layout()} className="seg">
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
      </div>
    </Tip>
  )
}

function SoundToggle() {
  const sound = useAppStore((state) => state.settings.sound)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const on = sound === 'on'
  const label = on ? m.shell_sound_on() : m.shell_sound_off()
  return (
    <Tip text={label}>
      <button
        type="button"
        className="iconbtn"
        aria-pressed={on}
        aria-label={label}
        onClick={() => void changeSettings({ sound: on ? 'off' : 'on' })}
      >
        {on ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
      </button>
    </Tip>
  )
}

/** «?»: replays the coach-marks of the screen on view; quiet where a screen has none. */
function GuideButton() {
  const screen = useGuide((state) => state.screen)
  return (
    <Tip text={m.shell_guide()}>
      <button
        type="button"
        className="iconbtn"
        data-guide="help"
        aria-label={m.shell_guide()}
        aria-disabled={screen === null || undefined}
        onClick={replayGuide}
      >
        <IconHelp size={20} />
      </button>
    </Tip>
  )
}

/** Settings, Formulas, Licences, Privacy and About: reached from here, never from the rail. */
function AboutMenu() {
  const id = useId()
  const close = () => document.getElementById(id)?.hidePopover?.()
  return (
    <>
      <Tip text={m.shell_menu()}>
        <button type="button" className="iconbtn" popoverTarget={id} aria-label={m.shell_menu()}>
          <IconInfo size={20} />
        </button>
      </Tip>
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

/**
 * The Race Rating: the server's number once there is one, otherwise a calm "—" whose tooltip says
 * why. Never a placeholder number.
 */
function RatingStat() {
  const standing = useRaceStanding((state) => state.standing)
  useEffect(() => {
    void refreshRaceStanding()
  }, [])
  const rated = standing.kind === 'rated'
  const tip = rated
    ? m.race_rating_tip({
        races: String(standing.races),
        delta: signed(standing.lastDelta),
      })
    : standing.kind === 'unrated'
      ? m.race_rating_tip_unrated()
      : standing.kind === 'unavailable'
        ? m.race_rating_tip_unavailable()
        : m.race_rating_tip_guest()
  return (
    <Stat
      tip={tip}
      label={
        rated
          ? m.shell_rating_name({ rating: NUMBER.format(standing.rating) })
          : m.shell_rating_name_none()
      }
      className={rated ? '' : 'sb--absent'}
    >
      <IconSwords size={22} className="swords" />
      <div className="sb__col">
        <span className="num" data-testid="status-rating">
          {rated ? NUMBER.format(standing.rating) : '—'}
        </span>
        <span className="sb__lab">{m.shell_rating()}</span>
      </div>
    </Stat>
  )
}

/** Who is playing: the public nick once there is one, never a name or photo from Google. */
function Who() {
  const kind = useAccount((state) => state.kind)
  const nick = useAccount((state) => state.nick)
  const name = nick ?? m.shell_guest()
  return (
    <div className="who" data-testid="status-who">
      <span className="avatar" aria-hidden="true">
        {initialOf(name)}
      </span>
      <div className="who__text">
        <div className="who__name">{name}</div>
        <div className="who__sub">
          {kind === 'google' ? m.acct_sub_google() : m.shell_guest_sub()}
        </div>
      </div>
    </div>
  )
}

export function StatusBar({ settingsActive }: { readonly settingsActive: boolean }) {
  const stats = useGameStats()
  const xpShare = stats.xpForNextLevel > 0 ? Math.min(1, stats.xpInLevel / stats.xpForNextLevel) : 0

  return (
    <section className="bar" aria-label={m.shell_status_label()}>
      <Who />

      <Stat
        className="lvl"
        label={m.shell_level_name({
          level: String(stats.level),
          have: NUMBER.format(stats.xpInLevel),
          need: NUMBER.format(stats.xpForNextLevel),
        })}
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

      <Stat
        tip={m.shell_streak_hint({ days: String(stats.streak.days) })}
        label={m.shell_streak_name({
          days: String(stats.streak.days),
          n: String(stats.streak.freezes),
        })}
      >
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

      <RatingStat />

      <div className="bar__right">
        <LayoutSwitch />
        <SoundToggle />
        <Tip text={m.shell_settings()}>
          <Link
            to="/settings"
            className="iconbtn"
            aria-label={m.shell_settings()}
            aria-current={settingsActive ? 'page' : undefined}
          >
            <IconCog size={20} />
          </Link>
        </Tip>
        <GuideButton />
        <AboutMenu />
        <AccountChip />
      </div>
    </section>
  )
}
