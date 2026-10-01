import type { AttemptMode, AttemptSummary } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { memo } from 'react'
import { m } from '../../paraglide/messages.js'
import { formatElapsed } from './labels.js'
import type { ExerciseWording } from './wording.js'

export interface HudProps {
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  /** The last completed exercise, read **once** when the screen opened. */
  readonly last: AttemptSummary | null
  readonly onPause: () => void
}

/**
 * The HUD above the typing line (direction B): the pause on Esc, what this attempt is, and, in a
 * Practice Attempt, the last completed exercise's numbers to beat.
 *
 * It is a pure function of props **frozen for the whole attempt**, so no keystroke can reach it:
 * the numbers here change between exercises, never while the learner types. The live time and
 * error count belong to the typing line, the one region an engine event repaints.
 *
 * In a Test Attempt the last-exercise numbers are not rendered at all: zero-peek is absence, not
 * a hidden node.
 */
function HudBase({ wording, mode, last, onPause }: HudProps) {
  const stat = (label: string, value: string, testId: string) => (
    <div>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  )
  return (
    <section className="play-hud" aria-label={m.exercise_hud_label()}>
      <div className="play-hud__left">
        <Button
          variant="secondary"
          size="sm"
          hint="Esc"
          aria-keyshortcuts="Escape"
          onClick={onPause}
        >
          {m.exercise_hud_pause()}
        </Button>
      </div>
      <div className="play-hud__mid">
        <p>
          <b>{mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}</b>
          {' · '}
          {wording.focus}
        </p>
        {mode === 'practice' ? (
          <div className="play-hud__last" title={m.exercise_rail_last_frozen()}>
            <span>{m.exercise_hud_last()}</span>
            <dl data-testid="live-metrics">
              {stat(
                m.exercise_metric_speed_unit(),
                last === null ? '—' : String(Math.round(last.metrics.spm)),
                'live-speed',
              )}
              {stat(
                m.exercise_metric_accuracy(),
                last === null ? '—' : `${Math.round(last.metrics.accuracy * 100)}%`,
                'live-accuracy',
              )}
              {stat(
                m.exercise_metric_errors(),
                last === null ? '—' : String(last.metrics.errorCount),
                'live-errors',
              )}
              {stat(
                m.exercise_metric_time(),
                last === null ? '—' : formatElapsed(last.elapsedMs),
                'live-time',
              )}
            </dl>
          </div>
        ) : null}
      </div>
      {/* The live time and error count sit here visually; they belong to the typing line. */}
      <div className="play-hud__right" />
    </section>
  )
}

export const Hud = memo(HudBase)
