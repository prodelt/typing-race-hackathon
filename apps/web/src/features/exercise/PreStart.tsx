import { Link } from '@tanstack/react-router'
import type { AttemptMode, InputSource, Layout } from '@typing-race/domain'
import { Button, Card, Chip } from '@typing-race/ui'
import { useEffect, useRef } from 'react'
import { useGuideScreen } from '../../app/guide/model.js'
import { m } from '../../paraglide/messages.js'
import { LayoutStatus, useLayoutCheck } from './LayoutCheck.js'
import { HOME_ROW } from './labels.js'
import { ModeToggle } from './ModeToggle.js'
import type { ExerciseTarget, ExerciseWording } from './wording.js'

export interface PreStartProps {
  readonly scale: ExerciseTarget
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  readonly layout: Layout
  readonly input: InputSource
  readonly testIsPrimary: boolean
  /** The learner's first exercise, arriving from the first run: three lines and one button, nothing else. */
  readonly firstRun?: boolean
  readonly onStart: () => void
}

/**
 * T084. The pre-start screen (E1).
 *
 * It states the one goal this scale serves before anything is typed (FR-010) and checks, before the
 * first keystroke can be counted, that the learner's keyboard can produce the exercise (FR-021,
 * `useLayoutCheck`).
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
  firstRun = false,
  onStart,
}: PreStartProps) {
  const layoutCheck = useLayoutCheck(input, layout)
  const { mismatch } = layoutCheck

  // The first exercise has its own start card; the guide waits for the next ones.
  useGuideScreen('prestart', !firstRun)

  // Enter starts the first exercise, as it continues every step of the first run: the start button
  // takes the focus, so the key presses it natively and no listener is needed outside the seam.
  const actionsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (firstRun) actionsRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [firstRun])

  return (
    <section aria-labelledby="exercise-title" className="mx-auto w-full max-w-2xl">
      <Card raised className="p-8">
        {firstRun ? (
          <FirstStartLines layout={layout} />
        ) : (
          <>
            <h1 id="exercise-title" className="font-ui text-3xl font-semibold">
              {wording.title}
            </h1>

            <p className="mt-6 font-ui text-xs text-ink/70">{wording.goalLabel}</p>
            <p
              data-testid="scale-goal"
              data-guide="prestart-goal"
              className="mt-1 max-w-[60ch] font-ui text-lg leading-relaxed"
            >
              {wording.goal}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2" data-guide="prestart-mode">
              <Chip tone="neutral">{wording.focus}</Chip>
              <Chip tone={mode === 'test' ? 'terracotta' : 'sage'}>
                {mode === 'test' ? m.exercise_mode_test() : m.exercise_mode_practice()}
              </Chip>
              {wording.mechanics ? <Chip tone="neutral">{m.exercise_mechanics_tag()}</Chip> : null}
            </div>
            {wording.mechanics ? (
              <p
                data-testid="mechanics-note"
                className="mt-3 font-ui text-sm leading-relaxed text-ink/80"
              >
                {m.exercise_mechanics_note()}
              </p>
            ) : null}
            <p className="mt-3 font-ui text-sm leading-relaxed text-ink/80">
              {mode === 'test' ? m.exercise_mode_test_hint() : m.exercise_mode_practice_hint()}
            </p>
          </>
        )}

        {/* The first run's start card stays three lines unless the layout is actually wrong. */}
        {firstRun && !mismatch ? null : <LayoutStatus layout={layout} check={layoutCheck} />}

        <div ref={actionsRef} className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant={mode === 'practice' && testIsPrimary ? 'secondary' : 'primary'}
            disabled={mismatch}
            onClick={onStart}
            data-guide="prestart-start"
            {...(firstRun ? { hint: 'Enter', 'aria-keyshortcuts': 'Enter' } : {})}
          >
            {m.exercise_start()}
          </Button>
          {firstRun ? null : (
            <>
              <ModeToggle scaleId={scale.id} mode={mode} testIsPrimary={testIsPrimary} />
              <Link to="/map" className="font-ui text-sm text-sage underline underline-offset-4">
                {m.exercise_back_to_path()}
              </Link>
            </>
          )}
        </div>
        {firstRun ? null : (
          <p className="mt-3 font-ui text-xs text-ink/70">{m.exercise_start_hint()}</p>
        )}
      </Card>
    </section>
  )
}

/**
 * The first exercise's start card: where the hands go, where the eyes go, how to begin. Three short
 * lines in a fixed order, because a newcomer reads the top of a card and little else.
 */
function FirstStartLines({ layout }: { readonly layout: Layout }) {
  const lines = [
    m.exercise_first_hands({ row: HOME_ROW[layout.id] }),
    m.exercise_first_eyes(),
    m.exercise_first_go(),
  ]
  return (
    <>
      <h1 id="exercise-title" className="font-ui text-3xl font-semibold">
        {m.exercise_first_title()}
      </h1>
      <ol data-testid="first-start" className="mt-6 flex flex-col gap-4">
        {lines.map((line, index) => (
          <li key={line} className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-terracotta-tint font-ui text-base font-semibold"
            >
              {index + 1}
            </span>
            <span className="pt-1 font-ui text-lg leading-snug">{line}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
