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

/** This racer's place by distance covered so far (1-based), or `null` when not on the track. */
export function placeOf(lanes: readonly Lane[]): number | null {
  const mine = lanes.find((lane) => lane.me)
  if (mine === undefined) return null
  return 1 + lanes.filter((lane) => !lane.me && lane.done > mine.done).length
}

/**
 * The race as a track, in B's route-line language: each racer a marker riding their own line,
 * solid where they have been and dotted where they have yet to go, to a black finish square.
 * The learner's own line is the red one; everyone else is ink.
 *
 * Only `transform` moves (the walked line scales, the marker slides), so the track never reflows
 * the typing line next to it.
 */
export function Track({
  lanes,
  length,
  caption,
}: {
  readonly lanes: readonly Lane[]
  /** The text's length in characters, for the finish label. */
  readonly length?: number | undefined
  readonly caption?: string
}) {
  return (
    <section className="rt" aria-label={m.race_track_label()}>
      <div className="rt-scale" aria-hidden="true">
        <span>{m.race_track_start()}</span>
        {length === undefined ? null : <span>{m.race_track_finish({ n: String(length) })}</span>}
      </div>
      <ol className="rt-lanes">
        {lanes.map((lane, index) => (
          <li
            key={lane.userId}
            className={cx('rt-lane', lane.me && 'rt-lane--me')}
            data-testid="race-lane"
            data-finished={lane.finished || undefined}
          >
            <span className="rt-who">
              <span className="rt-n">{String(index + 1).padStart(2, '0')}</span>
              <span className="rt-name">{lane.nickname}</span>
              {lane.me ? <span className="rt-you">{m.race_you()}</span> : null}
            </span>
            {/* biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot hold the line and the marker that draw the lane */}
            <span
              className="rt-road"
              role="meter"
              aria-label={lane.nickname}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(lane.done * 100)}
            >
              <span className="rt-ride">
                <span className="rt-todo" />
                <span className="rt-done" style={{ transform: `scaleX(${lane.done})` }} />
                <span className="rt-rider" style={{ transform: `translateX(${lane.done * 100}%)` }}>
                  <span className="rt-marker" aria-hidden="true">
                    {Array.from(lane.nickname)[0]?.toUpperCase() ?? ''}
                  </span>
                </span>
              </span>
              <span className="rt-flag" aria-hidden="true" />
            </span>
            <span className="rt-spm">
              <b>{lane.spm ?? 0}</b>
              <span>{m.race_spm_unit()}</span>
            </span>
          </li>
        ))}
      </ol>
      {caption === undefined ? null : <p className="rt-caption">{caption}</p>}
    </section>
  )
}
