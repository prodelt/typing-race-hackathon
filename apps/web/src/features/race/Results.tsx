import { useNavigate } from '@tanstack/react-router'
import { Button, cx } from '@typing-race/ui'
import { useEffect, useState } from 'react'
import { useScreenKeys } from '../../app/screenKeys.js'
import { refreshRaceStanding, signed, useRaceStanding } from '../../app/state/raceStanding.js'
import { m } from '../../paraglide/messages.js'
import type { RaceBackend, RaceResult, RematchInvite, RoomSnapshot } from '../../sync/race.js'
import type { Mine } from './backend.js'
import { RATING_ACCURACY_FLOOR } from './rating.js'
import { rematch, rematchPlan } from './rematch.js'
import { type Lane, Track } from './Track.js'

const NUMBER = new Intl.NumberFormat('uk-UA')

function ranked(result: RaceResult): boolean {
  return result.validated && result.accuracy >= RATING_ACCURACY_FLOOR
}

function percent(accuracy: number): string {
  return `${(Math.floor(accuracy * 1000) / 10).toFixed(1)}%`
}

/**
 * The results, as a reward: the learner's place in big type with their own numbers and what the
 * race did to their Race Rating, beside the server's ranking. Validated results rank by score; the
 * ones that did not rank say why; whoever is still typing is listed last, with the live track.
 *
 * «Ще заїзд» goes back to quick match from a quick match; from a private room it keeps the friends
 * together (`rematch.ts`): it opens the next room and calls the others, or follows the friend who
 * already did.
 */
export function Results({
  backend,
  snapshot,
  mine,
  lanes,
  invite,
  announce,
}: {
  readonly backend: RaceBackend
  readonly snapshot: RoomSnapshot
  readonly mine: Mine
  readonly lanes: readonly Lane[]
  /** A friend's next room, broadcast from this room's results. */
  readonly invite: RematchInvite | null
  readonly announce: (invite: RematchInvite) => Promise<void>
}) {
  const navigate = useNavigate()
  const [again, setAgain] = useState(false)
  const [ratingRead, setRatingRead] = useState(false)
  const finished = snapshot.state === 'finished'
  const placed = snapshot.results.filter(ranked)
  const unplaced = snapshot.results.filter((result) => !ranked(result))
  const done = new Set(snapshot.results.map((result) => result.userId))
  const outstanding = snapshot.participants.filter(
    (person) => person.role === 'racer' && !done.has(person.userId),
  )
  const myPlace = placed.findIndex((result) => result.userId === snapshot.me)
  const myResult = snapshot.results.find((result) => result.userId === snapshot.me)
  const plan = rematchPlan(snapshot, invite)

  // The rating is computed by the server in the same transaction that finishes the room.
  useEffect(() => {
    if (finished) void refreshRaceStanding().then(() => setRatingRead(true))
  }, [finished])

  const raceAgain = async () => {
    if (again) return
    setAgain(true)
    const me = snapshot.participants.find((person) => person.userId === snapshot.me)
    try {
      const roomId = await rematch(plan, { backend, announce, me: me?.nickname ?? '' })
      await navigate({ to: '/races/room/$roomId', params: { roomId } })
    } catch {
      setAgain(false)
    }
  }

  useScreenKeys({
    Enter: () => void raceAgain(),
    Escape: () => void navigate({ to: '/races' }),
  })

  return (
    <div className="rr" data-phase="results">
      <section className="rl-panel rr-me" aria-labelledby="rr-title">
        <div className="rl-head">
          <span className="rl-idx">{snapshot.language === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}</span>
          <span className="rl-title">
            {snapshot.visibility === 'quick' ? m.race_quick_title() : m.race_private_title()}
          </span>
        </div>
        <h1
          id="rr-title"
          className="race-display rr-title"
          data-testid="race-results-title"
          data-first={myPlace === 0 || undefined}
        >
          {mine.kind === 'checking'
            ? m.race_results_checking()
            : myPlace >= 0
              ? m.race_results_place({ place: myPlace + 1 })
              : m.race_results_title()}
        </h1>
        <p className="race-lede">
          {mine.kind === 'failed'
            ? m.race_results_failed()
            : finished
              ? m.race_results_final()
              : m.race_results_waiting()}
        </p>

        {myResult === undefined ? null : (
          <dl className="rr-cells">
            <div>
              <dt>{m.race_results_your_speed()}</dt>
              <dd>
                {Math.round(myResult.spm)} <small>{m.race_spm_unit()}</small>
              </dd>
            </div>
            <div>
              <dt>{m.race_results_your_accuracy()}</dt>
              <dd>{percent(myResult.accuracy)}</dd>
            </div>
          </dl>
        )}

        <RatingLine
          roomId={snapshot.id}
          settled={finished && ratingRead}
          alone={startLine(snapshot) < 2}
        />

        {plan.kind === 'quick' ? null : (
          <p
            className="rr-again"
            data-invite={plan.kind === 'join' || undefined}
            role="status"
            data-testid="race-again-note"
          >
            {plan.kind === 'join'
              ? m.race_again_invite({ name: plan.from })
              : m.race_again_private()}
          </p>
        )}
        <div className="race-gather__actions rr-actions">
          <Button
            variant="primary"
            size="lg"
            hint="Enter"
            disabled={again}
            onClick={() => void raceAgain()}
            data-testid="race-again"
          >
            {plan.kind === 'join' ? m.race_again_join() : m.race_again()}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            hint="Esc"
            onClick={() => void navigate({ to: '/races' })}
          >
            {m.race_back_to_lobby()}
          </Button>
        </div>
      </section>

      <section className="rl-panel rr-board" aria-label={m.race_results_title()}>
        <ol className="race-results" data-testid="race-ranking">
          {placed.map((result, index) => (
            <li
              key={result.userId}
              className={cx('race-result', result.userId === snapshot.me && 'race-result--me')}
              data-testid="race-result"
            >
              <span className="race-result__place">{index + 1}</span>
              <span className="race-result__name">{result.nickname}</span>
              <span className="race-result__figure">
                <strong>{Math.round(result.spm)}</strong>
                <span>{m.race_spm_unit()}</span>
              </span>
              <span className="race-result__figure">
                <strong>{percent(result.accuracy)}</strong>
                <span>{m.race_accuracy_unit()}</span>
              </span>
            </li>
          ))}
          {unplaced.map((result) => (
            <li
              key={result.userId}
              className={cx(
                'race-result race-result--out',
                result.userId === snapshot.me && 'race-result--me',
              )}
            >
              <span className="race-result__place">–</span>
              <span className="race-result__name">{result.nickname}</span>
              <span className="race-result__why">
                {result.validated ? m.race_unranked_accuracy() : m.race_unranked_invalid()}
              </span>
              <span className="race-result__figure">
                <strong>{percent(result.accuracy)}</strong>
                <span>{m.race_accuracy_unit()}</span>
              </span>
            </li>
          ))}
          {outstanding.map((person) => (
            <li key={person.userId} className="race-result race-result--out">
              <span className="race-result__place">–</span>
              <span className="race-result__name">{person.nickname}</span>
              <span className="race-result__why">
                {finished ? m.race_did_not_finish() : m.race_still_typing()}
              </span>
            </li>
          ))}
        </ol>

        {finished ? null : <Track lanes={lanes} />}

        <p className="race-honest">{m.race_results_honest()}</p>
      </section>
    </div>
  )
}

