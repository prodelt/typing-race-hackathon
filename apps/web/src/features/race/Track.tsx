import { cx } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import type { ProgressMessage, RoomSnapshot } from '../../sync/race.js'

export interface Lane {
  readonly userId: string
  readonly nickname: string
  /** 0..1 */
  readonly done: number
  readonly spm: number | null
  readonly finished: boolean
  readonly me: boolean
}

/** One lane per racer, in join order. Positions are what the racers broadcast: approximate. */
export function lanesOf(
  snapshot: RoomSnapshot,
  progress: Readonly<Record<string, ProgressMessage>>,
): Lane[] {
  const finished = new Set(snapshot.results.map((result) => result.userId))
  return snapshot.participants
    .filter((person) => person.role === 'racer' || finished.has(person.userId))
    .map((person) => {
      const live = progress[person.userId]
      const result = snapshot.results.find((row) => row.userId === person.userId)
      const done = finished.has(person.userId)
        ? 1
        : live && live.total > 0
          ? Math.min(1, live.cursor / live.total)
          : 0
      return {
        userId: person.userId,
        nickname: person.nickname,
        done,
        spm: result ? Math.round(result.spm) : live ? Math.round(live.spm) : null,
        finished: finished.has(person.userId),
        me: person.userId === snapshot.me,
      }
    })
}

export function Track({
  lanes,
  caption,
}: {
  readonly lanes: readonly Lane[]
  readonly caption?: string
}) {
  return (
    <section className="race-track" aria-label={m.race_track_label()}>
      <ol className="race-track__lanes">
        {lanes.map((lane, index) => (
          <li
            key={lane.userId}
            className={cx('race-lane', lane.me && 'race-lane--me')}
            data-testid="race-lane"
            data-finished={lane.finished || undefined}
          >
            <span className="race-lane__n">[{String(index + 1).padStart(2, '0')}]</span>
            <span className="race-lane__name">
              {lane.nickname}
              {lane.me ? <span className="race-lane__you">{m.race_you()}</span> : null}
            </span>
            {/* biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot hold the fill and the rider that draw the lane */}
            <span
              className="race-lane__road"
              role="meter"
              aria-label={lane.nickname}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(lane.done * 100)}
            >
              <span className="race-lane__fill" style={{ transform: `scaleX(${lane.done})` }} />
              {/* A full-width layer translated by the progress, so only `transform` animates. */}
              <span
                className="race-lane__rider"
                style={{ transform: `translateX(${lane.done * 100}%)` }}
                aria-hidden="true"
              />
            </span>
            <span className="race-lane__spm">
              {lane.spm ?? 0}
              <span className="race-lane__unit">{m.race_spm_unit()}</span>
            </span>
          </li>
        ))}
      </ol>
      {caption === undefined ? null : <p className="race-track__caption">{caption}</p>}
    </section>
  )
}
