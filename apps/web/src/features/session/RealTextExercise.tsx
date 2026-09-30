import { Link } from '@tanstack/react-router'
import { realTextId } from '@typing-race/curriculum'
import type { AttemptMode } from '@typing-race/domain'
import { buttonClass } from '@typing-race/ui'
import { useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ExerciseRun } from '../exercise/ExerciseSession.js'
import { realTextKindLine } from './RealTextBlock.js'
import { type RealTextPlan, useRealText } from './useRealText.js'

/**
 * The fourth block on the ordinary exercise screen: the same engine, guides and result screen as
 * any exercise, recorded under `<layout>.realtext` so the session can see it was typed.
 */
export function RealTextExercise({ mode }: { readonly mode: AttemptMode }) {
  const { layout, progress } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const state = useRealText(layout, progress, attempts)

  if (state.status === 'loading') {
    return (
      <p role="status" className="py-16 font-ui text-ink-soft">
        {m.session_realtext_loading()}
      </p>
    )
  }
  if (state.block === null) {
    return (
      <section className="mx-auto max-w-xl py-16">
        <h1 className="font-ui text-2xl font-bold">{m.session_realtext_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.session_realtext_not_ready()}</p>
        <Link to="/session" className={`${buttonClass('secondary', 'md')} mt-6`}>
          {m.session_realtext_back()}
        </Link>
      </section>
    )
  }
  return <Run key={mode} plan={state} mode={mode} />
}

function Run({ plan, mode }: { readonly plan: RealTextPlan; readonly mode: AttemptMode }) {
  const { layout, progress, nextAction } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const id = realTextId(layout)

  // Read once: the attempt list changes when this attempt ends, and a recomputed text would hand
  // the engine a different exercise at the moment it completes.
  const [frozen] = useState(() => {
    const block = plan.block
    if (block === null) return null
    return {
      plan: { text: block.text, seed: plan.seed, unlocked: plan.unlocked },
      wording: {
        title: m.session_realtext_title(),
        goalLabel: m.session_realtext_goal_label(),
        goal: realTextKindLine(block),
        focus:
          block.kind === 'words' ? m.session_realtext_chip_words() : m.session_realtext_chip_text(),
      },
      last: attempts.at(-1) ?? null,
      keyConfidence: progress?.keyConfidence ?? {},
      testIsPrimary: false,
      thisScaleIsNext: nextAction === null ? null : nextAction.startsScaleId === id,
    }
  })
  if (frozen === null) return null

  const { plan: run, ...rest } = frozen
  return (
    <ExerciseRun
      scale={{ id, layoutId: layout.id, focus: null, targetSpm: null }}
      mode={mode}
      plan={run}
      layout={layout}
      {...rest}
    />
  )
}
