import type { AttemptMode, AttemptSummary } from '@typing-race/domain'
import { Index } from '@typing-race/ui'
import { memo } from 'react'
import { m } from '../../paraglide/messages.js'
import { formatElapsed } from './labels.js'
import type { ExerciseWording } from './wording.js'

export interface RailProps {
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  /** The last completed exercise, read **once** when the screen opened. */
  readonly last: AttemptSummary | null
  /** `null` when the learner has no Next Action yet. */
  readonly thisScaleIsNext: boolean | null
}

/** Shown where a figure has no value yet (no finished exercise to read it from). */
const NONE = '—'

function Figure({
  label,
  value,
  unit,
  testId,
}: {
  readonly label: string
  readonly value: string
  readonly unit?: string
  readonly testId: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-testid={testId}>
        {value}
        {unit === undefined ? null : <span className="rail__unit">{unit}</span>}
      </dd>
    </div>
  )
}

/**
 * The rail beside the typing line: plain type on the canvas, no boxes, so nothing in it competes
 * with the line for the eye.
 *
 * It is a pure function of props that are **frozen for the whole attempt**: `last` is the last
 * completed exercise, captured when the screen opened, so the figures cannot change while the
 * learner types. Nothing here subscribes to the engine. Together with `memo`, that is what keeps
 * the rail out of the keystroke path: no keystroke can reach it.
 *
 * In a Test Attempt the figures are not rendered at all (they would be live speed and accuracy
 * readouts of a kind) and a line of text says why the rail is quiet.
 */
function RailBase({ wording, mode, last, thisScaleIsNext }: RailProps) {
  return (
    <aside aria-label={m.exercise_rail_label()} className="rail">
      <div className="rail__block">
        <Index n={2}>{mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}</Index>
        <p className="sr-only">{m.exercise_focus_label()}</p>
        <p className="rail__focus">{wording.focus}</p>
        <p className="sr-only">{wording.goalLabel}</p>
        <p className="rail__text">{wording.goal}</p>
      </div>

      <div className="rail__rule" aria-hidden="true" />

      {mode === 'practice' ? (
        <div className="rail__block">
          <h2 className="label">{m.exercise_rail_last_title()}</h2>
          {last === null ? <p className="rail__text">{m.exercise_rail_last_none()}</p> : null}
          <dl data-testid="live-metrics" className="rail__figures">
            <Figure
              label={m.exercise_metric_speed()}
              value={last === null ? NONE : String(Math.round(last.metrics.spm))}
              {...(last === null ? {} : { unit: m.exercise_metric_speed_unit() })}
              testId="live-speed"
            />
            <Figure
              label={m.exercise_metric_accuracy()}
              value={last === null ? NONE : `${Math.round(last.metrics.accuracy * 100)}%`}
              testId="live-accuracy"
            />
            <Figure
              label={m.exercise_metric_errors()}
              value={last === null ? NONE : String(last.metrics.errorCount)}
              testId="live-errors"
            />
            <Figure
              label={m.exercise_metric_time()}
              value={last === null ? NONE : formatElapsed(last.elapsedMs)}
              testId="live-time"
            />
          </dl>
          <p className="note">{m.exercise_rail_last_frozen()}</p>
        </div>
      ) : (
        <p className="rail__text">{m.exercise_rail_zero_peek()}</p>
      )}

      <div className="rail__rule" aria-hidden="true" />

      <div className="rail__block">
        <h2 className="label">{m.exercise_rail_next_title()}</h2>
        <p className="rail__text">
          {thisScaleIsNext === true ? m.exercise_rail_next_this() : m.exercise_rail_next_later()}
        </p>
      </div>
    </aside>
  )
}

export const Rail = memo(RailBase)
