import { useNavigate, useSearch } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import { Button, Field } from '@typing-race/ui'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useScreenKeys } from '../../app/screenKeys.js'
import { useAppStore } from '../../app/state/index.js'
import { refreshRaceStanding, signed, useRaceStanding } from '../../app/state/raceStanding.js'
import { m } from '../../paraglide/messages.js'
import { type Identity, type RaceBackend, RaceError } from '../../sync/race.js'
import { validName } from './backend.js'
import { RATING_K, RATING_START } from './rating.js'

const NUMBER = new Intl.NumberFormat('uk-UA')

type Busy = 'quick-uk' | 'quick-en' | 'create' | 'join' | null

/**
 * The race lobby, as a game-client screen of three panels: quick match (the two languages the
 * server matches on, one tile each), a room with a friend (create or join by code), and the
 * learner's Race Rating with how it is counted and the name they race under.
 *
 * Honest about the server: it matches one difficulty per language and counts nobody online, so
 * there are two tiles and no "online now".
 */
export function Lobby({ backend }: { readonly backend: RaceBackend }) {
  const navigate = useNavigate()
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const asked = useSearch({ from: '/races' })
  const [roomLanguage, setRoomLanguage] = useState<Language>(asked.lang ?? typingLanguage)
  const { identity, name, setName, ensure } = useIdentity(backend)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: Exclude<Busy, null>, go: () => Promise<string>) => {
    setError(null)
    if (!validName(name)) {
      setError(m.race_name_invalid())
      return
    }
    setBusy(kind)
    try {
      await ensure()
      const roomId = await go()
      await navigate({ to: '/races/room/$roomId', params: { roomId } })
    } catch (caught) {
      setError(describe(caught))
      setBusy(null)
    }
  }

  const quick = (language: Language) =>
    void run(language === 'uk' ? 'quick-uk' : 'quick-en', () => backend.quickMatch(language))
  const create = () =>
    void run('create', async () => (await backend.createPrivateRoom(roomLanguage)).roomId)

  // Home's tiles ask for a race outright. It starts once; without a valid name the usual message
  // shows and the learner finishes the form here.
  const launched = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, for the request it arrived with
  useEffect(() => {
    if (launched.current || asked.go === undefined) return
    launched.current = true
    const go = asked.go
    const language = asked.lang ?? typingLanguage
    void navigate({ to: '/races', search: {}, replace: true })
    if (go === 'quick') quick(language)
    else void run('create', async () => (await backend.createPrivateRoom(language)).roomId)
  }, [])

  useScreenKeys({
    KeyQ: () => quick('uk'),
    KeyW: () => quick('en'),
    KeyF: create,
  })

  const join = (event: FormEvent) => {
    event.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(clean)) {
      setError(m.race_code_invalid())
      return
    }
    void run('join', () => backend.joinByCode(clean))
  }

  return (
    <div className="rl">
      <h1 className="sr-only">{m.race_title()}</h1>

      <section className="rl-panel rl-quick" aria-labelledby="rl-quick-title">
        <div className="rl-head">
          <span className="rl-idx">01</span>
          <h2 className="rl-title" id="rl-quick-title">
            {m.race_quick_title()}
          </h2>
        </div>
        <p className="rl-lead">{m.race_lobby_quick_lead()}</p>
        <div className="rl-tiles">
          {(['uk', 'en'] as const).map((language) => (
            <button
              key={language}
              type="button"
              className="rl-tile"
              aria-keyshortcuts={language === 'uk' ? 'Q' : 'W'}
              disabled={busy !== null}
              data-busy={busy === `quick-${language}` || undefined}
              onClick={() => quick(language)}
            >
              <span className="rl-tile__name">
                <em>{language === 'uk' ? m.race_tile_uk() : m.race_tile_en()}</em>
                {' · '}
                {busy === `quick-${language}` ? m.race_quick_busy() : m.race_tile_quick()}
              </span>
              {/* Drawn from an attribute: decoration, so not a second "QWERTY" text on the page. */}
              <span
                className="rl-tile__layout"
                data-layout={language === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}
                aria-hidden="true"
              />
              <span className="rl-tile__sub">{m.race_tile_sub()}</span>
              <span className="kbd" aria-hidden="true">
                {language === 'uk' ? 'Q' : 'W'}
              </span>
            </button>
          ))}
        </div>
        <p className="rl-note">{m.race_tiles_honest()}</p>
      </section>

      <section className="rl-panel rl-friend" aria-labelledby="rl-friend-title">
        <div className="rl-head">
          <span className="rl-idx">02</span>
          <h2 className="rl-title" id="rl-friend-title">
            {m.race_friend_title()}
          </h2>
        </div>
        <p className="rl-lead">{m.race_friend_lead()}</p>
        <div className="rl-friend__row">
          <div className="rl-create">
            <fieldset className="rl-seg">
              <legend className="rl-label">{m.race_language_label()}</legend>
              {(['uk', 'en'] as const).map((value) => (
                <label
                  key={value}
                  className="rl-seg__opt"
                  data-on={value === roomLanguage || undefined}
                >
                  <input
                    type="radio"
                    name="race-language"
                    value={value}
                    checked={value === roomLanguage}
                    onChange={() => setRoomLanguage(value)}
                    className="sr-only"
                  />
                  {value === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}
                </label>
              ))}
            </fieldset>
            <Button
              variant="secondary"
              hint="F"
              aria-keyshortcuts="F"
              disabled={busy !== null}
              onClick={create}
            >
              {busy === 'create' ? m.race_private_busy() : m.race_private_create()}
            </Button>
          </div>
          <span className="rl-or" aria-hidden="true">
            {m.race_friend_or()}
          </span>
          <form className="rl-join" onSubmit={join}>
            <Field
              label={m.race_code_label()}
              value={code}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC123"
              className="race-code-input"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              {busy === 'join' ? m.race_join_busy() : m.race_join_action()}
            </Button>
          </form>
        </div>
      </section>

      <aside className="rl-panel rl-me" aria-labelledby="rl-me-title">
        <div className="rl-head">
          <span className="rl-idx">03</span>
          <h2 className="rl-title" id="rl-me-title">
            {m.race_rating_title()}
          </h2>
        </div>
        <Standing backend={backend} identity={identity} />
        <div className="rl-name">
          <Field
            label={m.race_name_label()}
            hint={identity === null ? m.race_name_hint() : m.race_name_hint_signed()}
            invalid={error === m.race_name_invalid()}
            value={name}
            maxLength={32}
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="rl-how">
          <h3 className="rl-label">{m.race_rating_how()}</h3>
          <ul>
            <li>{m.race_rating_how_1({ start: String(RATING_START) })}</li>
            <li>{m.race_rating_how_2({ k: String(RATING_K) })}</li>
            <li>{m.race_rating_how_3()}</li>
            <li>{m.race_rating_how_4()}</li>
          </ul>
        </div>
      </aside>

      {error === null ? null : (
        <p role="alert" className="race-error rl-error">
          {error}
        </p>
      )}
    </div>
  )
}

