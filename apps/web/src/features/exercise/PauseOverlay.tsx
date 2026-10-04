import { fingerOf } from '@typing-race/curriculum'
import type { AttemptMode, Layout } from '@typing-race/domain'
import type { EngineView } from '@typing-race/engine'
import { Button, Card } from '@typing-race/ui'
import { useEffect, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { displayChar, fingerLabel } from './labels.js'

export interface PauseOverlayProps {
  readonly layout: Layout
  readonly mode: AttemptMode
  /** Captured when the pause began; `lastError` survives Backspace, so it is the last real slip. */
  readonly lastError: EngineView['lastError']
  readonly onResume: () => void
  readonly onLeave: () => void
}

/**
 * T091. The Escape pause (FR-022).
 *
 * This is the only place during an attempt that names the finger behind the last error. The same
 * sentence inline, below and left of the line, would cost the learner a saccade exactly when they
 * have stumbled (ticket 20, item 17), so it is shown on request and never while typing.
 *
 * A Test Attempt carries no hints (spec §3.1, §4.2): there the pause names the slip but not the
 * finger, so it cannot be used to look the key up.
 */
export function PauseOverlay({ layout, mode, lastError, onResume, onLeave }: PauseOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The first button is Resume: Escape again, or Enter, carries on.
    overlayRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [])

  const finger = lastError === null ? undefined : fingerOf(layout, lastError.expected)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6"
    >
      <Card
        raised
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-pause-title"
        className="w-full max-w-md p-6"
      >
        <h2 id="exercise-pause-title" className="font-ui text-xl font-bold">
          {m.exercise_pause_title()}
        </h2>
        <p data-testid="pause-sentence" className="mt-3 font-ui leading-relaxed">
          {lastError === null || finger === undefined
            ? m.exercise_pause_no_error()
            : mode === 'test'
              ? m.exercise_pause_last_error_test({
                  expected: displayChar(lastError.expected),
                  got: displayChar(lastError.got),
                })
              : m.exercise_pause_last_error({
                  expected: displayChar(lastError.expected),
                  got: displayChar(lastError.got),
                  finger: fingerLabel(finger),
                })}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={onResume}>
            {m.exercise_pause_resume()}
          </Button>
          <Button variant="quiet" onClick={onLeave}>
            {m.exercise_pause_leave()}
          </Button>
        </div>
        <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_pause_leave_note()}</p>
      </Card>
    </div>
  )
}
