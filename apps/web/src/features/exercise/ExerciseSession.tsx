import { Link, useNavigate } from '@tanstack/react-router'
import type { AttemptMode, InputSource, Layout, Scale } from '@typing-race/domain'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { domInputSource, systemClock } from '../../seams/index.js'
import { useEnginePaused } from './engineHooks.js'
import { PauseOverlay } from './PauseOverlay.js'
import { PreStart } from './PreStart.js'
import { type ExercisePlan, planExercise } from './plan.js'
import { TypingScreen } from './TypingScreen.js'
import { useAttempt } from './useAttempt.js'
import { type ExerciseTarget, type ExerciseWording, scaleWording } from './wording.js'

export interface ExerciseSessionProps {
  readonly scale: Scale
  readonly mode: AttemptMode
}

/** Everything one run needs, decided before it starts. Stage 2 word drills render this directly. */
export interface RunProps {
  readonly scale: ExerciseTarget
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  readonly plan: ExercisePlan
  readonly layout: Layout
  readonly last: Parameters<typeof TypingScreen>[0]['last']
  readonly keyConfidence: Parameters<typeof TypingScreen>[0]['keyConfidence']
  readonly testIsPrimary: boolean
}

/**
 * Resolves what this run will type, **once**.
 *
 * The plan and the rail's figures are read into `useState` initialisers, not recomputed from the
 * store on each render, because the store changes when an attempt finishes: a recomputed text would
 * hand the engine a different exercise at the moment it completes, and a recomputed "last exercise"
 * would unfreeze the rail (FR-059).
 */
export function ExerciseSession({ scale, mode }: ExerciseSessionProps) {
  const derived = useDerived()
  const attempts = useAppStore((state) => state.attempts)

  const [plan] = useState(() =>
    planExercise({
      scale,
      layout: derived.layout,
      unlocked: derived.progress?.unlockedSet,
      attemptsOnScale: attempts.filter((attempt) => attempt.scaleId === scale.id).length,
    }),
  )
  const [frozen] = useState(() => ({
    last: attempts.at(-1) ?? null,
    keyConfidence: derived.progress?.keyConfidence ?? {},
    // FR-036: once a Practice Attempt clears the floor, the test is the primary action.
    testIsPrimary: attempts.some(
      (attempt) =>
        attempt.scaleId === scale.id &&
        attempt.mode === 'practice' &&
        attempt.metrics.accuracy >= derived.accuracyFloor,
    ),
  }))

  if (plan === null) return <Locked />

  return (
    <ExerciseRun
      scale={scale}
      wording={scaleWording(scale)}
      mode={mode}
      plan={plan}
      layout={derived.layout}
      {...frozen}
    />
  )
}

function Locked() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-ui text-2xl font-bold">{m.exercise_locked_title()}</h1>
      <p className="mt-3 font-ui leading-relaxed">{m.exercise_locked_body()}</p>
      <BackToPath />
    </section>
  )
}

export function BackToPath() {
  return (
    <Link to="/map" className="mt-6 inline-block font-ui text-sage underline underline-offset-4">
      {m.exercise_back_to_path()}
    </Link>
  )
}

export function ExerciseRun({
  scale,
  wording,
  mode,
  plan,
  layout,
  last,
  keyConfidence,
  testIsPrimary,
}: RunProps) {
  const settings = useAppStore((state) => state.settings)
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sourceRef = useRef<InputSource | null>(null)
  const [input, setInput] = useState<InputSource | null>(null)
  const [started, setStarted] = useState(false)

  // The hidden textarea lives here, above both phases, so the input source — and with it the
  // layout probe — exists on the pre-start screen, before any engine does. The ref guards a
  // development double-mount from attaching the seam's listeners twice to one element.
  useEffect(() => {
    const element = textareaRef.current
    if (element === null || sourceRef.current !== null) return
    const source = domInputSource(element, systemClock, { expectedLayoutId: scale.layoutId })
    sourceRef.current = source
    setInput(source)
    source.focus()
  }, [scale.layoutId])

  const engine = useAttempt({
    active: started,
    input,
    scale,
    mode,
    layout,
    errorMode: settings.errorMode,
    text: plan.text,
    seed: plan.seed,
  })
  const paused = useEnginePaused(engine)

  // Escape is read from React's synthetic `keydown`, which bubbles up from the textarea and from
  // the pause dialog alike. It is not an input path: it reads no character and feeds no engine, so
  // it stays outside the InputSource seam, which `domInputSource` leaves to modifiers and dead keys.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || engine === null) return
    if (engine.view.state === 'running') engine.pause()
    else if (engine.view.state === 'paused') resume()
  }

  const resume = (): void => {
    engine?.resume()
    input?.focus()
  }

  // Losing focus while typing would otherwise eat keystrokes silently. A click inside the page
  // takes the focus back at once; leaving the window pauses, so away-time is not typing time.
  const onBlur = (): void => {
    if (engine === null || input === null || engine.view.state !== 'running') return
    if (document.hasFocus()) input.focus()
    else engine.pause()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a keydown on a wrapper is how Escape reaches the pause from the textarea and the dialog; every action here is also a real button
    <div onKeyDown={onKeyDown}>
      <textarea
        ref={textareaRef}
        className="sr-only"
        aria-label={m.exercise_input_label()}
        tabIndex={-1}
        rows={1}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onBlur={onBlur}
      />

      {!started && input !== null ? (
        <PreStart
          scale={scale}
          wording={wording}
          mode={mode}
          layout={layout}
          input={input}
          testIsPrimary={testIsPrimary}
          onStart={() => setStarted(true)}
        />
      ) : null}

      {engine === null ? null : (
        <>
          <TypingScreen
            engine={engine}
            scale={scale}
            wording={wording}
            mode={mode}
            layout={layout}
            text={plan.text}
            sizePx={settings.textSizePx}
            unlocked={plan.unlocked}
            keyConfidence={keyConfidence}
            last={last}
          />
          {paused ? (
            <PauseOverlay
              layout={layout}
              lastError={engine.view.lastError}
              onResume={resume}
              onLeave={() => void navigate({ to: '/map' })}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
