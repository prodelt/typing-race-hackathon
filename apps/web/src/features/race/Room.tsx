import { Link, useNavigate } from '@tanstack/react-router'
import type { KeystrokeEventLog } from '@typing-race/domain'
import { Button, buttonClass, Index } from '@typing-race/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHoldPlayMode } from '../../app/playMode.js'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import type { ProgressMessage, RaceBackend, RoomConnection, RoomSnapshot } from '../../sync/race.js'
import { type Mine, useServerNow } from './backend.js'
import { describe } from './Lobby.js'
import { RaceRun } from './RaceRun.js'
import { Results } from './Results.js'
import { lanesOf, Track } from './Track.js'

/** How long a quick-match room gathers once a second racer is in, and how long a lone racer waits. */
const GATHER_MS = 3_000
const ALONE_MS = 20_000
/** A safety net under Broadcast: a missed message costs at most this long. */
const POLL_MS = 2_500

type Phase = 'loading' | 'gathering' | 'countdown' | 'racing' | 'watching' | 'results'

export function Room({
  backend,
  roomId,
}: {
  readonly backend: RaceBackend
  readonly roomId: string
}) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, ProgressMessage>>({})
  const [mine, setMine] = useState<Mine>({ kind: 'none' })
  const [stepBack, setStepBack] = useState(false)
  const connection = useRef<RoomConnection | null>(null)
  const sizePx = useAppStore((state) => state.settings.textSizePx)

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await backend.snapshot(roomId))
    } catch (caught) {
      setLoadError(describe(caught))
    }
  }, [backend, roomId])

  useEffect(() => {
    let live = true
    void refresh()
    void backend
      .connect(roomId, {
        onProgress: (message) => setProgress((all) => ({ ...all, [message.userId]: message })),
        onChange: () => void refresh(),
      })
      .then((opened) => {
        if (live) connection.current = opened
        else opened.close()
      })
    return () => {
      live = false
      connection.current?.close()
      connection.current = null
    }
  }, [backend, roomId, refresh])

  const offset = snapshot?.offsetMs ?? 0
  const finishedRoom = snapshot?.state === 'finished'
  const now = useServerNow(offset, snapshot !== null && !finishedRoom)
  const phase = phaseOf(snapshot, now, mine, stepBack)
  // The countdown and the race itself are Play Mode: only the run stays on screen.
  useHoldPlayMode(phase === 'countdown' || phase === 'racing')

  // Broadcast is the fast path; this poll is what makes a missed message harmless.
  const loaded = snapshot !== null
  useEffect(() => {
    if (!loaded || finishedRoom) return
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [loaded, finishedRoom, refresh])

  // Quick match starts itself; every client asks, the database answers once.
  const asking = useRef(0)
  useEffect(() => {
    if (snapshot === null || phase !== 'gathering' || snapshot.visibility !== 'quick') return
    const racers = snapshot.participants.filter((person) => person.role === 'racer')
    const second = racers[1]
    const due =
      (second !== undefined && now >= Date.parse(second.joinedAt) + GATHER_MS) ||
      now >= Date.parse(snapshot.createdAt) + ALONE_MS
    if (!due || Date.now() - asking.current < 1_000) return
    asking.current = Date.now()
    void backend.requestStart(roomId).then((startsAt) => {
      if (startsAt !== null) void refresh()
    })
  }, [snapshot, phase, now, backend, roomId, refresh])

  const me = snapshot?.me
  const onProgress = useCallback(
    (cursor: number, total: number, spm: number) => {
      if (me === undefined) return
      const message = { userId: me, cursor, total, spm }
      setProgress((all) => ({ ...all, [me]: message }))
      connection.current?.sendProgress(message)
    },
    [me],
  )

  const onFinish = useCallback(
    (log: KeystrokeEventLog, elapsedMs: number) => {
      setMine({ kind: 'checking' })
      backend
        .finish(roomId, log, elapsedMs)
        .then((reply) => {
          setMine({ kind: 'done', reply })
          void refresh()
        })
        .catch(() => setMine({ kind: 'failed' }))
    },
    [backend, roomId, refresh],
  )

  const onIdle = useCallback(() => {
    setStepBack(true)
    void backend.becomeSpectator(roomId).then(() => refresh())
  }, [backend, roomId, refresh])

  if (loadError !== null && snapshot === null) {
    return (
      <div className="race-calm">
        <p className="race-lede">{loadError}</p>
        <Link to="/races" className={buttonClass('secondary', 'md')}>
          {m.race_back_to_lobby()}
        </Link>
      </div>
    )
  }
  if (snapshot === null || phase === 'loading') return <RoomSkeleton />

  const lanes = lanesOf(snapshot, progress)

  if (phase === 'results') {
    return <Results snapshot={snapshot} mine={mine} lanes={lanes} />
  }

  if (phase === 'gathering') {
    return <Gathering backend={backend} snapshot={snapshot} now={now} onStarted={refresh} />
  }

  const startsAt = Date.parse(snapshot.startsAt ?? '')
  const remaining = Math.ceil((startsAt - now) / 1000)

  return (
    <div className="race-room" data-phase={phase}>
      <RoomHead snapshot={snapshot} />
      {phase === 'countdown' ? (
        <div
          className="race-countdown"
          role="timer"
          aria-live="assertive"
          data-testid="race-countdown"
        >
          <span key={remaining} className="race-countdown__n">
            {Math.max(1, remaining)}
          </span>
        </div>
      ) : null}
      {phase === 'watching' ? (
        <p className="race-note" role="status">
          {stepBack ? m.race_watching_idle() : m.race_watching()}
        </p>
      ) : null}
      {snapshot.text !== null && phase !== 'watching' ? (
        <RaceRun
          text={snapshot.text}
          language={snapshot.language}
          live={phase === 'racing'}
          sizePx={sizePx}
          onProgress={onProgress}
          onFinish={onFinish}
          onIdle={onIdle}
        />
      ) : null}
      <Track lanes={lanes} caption={m.race_track_caption()} />
    </div>
  )
}

