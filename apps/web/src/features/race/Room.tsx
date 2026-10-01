import { Link, useNavigate } from '@tanstack/react-router'
import type { KeystrokeEventLog } from '@typing-race/domain'
import { Button, buttonClass } from '@typing-race/ui'
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useHoldPlayMode } from '../../app/playMode.js'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import type { ProgressMessage, RaceBackend, RoomConnection, RoomSnapshot } from '../../sync/race.js'
import '../exercise/play.css'
import { type Mine, useServerNow } from './backend.js'
import { describe } from './Lobby.js'
import { RaceRun } from './RaceRun.js'
import { Results } from './Results.js'
import { lanesOf, placeOf, Track } from './Track.js'

/** How long a quick-match room gathers once a second racer is in, and how long a lone racer waits. */
const GATHER_MS = 3_000
const ALONE_MS = 20_000
/** A safety net under Broadcast: a missed message costs at most this long. */
const POLL_MS = 2_500
const CAPACITY = 5

type Phase = 'loading' | 'gathering' | 'countdown' | 'racing' | 'watching' | 'results'

export function Room({
  backend,
  roomId,
}: {
  readonly backend: RaceBackend
  readonly roomId: string
}) {
  const navigate = useNavigate()
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
  // The countdown, the race and watching it are Play Mode: only the run stays on screen.
  useHoldPlayMode(phase === 'countdown' || phase === 'racing' || phase === 'watching')

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

  /** Esc: leave the race. The seat steps back to watching first, so the room need not wait. */
  const leave = useCallback(() => {
    void backend.becomeSpectator(roomId).catch(() => undefined)
    void navigate({ to: '/races' })
  }, [backend, roomId, navigate])

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
  const length = snapshot.text === null ? undefined : Array.from(snapshot.text).length
  const place = placeOf(lanes)
  const racing = lanes.length

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    leave()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape reaches the leave from the hidden textarea through this wrapper; the same action is a real button in the HUD
    <div className="play race-play" data-phase={phase} onKeyDown={onKeyDown}>
      <section className="play-hud" aria-label={m.race_hud_label()}>
        <div className="play-hud__left">
          <Button
            variant="secondary"
            size="sm"
            hint="Esc"
            aria-keyshortcuts="Escape"
            onClick={leave}
          >
            {m.race_leave()}
          </Button>
        </div>
        <div className="play-hud__mid">
          <p>
            <b>{snapshot.visibility === 'quick' ? m.race_quick_title() : m.race_private_title()}</b>
            {' · '}
            {snapshot.language === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}
          </p>
          {phase === 'racing' && place !== null && racing > 1 ? (
            <p className="race-play__place" data-testid="race-place">
              {m.race_hud_place()} <b>{place}</b> / {racing}
            </p>
          ) : null}
        </div>
        <div className="play-hud__right" />
      </section>

      <Track lanes={lanes} length={length} />

      <div className="race-play__stage">
        {phase === 'watching' ? (
          <p className="race-note race-play__watching" role="status">
            {stepBack ? m.race_watching_idle() : m.race_watching()}
          </p>
        ) : snapshot.text !== null ? (
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
        {phase === 'countdown' ? (
          <div
            className="race-countdown"
            role="timer"
            aria-live="assertive"
            data-testid="race-countdown"
          >
            <span className="race-countdown__label">{m.race_countdown_label()}</span>
            <span key={remaining} className="race-countdown__n">
              {Math.max(1, remaining)}
            </span>
          </div>
        ) : null}
      </div>

      <p className="rt-caption race-play__caption">{m.race_track_caption()}</p>
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
  const aloneLeft = Math.max(0, Date.parse(snapshot.createdAt) + ALONE_MS - now)
  const invite =
    snapshot.joinCode === null ? null : `${location.origin}/races/join/${snapshot.joinCode}`
  const quick = snapshot.visibility === 'quick'

  const status = !quick
    ? host
      ? m.race_gather_host()
      : m.race_gather_guest()
    : gatherLeft === null
      ? m.race_gather_waiting()
      : m.race_gather_soon()

  // While a quick room gathers, the bar fills toward the start: over three seconds once a rival is
  // in, otherwise over the twenty a lone racer waits.
  const share = !quick
    ? 0
    : gatherLeft !== null
      ? 1 - gatherLeft / GATHER_MS
      : 1 - aloneLeft / ALONE_MS

  return (
    <div className="rg" data-phase="gathering">
      <section className="rl-panel rg-main" aria-labelledby="rg-title">
        <div className="rl-head">
          <span className="rl-idx">{quick ? '01' : '02'}</span>
          <h2 className="rl-title">
            {quick ? m.race_quick_title() : m.race_private_title()}
            {' · '}
            {snapshot.language === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}
          </h2>
        </div>
        <div className="rg-body">
          {snapshot.joinCode === null ? (
            <h1 id="rg-title" className="race-display rg-title">
              {m.race_gather_title()}
            </h1>
          ) : (
            <>
              <p className="rl-label" id="rg-title">
                {m.race_code_label()}
              </p>
              <p className="race-code" data-testid="race-code">
                {snapshot.joinCode}
              </p>
            </>
          )}
          <p className="race-lede" role="status">
            {status}
          </p>
          {quick ? (
            <div className="rg-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, share))})` }} />
            </div>
          ) : null}
        </div>
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
      </section>

      <section className="rl-panel rg-roster" aria-labelledby="rg-roster-title">
        <div className="rl-head">
          <h2 className="rl-title" id="rg-roster-title">
            {m.race_gather_seats({ n: String(racers.length) })}
          </h2>
        </div>
        <ol className="race-roster" aria-label={m.race_roster_label()}>
          {snapshot.participants.map((person, index) => (
            <li
              key={person.userId}
              className="race-roster__row"
              data-me={person.userId === snapshot.me || undefined}
              data-testid="race-roster-row"
            >
              <span className="rt-n">{String(index + 1).padStart(2, '0')}</span>
              <span className="race-roster__mark" aria-hidden="true">
                {Array.from(person.nickname)[0]?.toUpperCase() ?? ''}
              </span>
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
          {Array.from(
            { length: Math.max(0, CAPACITY - snapshot.participants.length) },
            (_, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: empty seats have no identity but their position
                key={`seat-${index}`}
                className="race-roster__row race-roster__row--empty"
                aria-hidden="true"
              >
                <span className="rt-n">
                  {String(snapshot.participants.length + index + 1).padStart(2, '0')}
                </span>
                <span className="race-roster__mark" />
                <span className="race-roster__name">{m.race_seat_free()}</span>
              </li>
            ),
          )}
        </ol>
      </section>
    </div>
  )
}

function RoomSkeleton() {
  return (
    <div className="rg" aria-busy="true">
      <div className="rl-panel">
        <div className="race-skeleton race-skeleton--title" />
      </div>
      <div className="rl-panel">
        <div className="race-skeleton race-skeleton--lane" />
        <div className="race-skeleton race-skeleton--lane" />
      </div>
      <span className="sr-only">{m.race_loading()}</span>
    </div>
  )
}
