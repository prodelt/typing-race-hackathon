import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import {
  type AcademyCourse,
  type AcademyExercise,
  type AcademyModule,
  academyLevel,
  academyProgress,
  findExercise,
  layouts,
  MASTERY_STREAK,
} from '@typing-race/curriculum'
import type { AttemptMode, InputSource, Layout } from '@typing-race/domain'
import { buttonClass, cx } from '@typing-race/ui'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { domInputSource, systemClock } from '../../seams/index.js'
import { useEnginePaused } from '../exercise/engineHooks.js'
import { KeyboardGuide } from '../exercise/KeyboardGuide.js'
import { FingerDiagram, NextKeyCard } from '../exercise/NextKey.js'
import { PaceCue } from '../exercise/PaceCue.js'
import { PauseOverlay } from '../exercise/PauseOverlay.js'
import { seedFor } from '../exercise/plan.js'
import { TypingLine } from '../exercise/TypingLine.js'
import { useAttempt } from '../exercise/useAttempt.js'
import { languageOfExercise, scaleShapeOf, useAcademyCourse } from './data.js'
import { LAYOUT_NAME, local, percent } from './model.js'
import './academy.css'
import './exercise.css'

/**
 * One Academy exercise, run through the same engine, attempt controller, typing line and guides
 * as a Stage 1 scale. The text is fixed (the course file holds it), so there is no planning step.
 *
 * Zero-peek is the same rule as everywhere: in a test attempt the keyboard guide, the next-key
 * card and the finger diagram are not rendered at all.
 */

const FLOOR = percent(academyLevel.accuracyFloor)

export function AcademyExerciseScreen() {
  const params = useParams({ strict: false }) as { exerciseId?: string }
  const search = useSearch({ strict: false }) as { mode?: string }
  const id = params.exerciseId ?? ''
  const mode: AttemptMode = search.mode === 'test' ? 'test' : 'practice'
  const language = languageOfExercise(id) ?? 'uk'
  const state = useAcademyCourse(language)

  if (state.status === 'loading') {
    return (
      <p role="status" className="academy-status">
        {m.academy_loading()}
      </p>
    )
  }
  const found = state.status === 'ready' ? findExercise(state.course, id) : undefined
  if (state.status === 'error' || found === undefined) {
    return (
      <section className="mx-auto max-w-xl py-16">
        <h1 className="font-display text-3xl font-bold">{m.academy_not_found_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.academy_not_found_body()}</p>
        <Link
          to="/map"
          search={{ stage: 3 }}
          className={cx(buttonClass('secondary', 'md'), 'mt-6')}
        >
          {m.academy_back()}
        </Link>
      </section>
    )
  }
  const course = (state as { course: AcademyCourse }).course
  return (
    <AcademySession
      key={`${id}:${mode}`}
      course={course}
      module={found.module}
      exercise={found.exercise}
      mode={mode}
    />
  )
}

interface SessionProps {
  readonly course: AcademyCourse
  readonly module: AcademyModule
  readonly exercise: AcademyExercise
  readonly mode: AttemptMode
}

function allCharacters(layout: Layout): string[] {
  return layout.keys.flatMap((key) =>
    [key.plain, key.shifted].filter((c): c is string => c !== null && c !== ''),
  )
}

