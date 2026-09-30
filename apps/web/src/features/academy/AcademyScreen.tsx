import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  type AcademyCourse,
  type AcademyModule,
  type AcademyNextStep,
  academyLevel,
  academyNextStep,
  academyProgress,
  type CourseProgress,
  findExercise,
  MASTERY_STREAK,
} from '@typing-race/curriculum'
import type { Language } from '@typing-race/domain'
import { Button, buttonClass, cx } from '@typing-race/ui'
import { type CSSProperties, useMemo, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { useAcademyCourse } from './data.js'
import { groupBySteps, LAYOUT_NAME, local, percent, STEP_NAMES } from './model.js'
import './academy.css'

/**
 * The Academy, Stage 3: the course contents page.
 *
 * Laid out like the contents of a printed course rather than a dashboard: a red panel with the
 * course's name and its three figures, then every module numbered `[01]`…, grouped under the §3.3
 * step it belongs to, each with a thin red rule for progress. A completed module is stamped, its
 * number filled red, so a glance down the page reads what is done.
 *
 * Everything shown is a fold over the stored attempts (`academyProgress`); nothing is cached.
 */

const FLOOR = percent(academyLevel.accuracyFloor)

function order(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

export function AcademyScreen() {
  const search = useSearch({ strict: false }) as { course?: string }
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const language: Language =
    search.course === 'uk' || search.course === 'en' ? search.course : typingLanguage
  const state = useAcademyCourse(language)

  if (state.status === 'loading') {
    return (
      <p role="status" className="academy-status">
        {m.academy_loading()}
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="academy-status">
        {m.academy_error()}
      </p>
    )
  }
  return <Contents course={state.course} language={language} />
}

function Contents({ course, language }: { course: AcademyCourse; language: Language }) {
  const attempts = useAppStore((state) => state.attempts)
  const { progress: stage1 } = useDerived()
  const progress = useMemo(() => academyProgress(course, attempts), [course, attempts])
  const next = useMemo(() => academyNextStep(course, progress, null), [course, progress])
  const exerciseCount = progress.exercisesTotal
  const stage1Complete = stage1?.stage.stage1Complete === true

  return (
    <article className="academy" data-course={language}>
      <section className="academy-panel gp-host gp-host--ember" aria-labelledby="academy-title">
        <GradLayer tone="ember" seed={11} count={4} />
        <div className="academy-panel__top">
          <CourseSwitch current={language} />
          <span className="academy-panel__layout">{LAYOUT_NAME[language]}</span>
        </div>

        <div className="academy-panel__body">
          <div>
            <h1 id="academy-title" className="academy-panel__title">
              {m.academy_title()}
              <span className="academy-dot" aria-hidden="true" />
            </h1>
            <p className="academy-panel__lead">{m.academy_lead()}</p>
            <NextButton course={course} next={next} />
          </div>

          <dl className="academy-facts" data-testid="academy-facts">
            <div>
              <dt>{m.academy_stat_modules()}</dt>
              <dd>{course.modules.length}</dd>
            </div>
            <div>
              <dt>{m.academy_stat_exercises()}</dt>
              <dd>{exerciseCount}</dd>
            </div>
            <div>
              <dt>{m.academy_stat_complete()}</dt>
              <dd data-testid="academy-modules-complete">
                {progress.modulesComplete}
                <span className="academy-facts__of"> / {course.modules.length}</span>
              </dd>
            </div>
          </dl>
        </div>
        <Rule fraction={progress.fraction} tone="light" />
      </section>

      <div className="academy-notes">
        <p className="academy-note" data-stage1={stage1Complete ? 'complete' : 'open'}>
          {stage1Complete ? (
            m.academy_assumes_done()
          ) : (
            <>
              <strong>{m.academy_assumes_title()}.</strong> {m.academy_assumes_body()}
            </>
          )}
        </p>
        <p className="academy-note academy-note--criterion">
          {m.academy_criterion({ floor: FLOOR })}
        </p>
      </div>

      <ol className="academy-contents" aria-label={m.academy_title()}>
        {groupBySteps(course.modules).map((group, groupIndex) => (
          <li key={group.step} className="academy-step" style={order(groupIndex)}>
            <h2 className="academy-step__name">
              <span className="academy-step__n">{String(groupIndex + 1).padStart(2, '0')}</span>
              {STEP_NAMES[group.step]()}
            </h2>
            <ol className="academy-step__modules">
              {group.modules.map(({ module, n }) => (
                <ModuleRow key={module.id} module={module} n={n} progress={progress} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </article>
  )
}

function CourseSwitch({ current }: { current: Language }) {
  const navigate = useNavigate()
  const options: { value: Language; label: string }[] = [
    { value: 'uk', label: m.academy_course_uk() },
    { value: 'en', label: m.academy_course_en() },
  ]
  return (
    // biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, as in the shell's language switch
    <div role="group" aria-label={m.academy_course_group()} className="academy-switch">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={option.value === current}
          className="academy-switch__option"
          onClick={() => void navigate({ to: '/academy', search: { course: option.value } })}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function NextButton({ course, next }: { course: AcademyCourse; next: AcademyNextStep }) {
  if (next.kind === 'courseComplete') {
    return <p className="academy-panel__done">{m.academy_course_complete()}</p>
  }
  const found = findExercise(course, next.exerciseId)
  if (found === undefined) return null
  return (
    <Link
      to="/academy/$exerciseId"
      params={{ exerciseId: next.exerciseId }}
      search={{ mode: next.kind === 'test' ? 'test' : 'practice' }}
      className={cx(buttonClass('secondary', 'lg'), 'academy-panel__cta')}
    >
      {m.academy_continue({ title: found.exercise.title })}
    </Link>
  )
}

/** A thin rule: a hairline, and over it a red segment as long as the progress. */
function Rule({ fraction, tone }: { fraction: number; tone: 'light' | 'ink' }) {
  return (
    <div
      className="academy-rule"
      data-tone={tone}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent(fraction)}
      aria-label={`${percent(fraction)}%`}
    >
      <span className="academy-rule__fill" style={{ '--p': fraction } as CSSProperties} />
    </div>
  )
}

function ModuleRow({
  module,
  n,
  progress,
}: {
  module: AcademyModule
  n: number
  progress: CourseProgress
}) {
  const state = progress.modules[module.id]
  const complete = state?.complete === true
  const [open, setOpen] = useState(false)
  const title = local(module.title)
  const listId = `academy-${module.id}-exercises`

  return (
    <li
      className="academy-module"
      data-complete={complete || undefined}
      data-module={module.id}
      data-testid={`module-${module.id}`}
    >
      <span className="academy-module__index" aria-hidden="true">
        [{String(n).padStart(2, '0')}]
      </span>

      <div className="academy-module__main">
        <h3 className="academy-module__title">{title}</h3>
        <p className="academy-module__summary">{local(module.summary)}</p>
        <Button
          variant="quiet"
          size="sm"
          className="academy-module__toggle"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${open ? m.academy_module_hide() : m.academy_module_show()}: ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? m.academy_module_hide() : m.academy_module_show()}
          <span className="academy-module__chev" data-open={open || undefined} aria-hidden="true" />
        </Button>
      </div>

      <div className="academy-module__meta">
        {complete ? (
          <span className="academy-stamp" data-testid="module-complete">
            {m.academy_module_complete()}
          </span>
        ) : null}
        <span className="academy-module__count" data-testid="module-count">
          {m.academy_module_count({
            mastered: state?.mastered ?? 0,
            total: module.exercises.length,
          })}
        </span>
        <Rule fraction={state?.fraction ?? 0} tone="ink" />
      </div>

      {open ? (
        <ol id={listId} className="academy-exercises">
          {module.exercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.id}
              index={index}
              exercise={exercise}
              state={progress.exercises[exercise.id]}
            />
          ))}
        </ol>
      ) : null}
    </li>
  )
}

function ExerciseRow({
  index,
  exercise,
  state,
}: {
  index: number
  exercise: AcademyModule['exercises'][number]
  state: CourseProgress['exercises'][string] | undefined
}) {
  const label = state?.mastered
    ? m.academy_exercise_mastered()
    : state !== undefined && state.streak > 0
      ? m.academy_exercise_streak({ count: state.streak, target: MASTERY_STREAK })
      : state?.practiced
        ? m.academy_exercise_practiced()
        : m.academy_exercise_new()

  return (
    <li
      className="academy-exercise"
      data-mastered={state?.mastered || undefined}
      data-testid={`exercise-${exercise.id}`}
      style={order(index)}
    >
      <span className="academy-exercise__n">{index + 1}</span>
      <div className="academy-exercise__body">
        <p className="academy-exercise__title">
          {exercise.title}
          {exercise.targetSpm !== null ? (
            <span className="academy-exercise__tempo">
              {m.academy_tempo({ spm: exercise.targetSpm })}
            </span>
          ) : null}
        </p>
        <p className="academy-exercise__text" lang={exercise.id.split('.')[1]}>
          {exercise.text}
        </p>
      </div>
      <span className="academy-exercise__state" data-testid="exercise-state">
        {label}
      </span>
      <div className="academy-exercise__actions">
        <Link
          to="/academy/$exerciseId"
          params={{ exerciseId: exercise.id }}
          search={{ mode: 'practice' }}
          className={buttonClass('secondary', 'sm')}
          aria-label={m.academy_practice_named({ title: exercise.title })}
        >
          {m.academy_practice()}
        </Link>
        <Link
          to="/academy/$exerciseId"
          params={{ exerciseId: exercise.id }}
          search={{ mode: 'test' }}
          className={buttonClass('quiet', 'sm')}
          aria-label={m.academy_test_named({ title: exercise.title })}
        >
          {m.academy_test()}
        </Link>
      </div>
    </li>
  )
}
