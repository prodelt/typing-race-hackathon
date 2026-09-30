import { useNavigate } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import { Button, Field, Index } from '@typing-race/ui'
import { type FormEvent, useEffect, useState } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { type Identity, type RaceBackend, RaceError } from '../../sync/race.js'
import { validName } from './backend.js'

/**
 * The race lobby: who you are in a race, which language, and the two ways in. Quick match is the
 * one red button; a private room is created or joined by code beside it.
 */
export function Lobby({ backend }: { readonly backend: RaceBackend }) {
  const navigate = useNavigate()
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const [language, setLanguage] = useState<Language>(typingLanguage)
  const { identity, name, setName, ensure } = useIdentity(backend)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'quick' | 'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'quick' | 'create' | 'join', go: () => Promise<string>) => {
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
    <div className="race-lobby">
      <header className="race-lobby__head">
        <h1 className="race-display race-lobby__title">{m.race_title()}</h1>
        <p className="race-lede">{m.race_lede()}</p>
      </header>

      <div className="race-lobby__setup">
        <div className="race-lobby__name">
          <Field
            label={m.race_name_label()}
            hint={identity === null ? m.race_name_hint() : m.race_name_hint_signed()}
            value={name}
            maxLength={32}
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <fieldset className="race-lang">
          <legend className="race-lang__legend">{m.race_language_label()}</legend>
          {(['uk', 'en'] as const).map((value) => (
            <label
              key={value}
              className="race-lang__option"
              data-on={value === language || undefined}
            >
              <input
                type="radio"
                name="race-language"
                value={value}
                checked={value === language}
                onChange={() => setLanguage(value)}
                className="sr-only"
              />
              <span className="race-lang__big">{value === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}</span>
              <span className="race-lang__small">
                {value === 'uk' ? m.race_language_uk() : m.race_language_en()}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="race-lobby__ways">
        <section className="race-way race-way--quick" aria-labelledby="race-quick-title">
          <Index n={1}>{m.race_quick_index()}</Index>
          <h2 id="race-quick-title" className="race-way__title">
            {m.race_quick_title()}
          </h2>
          <p className="race-way__body">{m.race_quick_body()}</p>
          <Button
            variant="primary"
            size="lg"
            disabled={busy !== null}
            onClick={() => void run('quick', () => backend.quickMatch(language))}
          >
            {busy === 'quick' ? m.race_quick_busy() : m.race_quick_action()}
          </Button>
        </section>

        <section className="race-way" aria-labelledby="race-private-title">
          <Index n={2}>{m.race_private_index()}</Index>
          <h2 id="race-private-title" className="race-way__title">
            {m.race_private_title()}
          </h2>
          <p className="race-way__body">{m.race_private_body()}</p>
          <Button
            variant="secondary"
            size="lg"
            disabled={busy !== null}
            onClick={() =>
              void run('create', async () => (await backend.createPrivateRoom(language)).roomId)
            }
          >
            {busy === 'create' ? m.race_private_busy() : m.race_private_create()}
          </Button>
          <form className="race-way__join" onSubmit={join}>
            <Field
              label={m.race_code_label()}
              value={code}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              className="race-code-input"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              {busy === 'join' ? m.race_join_busy() : m.race_join_action()}
            </Button>
          </form>
        </section>
      </div>

      {error === null ? null : (
        <p role="alert" className="race-error">
          {error}
        </p>
      )}
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
