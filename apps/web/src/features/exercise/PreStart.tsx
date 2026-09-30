import { Link } from '@tanstack/react-router'
import { keyOf } from '@typing-race/curriculum'
import type { AttemptMode, InputSource, Layout } from '@typing-race/domain'
import { Button, Card, Chip } from '@typing-race/ui'
import { useCallback, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { LAYOUT_NAMES } from './labels.js'
import { ModeToggle } from './ModeToggle.js'
import type { ExerciseTarget, ExerciseWording } from './wording.js'

export interface PreStartProps {
  readonly scale: ExerciseTarget
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  readonly layout: Layout
  readonly input: InputSource
  readonly testIsPrimary: boolean
  readonly onStart: () => void
}

type Probe = 'checking' | 'ok' | 'mismatch'

/**
 * T084. The pre-start screen (E1).
 *
 * It states the one goal this scale serves before anything is typed (FR-010) and checks, before the
 * first keystroke can be counted, that the learner's keyboard can produce the exercise (FR-021).
 *
 * The check has two halves because no single one works everywhere. `navigator.keyboard` reports the
 * physical layout but exists only in Chromium; the `InputSource` probe therefore reports "cannot
 * tell" elsewhere, and the typed-character half catches the rest: a Latin letter typed against a
 * Ukrainian exercise, or the reverse, is a mismatch no matter which browser said nothing.
 *
 * Repeating any unlocked exercise starts here too (FR-045).
 */
export function PreStart({
  scale,
  wording,
  mode,
  layout,
  input,
  testIsPrimary,
  onStart,
}: PreStartProps) {
  const [probe, setProbe] = useState<Probe>('checking')
  const [typedMismatch, setTypedMismatch] = useState(false)

  const check = useCallback(() => {
    let live = true
    setProbe('checking')
    void input.probeLayout().then((result) => {
      if (live) setProbe(result.producible ? 'ok' : 'mismatch')
    })
    return () => {
      live = false
    }
  }, [input])

  useEffect(() => check(), [check])

  useEffect(
    () =>
      input.subscribe((event) => {
        if (event.kind !== 'char' || !/\p{L}/u.test(event.char)) return
        setTypedMismatch(keyOf(layout, event.char.toLowerCase()) === undefined)
      }),
    [input, layout],
  )

  const mismatch = probe === 'mismatch' || typedMismatch
  const layoutName = LAYOUT_NAMES[layout.id]

  return (
    <section aria-labelledby="exercise-title" className="mx-auto w-full max-w-2xl">
      <Card raised className="p-8">
        <h1 id="exercise-title" className="font-ui text-3xl font-semibold">
          {wording.title}
        </h1>

        <p className="mt-6 font-ui text-xs text-ink/70">{wording.goalLabel}</p>
        <p data-testid="scale-goal" className="mt-1 max-w-[60ch] font-ui text-lg leading-relaxed">
          {wording.goal}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{wording.focus}</Chip>
          <Chip tone={mode === 'test' ? 'terracotta' : 'sage'}>
            {mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
          </Chip>
        </div>
        <p className="mt-3 font-ui text-sm leading-relaxed text-ink/80">
          {mode === 'test' ? m.exercise_mode_test_hint() : m.exercise_mode_practice_hint()}
        </p>

        {mismatch ? (
          <div
            role="alert"
            data-testid="layout-mismatch"
            className="mt-6 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-terracotta bg-terracotta-tint p-4"
          >
            <p className="font-ui leading-relaxed">
              {m.exercise_layout_mismatch({ layout: layoutName })}
            </p>
            <Button
              className="mt-3"
              onClick={() => {
                setTypedMismatch(false)
                check()
              }}
            >
              {m.exercise_layout_recheck()}
            </Button>
          </div>
        ) : (
          <p role="status" className="mt-6 font-ui text-sm leading-relaxed text-ink/80">
            {probe === 'checking'
              ? m.exercise_layout_checking()
              : m.exercise_layout_ok({ layout: layoutName })}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant={mode === 'practice' && testIsPrimary ? 'secondary' : 'primary'}
            disabled={mismatch}
            onClick={onStart}
          >
            {m.exercise_start()}
          </Button>
          <ModeToggle scaleId={scale.id} mode={mode} testIsPrimary={testIsPrimary} />
          <Link to="/path" className="font-ui text-sm text-sage underline underline-offset-4">
            {m.exercise_back_to_path()}
          </Link>
        </div>
        <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_start_hint()}</p>
      </Card>
    </section>
  )
}