/** What this race did to the Race Rating: the change, "once everyone finishes", or "none". */
function RatingLine({
  roomId,
  settled,
  alone,
}: {
  readonly roomId: string
  readonly settled: boolean
  readonly alone: boolean
}) {
  const standing = useRaceStanding((state) => state.standing)
  if (!settled) {
    return <p className="rr-rating rr-rating--quiet">{m.race_results_rating_pending()}</p>
  }
  if (standing.kind === 'rated' && standing.lastRoomId === roomId) {
    return (
      <p className="rr-rating" data-testid="race-rating-change">
        <span>{m.race_results_rating({ rating: NUMBER.format(standing.rating) })}</span>
        <b data-sign={Math.sign(standing.lastDelta)}>
          {m.race_results_rating_delta({ delta: signed(standing.lastDelta) })}
        </b>
      </p>
    )
  }
  if (standing.kind === 'loading' || standing.kind === 'unavailable') return null
  // The lone-racer reason only when it is the reason; otherwise just say it did not change.
  return (
    <p className="rr-rating rr-rating--quiet">
      {alone ? m.race_results_rating_none() : m.race_results_rating_unchanged()}
    </p>
  )
}

/** How many racers were on the start line: joined before the start, or holding a result. */
function startLine(snapshot: RoomSnapshot): number {
  const start = snapshot.startsAt === null ? Number.NaN : Date.parse(snapshot.startsAt)
  const finished = new Set(snapshot.results.map((result) => result.userId))
  return snapshot.participants.filter(
    (person) => finished.has(person.userId) || Date.parse(person.joinedAt) <= start,
  ).length
}
