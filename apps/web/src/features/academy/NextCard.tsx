import { Link } from '@tanstack/react-router'
import {
  academyLevel,
  academyNextStep,
  academyProgress,
  findExercise,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { buttonClass, Card } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { languageOfExercise, useAcademyCourse } from './data.js'
import { local, percent } from './model.js'

/**
 * The result screen's one next action for an Academy attempt. It replaces the Stage 1 coach card:
 * the Academy's next step is to stay on this exercise until it is mastered, then move on in course
 * order (`academyNextStep`). Exactly one button, as on every result.
 */
export function AcademyNextCard({ attempt }: { readonly attempt: AttemptSummary }) {
  const language = languageOfExercise(attempt.scaleId) ?? 'uk'
  const state = useAcademyCourse(language)
  const attempts = useAppStore((s) => s.attempts)

  const model = useMemo(() => {
    if (state.status !== 'ready') return null
    const { course } = state
    const index = attempts.findIndex((a) => a.id === attempt.id)
    // "As of this attempt", like the rest of the result screen.
    const progress = academyProgress(course, index < 0 ? attempts : attempts.slice(0, index + 1))
    const next = academyNextStep(course, progress, {
      exerciseId: attempt.scaleId,
      mode: attempt.mode,
      accuracy: attempt.metrics.accuracy,
    })
    return { course, next, current: findExercise(course, attempt.scaleId) }
  }, [state, attempts, attempt])

  if (model === null) return null
  const { course, next, current } = model
  const floor = percent(academyLevel.accuracyFloor)

  let sentence: string
  let target: { id: string; mode: 'practice' | 'test' } | null = null
  let button = m.academy_result_next_button()
  switch (next.kind) {
    case 'practice':
      sentence = m.academy_result_below_floor({
        accuracy: (attempt.metrics.accuracy * 100).toFixed(1),
        floor,
      })
      target = { id: next.exerciseId, mode: 'practice' }
      button = m.academy_result_practice()
      break
    case 'test':
      sentence =
        attempt.mode === 'practice'
          ? m.academy_result_test_after_practice({ remaining: next.remaining, floor })
          : m.academy_result_test_after_test({ remaining: next.remaining, floor })
      target = { id: next.exerciseId, mode: 'test' }
      button = m.academy_result_test()
      break
    case 'next': {
      const upcoming = findExercise(course, next.exerciseId)
      const title = upcoming === undefined ? next.exerciseId : upcoming.exercise.title
      sentence =
        next.moduleComplete && current !== undefined
          ? m.academy_result_next_module({ module: local(current.module.title), title })
          : m.academy_result_next({ title })
      target = { id: next.exerciseId, mode: 'practice' }
      break
    }
    case 'courseComplete':
      sentence = m.academy_result_course()
  }

  return (
    <Card aria-labelledby="academy-result-next" role="region" raised className="p-5">
      <h2 id="academy-result-next" className="font-ui text-lg font-bold">
        {m.academy_result_heading()}
      </h2>
      {current === undefined ? null : (
        <p className="mt-1 font-ui text-sm text-muted">
          {m.academy_result_exercise({
            title: `${local(current.module.title)} · ${current.exercise.title}`,
          })}
        </p>
      )}
      <p className="mt-3 font-ui text-lg leading-relaxed" data-testid="academy-next">
        {sentence}
      </p>
      {target === null ? (
        <Link
          to="/academy"
          search={{ course: language }}
          className={`${buttonClass('primary', 'lg')} mt-4`}
        >
          {m.academy_back()}
        </Link>
      ) : (
        <Link
          to="/academy/$exerciseId"
          params={{ exerciseId: target.id }}
          search={{ mode: target.mode }}
          className={`${buttonClass('primary', 'lg')} mt-4`}
        >
          {button}
        </Link>
      )}
      <p className="mt-4">
        <Link
          to="/academy"
          search={{ course: language }}
          className="font-ui text-sm text-ink underline underline-offset-4"
        >
          {m.academy_back()}
        </Link>
      </p>
    </Card>
  )
}
