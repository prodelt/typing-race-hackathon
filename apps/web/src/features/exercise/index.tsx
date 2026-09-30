import { useParams, useSearch } from '@tanstack/react-router'
import { isWordDrillId, scaleById } from '@typing-race/curriculum'
import type { AttemptMode } from '@typing-race/domain'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { WordExercise } from '../words/WordExercise.js'
import { BackToPath, ExerciseSession } from './ExerciseSession.js'

/**
 * The exercise screen — User Story 1, E1 to E3. `app/router.tsx` imports this name and nothing
 * else from the directory, and passes the route's `{ scaleId }` and typed `{ mode }` search.
 *
 * The session is keyed on scale and mode: switching either is a different attempt, so it must
 * start from a fresh input source and a fresh plan rather than carry state across.
 */
export function ExerciseScreen() {
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const { layout } = useDerived()

  // `mode` arrives already narrowed by the route's `validateSearch`; this only narrows the type.
  const mode: AttemptMode = search.mode === 'test' ? 'test' : 'practice'
  // Stage 2 word drills share this route, so a Next Action or a mode switch reaches them unchanged.
  if (params.scaleId !== undefined && isWordDrillId(params.scaleId)) {
    return <WordExercise drillId={params.scaleId} mode={mode} />
  }
  // An authored scale, or a Transition drill the coach built for this learner.
  const scale = scaleById(layout, params.scaleId ?? '')

  if (scale === undefined) {
    return (
      <section className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-ui text-2xl font-bold">{m.exercise_not_found_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.exercise_not_found_body()}</p>
        <BackToPath />
      </section>
    )
  }

  return <ExerciseSession key={`${scale.id}:${mode}`} scale={scale} mode={mode} />
}