/** The rating itself: the server's number, or a calm "none yet" that says why. */
function Standing({
  backend,
  identity,
}: {
  readonly backend: RaceBackend
  readonly identity: Identity | null
}) {
  const standing = useRaceStanding((state) => state.standing)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read once the identity is known
  useEffect(() => {
    void refreshRaceStanding()
  }, [backend, identity?.userId])

  if (standing.kind === 'rated') {
    return (
      <div className="rl-rating" data-testid="race-rating">
        <span className="rl-rating__num">{NUMBER.format(standing.rating)}</span>
        <span className="rl-rating__meta">
          {m.race_rating_races({ races: String(standing.races) })}
          {' · '}
          <span data-sign={Math.sign(standing.lastDelta)}>
            {m.race_rating_last({ delta: signed(standing.lastDelta) })}
          </span>
        </span>
      </div>
    )
  }
  return (
    <div className="rl-rating rl-rating--none" data-testid="race-rating">
      <span className="rl-rating__num">{m.race_rating_none()}</span>
      <span className="rl-rating__meta">
        {standing.kind === 'unavailable'
          ? m.race_rating_body_unavailable()
          : m.race_rating_body_guest()}
      </span>
    </div>
  )
}

export function describe(caught: unknown): string {
  if (caught instanceof RaceError) {
    if (caught.code === 'no_room') return m.race_error_no_room()
    if (caught.code === 'name_taken') return m.race_error_name_taken()
  }
  return m.race_error_generic()
}

/**
 * The racer's identity: restored from this tab's session, or signed in silently with the name
 * remembered from last time. `ensure` signs in or renames right before a room is entered.
 */
export function useIdentity(backend: RaceBackend): {
  identity: Identity | null
  name: string
  setName(name: string): void
  ensure(): Promise<Identity>
} {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [name, setName] = useState(() => backend.rememberedName())

  useEffect(() => {
    let live = true
    void backend.identity().then((found) => {
      if (!live || found === null) return
      setIdentity(found)
      setName(found.nickname)
    })
    return () => {
      live = false
    }
  }, [backend])

  const ensure = async (): Promise<Identity> => {
    const wanted = name.trim()
    let current = identity ?? (await backend.identity())
    if (current === null) current = await backend.signIn(wanted)
    else if (current.nickname !== wanted && !current.nickname.startsWith(`${wanted}-`)) {
      current = await backend.rename(wanted)
    }
    setIdentity(current)
    setName(current.nickname)
    return current
  }

  return { identity, name, setName, ensure }
}