function AcademySession({ course, module, exercise, mode }: SessionProps) {
  const layout = layouts[course.layout]
  const derived = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const settings = useAppStore((state) => state.settings)
  const navigate = useNavigate()

  // Read once, like the Stage 1 screen: the store changes when the attempt finishes, and nothing
  // on this screen may change with it.
  const [frozen] = useState(() => {
    const progress = academyProgress(course, attempts)
    return {
      seed: seedFor(exercise.id, attempts.filter((a) => a.scaleId === exercise.id).length),
      streak: progress.exercises[exercise.id]?.streak ?? 0,
      mastered: progress.exercises[exercise.id]?.mastered ?? false,
      testIsPrimary: attempts.some(
        (a) =>
          a.scaleId === exercise.id &&
          a.mode === 'practice' &&
          a.metrics.accuracy >= academyLevel.accuracyFloor,
      ),
      keyConfidence: derived.layout.id === layout.id ? (derived.progress?.keyConfidence ?? {}) : {},
    }
  })
  const scale = useMemo(() => scaleShapeOf(exercise, layout.id), [exercise, layout.id])
  const unlocked = useMemo(() => allCharacters(layout), [layout])
  const n = course.modules.indexOf(module) + 1

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sourceRef = useRef<InputSource | null>(null)
  const [input, setInput] = useState<InputSource | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const element = textareaRef.current
    if (element === null || sourceRef.current !== null) return
    const source = domInputSource(element, systemClock, { expectedLayoutId: layout.id })
    sourceRef.current = source
    setInput(source)
    source.focus()
  }, [layout.id])

  const engine = useAttempt({
    active: started,
    input,
    scale,
    mode,
    layout,
    errorMode: settings.errorMode,
    text: exercise.text,
    seed: frozen.seed,
  })
  const paused = useEnginePaused(engine)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || engine === null) return
    if (engine.view.state === 'running') engine.pause()
    else if (engine.view.state === 'paused') resume()
  }
  const resume = (): void => {
    engine?.resume()
    input?.focus()
  }
  const onBlur = (): void => {
    if (engine === null || input === null || engine.view.state !== 'running') return
    if (document.hasFocus()) input.focus()
    else engine.pause()
  }

  const heading = (
    <p className="academy-ex__crumb">
      <span className="academy-ex__crumb-n">[{String(n).padStart(2, '0')}]</span>
      {local(module.title)}
    </p>
  )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape reaches the pause from the textarea and the dialog through this wrapper; every action is also a real button
    <div onKeyDown={onKeyDown} className="academy-ex" data-mode={mode}>
      <textarea
        ref={textareaRef}
        className="sr-only"
        aria-label={m.exercise_input_label()}
        data-testid="typing-input"
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
          heading={heading}
          exercise={exercise}
          mode={mode}
          layout={layout}
          input={input}
          streak={frozen.streak}
          mastered={frozen.mastered}
          testIsPrimary={frozen.testIsPrimary}
          onStart={() => setStarted(true)}
        />
      ) : null}

      {engine === null ? null : (
        <>
          <div className="academy-ex__run">
            <aside className="academy-ex__rail" aria-label={m.academy_ex_rail()}>
              {heading}
              <h1 className="academy-ex__title">{exercise.title}</h1>
              <p className="academy-ex__mode" data-mode={mode}>
                {mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
              </p>
              <p className="academy-ex__hint">
                {mode === 'test'
                  ? m.academy_ex_test_hint({ floor: FLOOR })
                  : m.academy_ex_practice_hint()}
              </p>
              <p className="academy-ex__hint">
                {m.academy_exercise_streak({ count: frozen.streak, target: MASTERY_STREAK })}
              </p>
            </aside>
            <div className="academy-ex__stage">
              <div className="pt-4">
                <TypingLine engine={engine} text={exercise.text} sizePx={settings.textSizePx} />
                <PaceCue engine={engine} scale={scale} text={exercise.text} />
              </div>
              {mode === 'practice' ? (
                <div className="flex flex-col gap-6">
                  <KeyboardGuide
                    engine={engine}
                    text={exercise.text}
                    layout={layout}
                    unlocked={unlocked}
                    keyConfidence={frozen.keyConfidence}
                  />
                  <div className="flex flex-wrap items-end gap-6">
                    <NextKeyCard engine={engine} text={exercise.text} layout={layout} />
                    <FingerDiagram engine={engine} text={exercise.text} layout={layout} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {paused ? (
            <PauseOverlay
              layout={layout}
              lastError={engine.view.lastError}
              onResume={resume}
              onLeave={() =>
                void navigate({ to: '/map', search: { stage: 3, course: course.language } })
              }
            />
          ) : null}
        </>
      )}
    </div>
  )
}

type Probe = 'checking' | 'ok' | 'mismatch'

function PreStart({
  heading,
  exercise,
  mode,
  layout,
  input,
  streak,
  mastered,
  testIsPrimary,
  onStart,
}: {
  readonly heading: React.ReactNode
  readonly exercise: AcademyExercise
  readonly mode: AttemptMode
  readonly layout: Layout
  readonly input: InputSource
  readonly streak: number
  readonly mastered: boolean
  readonly testIsPrimary: boolean
  readonly onStart: () => void
}) {
  const [probe, setProbe] = useState<Probe>('checking')
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

  const layoutName = LAYOUT_NAME[layout.language]
  const other: AttemptMode = mode === 'test' ? 'practice' : 'test'

  return (
    <section className="academy-pre" aria-labelledby="academy-ex-title">
      {heading}
      <h1 id="academy-ex-title" className="academy-pre__title">
        {exercise.title}
      </h1>
      <p className="academy-pre__text" lang={layout.language} data-testid="academy-text">
        {exercise.text}
      </p>
      <dl className="academy-pre__facts">
        <div>
          <dt>{m.exercise_mode_label()}</dt>
          <dd data-mode={mode}>
            {mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
          </dd>
        </div>
        <div>
          <dt>{m.academy_ex_chars({ count: [...exercise.text].length })}</dt>
          <dd>
            {exercise.targetSpm === null
              ? layoutName
              : m.academy_tempo({ spm: exercise.targetSpm })}
          </dd>
        </div>
        <div>
          <dt>{m.academy_test()}</dt>
          <dd>{mastered ? m.academy_exercise_mastered() : `${streak} / ${MASTERY_STREAK}`}</dd>
        </div>
      </dl>
      <p className="academy-pre__hint">
        {mode === 'test' ? m.academy_ex_test_hint({ floor: FLOOR }) : m.academy_ex_practice_hint()}
      </p>

      {probe === 'mismatch' ? (
        <div role="alert" className="academy-pre__alert">
          <p>{m.academy_ex_layout_mismatch({ layout: layoutName })}</p>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => check()}>
            {m.academy_ex_recheck()}
          </button>
        </div>
      ) : (
        <p role="status" className="academy-pre__probe">
          {probe === 'checking'
            ? m.academy_ex_layout_checking()
            : m.academy_ex_layout_ok({ layout: layoutName })}
        </p>
      )}

      <div className="academy-pre__actions">
        <button
          type="button"
          className={buttonClass(
            mode === 'practice' && testIsPrimary ? 'secondary' : 'primary',
            'lg',
          )}
          disabled={probe === 'mismatch'}
          onClick={onStart}
        >
          {m.academy_ex_start()}
        </button>
        <Link
          to="/academy/$exerciseId"
          params={{ exerciseId: exercise.id }}
          search={{ mode: other }}
          className={buttonClass(
            mode === 'practice' && testIsPrimary ? 'primary' : 'secondary',
            'lg',
          )}
        >
          {other === 'test' ? m.academy_ex_to_test() : m.academy_ex_to_practice()}
        </Link>
        <Link
          to="/map"
          search={{ stage: 3, course: layout.language }}
          className="academy-pre__back"
        >
          {m.academy_back()}
        </Link>
      </div>
    </section>
  )
}
