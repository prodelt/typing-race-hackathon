import { Link } from '@tanstack/react-router'
import { keyOf, SHIFT_TOKEN } from '@typing-race/curriculum'
import type { AttemptMode, FocusElement, InputSource, Layout } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { useCallback, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { Arrow, order, ScreenHead } from '../screen.js'
import { displayChar, LAYOUT_NAMES } from './labels.js'
import { ModeToggle } from './ModeToggle.js'
import type { ExerciseTarget, ExerciseWording } from './wording.js'
import './exercise.css'

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

/** The focus element as the block's big glyph: one key, or the two keys of a transition. */
function focusGlyph(focus: FocusElement): string {
  if (focus.kind === 'key') return focus.value === SHIFT_TOKEN ? '⇧' : displayChar(focus.value)
  const pair = parseTransitionKey(focus.value)
  return pair === undefined ? focus.value : `${displayChar(pair.from)}${displayChar(pair.to)}`
}

/**
 * The pre-start screen.
 *
 * It states the one goal this scale serves before anything is typed and checks, before the first
 * keystroke can be counted, that the learner's keyboard can produce the exercise.
 *
 * The check has two halves because no single one works everywhere. `navigator.keyboard` reports the
 * physical layout but exists only in Chromium; the `InputSource` probe therefore reports "cannot
 * tell" elsewhere, and the typed-character half catches the rest: a Latin letter typed against a
 * Ukrainian exercise, or the reverse, is a mismatch no matter which browser said nothing.
 *
 * Composed like a brand-site section: the title and the goal on the left, and on the right the key
 * being learned, huge, on the red block (the same red the keyboard guide gives the awaited key).
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
  // A word drill has no single focus element: its block names what it drills instead.
  const glyph = scale.focus === null ? wording.focus : focusGlyph(scale.focus)
  const startIsPrimary = !(mode === 'practice' && testIsPrimary)

  return (
    <section aria-labelledby="exercise-title" className="screen">
      <ScreenHead
        n={2}
        label={mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
        title={wording.title}
        titleId="exercise-title"
        small
      />

      <div className="prestart">
        <div className="prestart__main rise" style={order(1)}>
          <p className="label">{wording.goalLabel}</p>
          <p data-testid="scale-goal" className="statement prestart__goal">
            {wording.goal}
          </p>

          <div className="prestart__mode">
            <ModeToggle scaleId={scale.id} mode={mode} testIsPrimary={testIsPrimary} />
            <p className="note">
              {mode === 'test' ? m.exercise_mode_test_hint() : m.exercise_mode_practice_hint()}
            </p>
          </div>

          {mismatch ? (
            <div role="alert" data-testid="layout-mismatch" className="prestart__alert">
              <p>{m.exercise_layout_mismatch({ layout: layoutName })}</p>
              <Button
                onClick={() => {
                  setTypedMismatch(false)
                  check()
                }}
              >
                {m.exercise_layout_recheck()}
              </Button>
            </div>
          ) : (
            <p role="status" className="note prestart__status">
              {probe === 'checking'
                ? m.exercise_layout_checking()
                : m.exercise_layout_ok({ layout: layoutName })}
            </p>
          )}

          <div className="prestart__go">
            {startIsPrimary ? (
              <button type="button" className="poster" disabled={mismatch} onClick={onStart}>
                <span>{m.exercise_start()}</span>
                <Arrow size={44} />
              </button>
            ) : (
              <Button size="lg" disabled={mismatch} onClick={onStart}>
                {m.exercise_start()}
              </Button>
            )}
            <Link to="/path" className="ulink">
              {m.exercise_back_to_path()}
            </Link>
          </div>
          <p className="note">{m.exercise_start_hint()}</p>
        </div>

        <aside
          className="prestart__aside rise"
          style={order(2)}
          aria-label={m.exercise_focus_label()}
        >
          <div className="prestart__glyph gp-host gp-host--ember panel--corner" aria-hidden="true">
            <GradLayer tone="ember" seed={3} count={3} />
            <span className="prestart__glyph-n">[{layoutName}]</span>
            <span
              className="prestart__glyph-char"
              data-size={glyph.length > 6 ? 'text' : glyph.length > 2 ? 'long' : undefined}
            >
              {glyph}
            </span>
          </div>
          <dl className="passport prestart__facts">
            <div>
              <dt>{m.exercise_focus_label()}</dt>
              <dd>{wording.focus}</dd>
            </div>
            <div>
              <dt>{m.exercise_mode_label()}</dt>
              <dd>{mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
