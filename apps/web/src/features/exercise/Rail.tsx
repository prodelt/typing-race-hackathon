import type { AttemptMode, AttemptSummary, Scale } from '@typing-race/domain'
import { Card, Chip } from '@typing-race/ui'
import { memo } from 'react'
import { m } from '../../paraglide/messages.js'
import { focusLabel, formatElapsed, GOAL_MESSAGES } from './labels.js'

export interface RailProps {
  readonly scale: Scale
  readonly mode: AttemptMode
  /** The last completed exercise, read **once** when the screen opened (FR-059). */
  readonly last: AttemptSummary | null
  /** `null` when the learner has no Next Action yet. */
  readonly thisScaleIsNext: boolean | null
}

function Tile({
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
    <div className="rounded-[var(--radius-field)] bg-paper px-3 py-2">
      <dt className="font-ui text-xs text-ink/70">{label}</dt>
      <dd className="m-0 font-mono text-lg tabular-nums" data-testid={testId}>
        {value}
        {unit === undefined ? null : <span className="ml-1 text-xs text-ink/70">{unit}</span>}
      </dd>
    </div>
  )
}

/**
 * T087. The 276 px left rail (ticket 20, decision 1).
 *
 * It is a pure function of props that are **frozen for the whole attempt**: `last` is the last
 * completed exercise, captured when the screen opened, so the 2x2 grid cannot change while the
 * learner types (FR-059, ticket 20 item 16). Nothing here subscribes to the engine. Together with
 * `memo`, that is what keeps the rail out of FR-069: no keystroke can reach it.
 *
 * In a Test Attempt the grid is not rendered at all — it would be live speed and accuracy readouts
 * of a kind (FR-037, 4) — and a line of text says why the rail is quiet.
 */
function RailBase({ scale, mode, last, thisScaleIsNext }: RailProps) {
  return (
    <aside aria-label={m.exercise_rail_label()} className="flex w-[276px] flex-col gap-4">
      <Card className="p-4">
        <p className="font-ui text-xs text-ink/70">{m.exercise_mode_label()}</p>
        <p className="mt-1">
          <Chip tone={mode === 'test' ? 'terracotta' : 'sage'}>
            {mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
          </Chip>
        </p>
        <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_focus_label()}</p>
        <p className="mt-1">
          <Chip tone="neutral">{focusLabel(scale.focus)}</Chip>
        </p>
        <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_goal_label()}</p>
        <p className="mt-1 font-ui text-sm leading-relaxed">{GOAL_MESSAGES[scale.type]()}</p>
      </Card>

      {mode === 'practice' ? (
        <Card className="p-4">
          <h2 className="font-ui text-sm font-semibold">{m.exercise_rail_last_title()}</h2>
          {last === null ? (
            <p className="mt-2 font-ui text-sm text-ink/70">{m.exercise_rail_last_none()}</p>
          ) : null}
          <dl data-testid="live-metrics" className="mt-3 grid grid-cols-2 gap-2">
            <Tile
              label={m.exercise_metric_speed()}
              value={last === null ? '—' : String(Math.round(last.metrics.spm))}
              {...(last === null ? {} : { unit: m.exercise_metric_speed_unit() })}
              testId="live-speed"
            />
            <Tile
              label={m.exercise_metric_accuracy()}
              value={last === null ? '—' : `${Math.round(last.metrics.accuracy * 100)}%`}
              testId="live-accuracy"
            />
            <Tile
              label={m.exercise_metric_errors()}
              value={last === null ? '—' : String(last.metrics.errorCount)}
              testId="live-errors"
            />
            <Tile
              label={m.exercise_metric_time()}
              value={last === null ? '—' : formatElapsed(last.elapsedMs)}
              testId="live-time"
            />
          </dl>
          <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_rail_last_frozen()}</p>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="font-ui text-sm leading-relaxed">{m.exercise_rail_zero_peek()}</p>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-ui text-sm font-semibold">{m.exercise_rail_next_title()}</h2>
        <p className="mt-2 font-ui text-sm leading-relaxed">
          {thisScaleIsNext === true ? m.exercise_rail_next_this() : m.exercise_rail_next_later()}
        </p>
      </Card>
    </aside>
  )
}

export const Rail = memo(RailBase)
