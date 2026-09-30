import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Button, buttonClass, Field } from '@typing-race/ui'
import { useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { RaceBackend } from '../../sync/race.js'
import { type BackendStatus, useRaceBackend, validName } from './backend.js'
import { describe, Lobby, useIdentity } from './Lobby.js'
import { Room } from './Room.js'
import './race.css'

/**
 * Live races. The router imports these three names and nothing else from the directory, lazily,
 * so neither this feature nor `@supabase/supabase-js` is in the initial bundle, and training never
 * depends on the backend being up.
 */

function WithBackend({
  children,
}: {
  readonly children: (backend: RaceBackend) => React.ReactNode
}) {
  const status: BackendStatus = useRaceBackend()
  if (status.kind === 'loading') {
    return (
      <div className="race-calm" aria-busy="true">
        <p className="race-lede">{m.race_loading()}</p>
      </div>
    )
  }
  if (status.kind === 'unavailable') return <Unavailable />
  return <>{children(status.backend)}</>
}

function Unavailable() {
  return (
    <div className="race-calm" data-testid="race-unavailable">
      <h1 className="race-display race-calm__title">{m.race_title()}</h1>
      <p className="race-lede">{m.race_unavailable()}</p>
      <Link to="/today" className={buttonClass('primary', 'md')}>
        {m.race_unavailable_action()}
      </Link>
    </div>
  )
}

export function RacesScreen() {
  return <WithBackend>{(backend) => <Lobby backend={backend} />}</WithBackend>
}

export function RoomScreen() {
  const { roomId } = useParams({ strict: false }) as { roomId: string }
  return (
    <WithBackend>
      {(backend) => <Room key={roomId} backend={backend} roomId={roomId} />}
    </WithBackend>
  )
}

export function JoinScreen() {
  const { code } = useParams({ strict: false }) as { code: string }
  return (
    <WithBackend>{(backend) => <Join backend={backend} code={code.toUpperCase()} />}</WithBackend>
  )
}

/**
 * An invite link. With a name already known it joins at once; otherwise it asks for the name
 * first, because a room full of "typist-3f2a" is nobody's idea of a race.
 */
function Join({ backend, code }: { readonly backend: RaceBackend; readonly code: string }) {
  const navigate = useNavigate()
  const { identity, name, setName, ensure } = useIdentity(backend)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)
  // Only a name known before this page opened joins by itself; one being typed waits for the button.
  const [remembered] = useState(() => validName(backend.rememberedName()))
  const known = remembered || identity !== null

  const go = async () => {
    setError(null)
    if (!validName(name)) {
      setError(m.race_name_invalid())
      return
    }
    setBusy(true)
    try {
      await ensure()
      const roomId = await backend.joinByCode(code)
      await navigate({ to: '/races/room/$roomId', params: { roomId }, replace: true })
    } catch (caught) {
      setError(describe(caught))
      setBusy(false)
    }
  }

  useEffect(() => {
    if (tried.current || !known || !validName(name)) return
    tried.current = true
    void go()
  })

  return (
    <div className="race-calm">
      <p className="race-gather__label">{m.race_code_label()}</p>
      <h1 className="race-code">{code}</h1>
      <form
        className="race-join"
        onSubmit={(event) => {
          event.preventDefault()
          void go()
        }}
      >
        <Field
          label={m.race_name_label()}
          value={name}
          maxLength={32}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? m.race_join_busy() : m.race_join_action()}
        </Button>
      </form>
      {error === null ? null : (
        <p role="alert" className="race-error">
          {error}
        </p>
      )}
    </div>
  )
}