function phaseOf(snapshot: RoomSnapshot | null, now: number, mine: Mine, stepBack: boolean): Phase {
  if (snapshot === null) return 'loading'
  const me = snapshot.participants.find((person) => person.userId === snapshot.me)
  const finishedMe = snapshot.results.some((result) => result.userId === snapshot.me)
  if (snapshot.state === 'finished' || finishedMe || mine.kind !== 'none') return 'results'
  if (snapshot.startsAt === null) return 'gathering'
  if (now < Date.parse(snapshot.startsAt)) return 'countdown'
  if (snapshot.deadline !== null && now > Date.parse(snapshot.deadline)) return 'results'
  if (stepBack || me?.role !== 'racer') return 'watching'
  return 'racing'
}

function RoomHead({ snapshot }: { readonly snapshot: RoomSnapshot }) {
  return (
    <header className="race-room__head">
      <Index n={snapshot.visibility === 'quick' ? 1 : 2}>
        {snapshot.visibility === 'quick' ? m.race_quick_title() : m.race_private_title()}
      </Index>
      <span className="race-room__lang">{snapshot.language === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}</span>
    </header>
  )
}

function Gathering({
  backend,
  snapshot,
  now,
  onStarted,
}: {
  readonly backend: RaceBackend
  readonly snapshot: RoomSnapshot
  readonly now: number
  readonly onStarted: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const racers = snapshot.participants.filter((person) => person.role === 'racer')
  const host = snapshot.hostId === snapshot.me
  const second = racers[1]
  const gatherLeft =
    second === undefined ? null : Math.max(0, Date.parse(second.joinedAt) + GATHER_MS - now)
  const invite =
    snapshot.joinCode === null ? null : `${location.origin}/races/join/${snapshot.joinCode}`

  const status =
    snapshot.visibility === 'private'
      ? host
        ? m.race_gather_host()
        : m.race_gather_guest()
      : gatherLeft === null
        ? m.race_gather_waiting()
        : m.race_gather_soon()

  return (
    <div className="race-room" data-phase="gathering">
      <RoomHead snapshot={snapshot} />
      <div className="race-gather">
        <div className="race-gather__main">
          {snapshot.joinCode === null ? (
            <h1 className="race-display race-gather__title">{m.race_gather_title()}</h1>
          ) : (
            <>
              <p className="race-gather__label">{m.race_code_label()}</p>
              <p className="race-code" data-testid="race-code">
                {snapshot.joinCode}
              </p>
            </>
          )}
          <p className="race-lede" role="status">
            {status}
          </p>
          {snapshot.visibility === 'quick' ? (
            <div
              className="race-gather__bar"
              data-on={gatherLeft !== null || undefined}
              style={{
                transform: `scaleX(${gatherLeft === null ? 0 : 1 - gatherLeft / GATHER_MS})`,
              }}
              aria-hidden="true"
            />
          ) : null}
          <div className="race-gather__actions">
            {host ? (
              <Button
                variant="primary"
                size="lg"
                disabled={starting}
                onClick={() => {
                  setStarting(true)
                  void backend.requestStart(snapshot.id).then(() => onStarted())
                }}
              >
                {m.race_start_action()}
              </Button>
            ) : null}
            {invite === null ? null : (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  void navigator.clipboard?.writeText(invite).then(() => setCopied(true))
                }}
              >
                {copied ? m.race_invite_copied() : m.race_invite_copy()}
              </Button>
            )}
            <Button variant="quiet" size="lg" onClick={() => void navigate({ to: '/races' })}>
              {m.race_leave()}
            </Button>
          </div>
        </div>
        <ol className="race-roster" aria-label={m.race_roster_label()}>
          {snapshot.participants.map((person, index) => (
            <li key={person.userId} className="race-roster__row" data-testid="race-roster-row">
              <span className="race-lane__n">[{String(index + 1).padStart(2, '0')}]</span>
              <span className="race-roster__name">{person.nickname}</span>
              <span className="race-roster__tag">
                {person.userId === snapshot.me
                  ? m.race_you()
                  : person.role === 'spectator'
                    ? m.race_spectator()
                    : person.userId === snapshot.hostId
                      ? m.race_host()
                      : ''}
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, 5 - snapshot.participants.length) }, (_, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: empty seats have no identity but their position
              key={`seat-${index}`}
              className="race-roster__row race-roster__row--empty"
              aria-hidden="true"
            >
              <span className="race-lane__n">
                [{String(snapshot.participants.length + index + 1).padStart(2, '0')}]
              </span>
              <span className="race-roster__name">{m.race_seat_free()}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function RoomSkeleton() {
  return (
    <div className="race-room" aria-busy="true">
      <div className="race-skeleton race-skeleton--title" />
      <div className="race-skeleton race-skeleton--lane" />
      <div className="race-skeleton race-skeleton--lane" />
      <span className="sr-only">{m.race_loading()}</span>
    </div>
  )
}
