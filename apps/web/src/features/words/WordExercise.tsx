import {
  generateWordText,
  initialUnlockedSet,
  REQUIREMENTS_UNMET,
  resolveWordDrill,
  type WordBank,
  weakElements,
} from '@typing-race/curriculum'
import type { AttemptMode, WordDrill } from '@typing-race/domain'
import { useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { seededRandom } from '../../seams/index.js'
import { BackToPath, ExerciseRun } from '../exercise/ExerciseSession.js'
import { type ExercisePlan, seedFor } from '../exercise/plan.js'
import { drillChip, drillGoal, drillName } from './labels.js'
import { useWordBank } from './useWordBank.js'
import './words.css'

/**
 * A Stage 2 drill on the ordinary exercise screen. The route and the engine are the Stage 1 ones:
 * words are space-separated text, a Test Attempt hides the keyboard and the next-key hint exactly
 * as it does for a scale, and the attempt is recorded against the drill's id, so the progress fold
 * counts its streak like any scale's.
 */
export function WordExercise({ drillId, mode }: { drillId: string; mode: AttemptMode }) {
  const derived = useDerived()
  const drill = resolveWordDrill(drillId)
  const bank = useWordBank(derived.layout.language)

  if (drill === undefined || drill.layoutId !== derived.layout.id) {
    return <Notice title={m.exercise_not_found_title()} body={m.exercise_not_found_body()} />
  }
  if (bank.status === 'error')
    return <Notice title={drillName(drill)} body={m.path_words_error()} />
  if (bank.status === 'loading') {
    return (
      <p role="status" className="words-wait">
        {m.path_words_exercise_loading()}
      </p>
    )
  }
  return <WordRun key={`${drill.id}:${mode}`} drill={drill} bank={bank.bank} mode={mode} />
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-ui text-2xl font-bold">{title}</h1>
      <p className="mt-3 font-ui leading-relaxed">{body}</p>
      <BackToPath />
    </section>
  )
}

function WordRun({ drill, bank, mode }: { drill: WordDrill; bank: WordBank; mode: AttemptMode }) {
  const derived = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const { layout, progress } = derived

  // Decided once, like a scale's plan: the store changes when the attempt ends, and a recomputed
  // text would hand the engine a different exercise at the moment it completes.
  const [frozen] = useState(() => {
    const unlocked = progress?.unlockedSet ?? initialUnlockedSet(layout)
    const weak = progress === null ? undefined : weakElements(progress, layout)
    const seed = seedFor(drill.id, attempts.filter((a) => a.scaleId === drill.id).length)
    const text = generateWordText({
      drill,
      bank,
      layout,
      unlocked,
      random: seededRandom(seed),
      ...(weak === undefined ? {} : { weak }),
    })
    const plan: ExercisePlan | null = text === REQUIREMENTS_UNMET ? null : { text, seed, unlocked }
    const name = drillName(drill)
    return {
      plan,
      wording: {
        title: name,
        goalLabel: m.path_words_goal_label(),
        goal: drillGoal(drill, layout, weak ?? { keys: [], transitions: [] }),
        focus: drillChip(drill),
      },
      last: attempts.at(-1) ?? null,
      keyConfidence: progress?.keyConfidence ?? {},
      testIsPrimary: attempts.some(
        (a) =>
          a.scaleId === drill.id &&
          a.mode === 'practice' &&
          a.metrics.accuracy >= derived.accuracyFloor,
      ),
      thisScaleIsNext:
        derived.nextAction === null ? null : derived.nextAction.startsScaleId === drill.id,
    }
  })

  if (frozen.plan === null) {
    return <Notice title={drillName(drill)} body={m.path_words_exercise_locked()} />
  }
  const { plan, ...rest } = frozen
  return (
    <ExerciseRun
      scale={{ ...drill, targetSpm: null }}
      mode={mode}
      plan={plan}
      layout={layout}
      {...rest}
    />
  )
}
