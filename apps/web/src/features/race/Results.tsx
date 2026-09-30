import { useNavigate } from '@tanstack/react-router'
import { Button, cx } from '@typing-race/ui'
import { useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { RaceResult, RoomSnapshot } from '../../sync/race.js'
import { raceBackend } from '../../sync/race.js'
import type { Mine } from './backend.js'
import { type Lane, Track } from './Track.js'

/** The ranking floor, matching `finish-race`: below it a result is shown but not placed. */
const RANK_FLOOR = 0.9

function ranked(result: RaceResult): boolean {
  return result.validated && result.accuracy >= RANK_FLOOR
}

function percent(accuracy: number): string {
  return `${(Math.floor(accuracy * 1000) / 10).toFixed(1)}%`
}

/**
 * The results: validated results ranked by score, then the ones that did not rank and why, then
 * whoever is still typing. The copy says plainly that the live lanes were approximate and this
 * ranking is the server's.
 */
export function Results({
  snapshot,
  mine,
  lanes,
}: {
  readonly snapshot: RoomSnapshot
  readonly mine: Mine
  readonly lanes: readonly Lane[]
}) {
  const navigate = useNavigate()
  const [again, setAgain] = useState(false)
  const finished = snapshot.state === 'finished'
  const placed = snapshot.results.filter(ranked)
  const unplaced = snapshot.results.filter((result) => !ranked(result))
  const done = new Set(snapshot.results.map((result) => result.userId))
  const outstanding = snapshot.participants.filter(
    (person) => person.role === 'racer' && !done.has(person.userId),
  )
  const myPlace = placed.findIndex((result) => result.userId === snapshot.me)

  const raceAgain = async () => {
    setAgain(true)
    const backend = await raceBackend()
    if (backend === null) return setAgain(false)
    try {
      const roomId = await backend.quickMatch(snapshot.language)
      await navigate({ to: '/races/room/$roomId', params: { roomId } })
    } catch {
      setAgain(false)
    }
  }

  return (
    <div className="race-room" data-phase="results">
      <header className="race-results__head">
        <h1 className="race-display race-results__title" data-testid="race-results-title">
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
      </header>

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
            <span className="race-result__place">-</span>
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
            <span className="race-result__place">-</span>
            <span className="race-result__name">{person.nickname}</span>
            <span className="race-result__why">
              {finished ? m.race_did_not_finish() : m.race_still_typing()}
            </span>
          </li>
        ))}
      </ol>

      {finished ? null : <Track lanes={lanes} />}

      <p className="race-honest">{m.race_results_honest()}</p>

      <div className="race-gather__actions">
        <Button variant="primary" size="lg" disabled={again} onClick={() => void raceAgain()}>
          {m.race_again()}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void navigate({ to: '/races' })}>
          {m.race_back_to_lobby()}
        </Button>
      </div>
    </div>
  )
}
