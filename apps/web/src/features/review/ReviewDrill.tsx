import { Link } from '@tanstack/react-router'
import {
  buildReviewDrill,
  initialUnlockedSet,
  parseReviewDrillId,
  REQUIREMENTS_UNMET,
  stage2Open,
  type WordBank,
} from '@typing-race/curriculum'
import type { AttemptMode } from '@typing-race/domain'
import { buttonClass } from '@typing-race/ui'
import { useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { seededRandom } from '../../seams/index.js'
import { ExerciseRun } from '../exercise/ExerciseSession.js'
import { seedFor } from '../exercise/plan.js'
import { useWordBank } from '../words/useWordBank.js'
import { spotLabel } from './format.js'

/**
 * The weak-spot drill on the ordinary exercise screen. Its id names the spots, so this rebuilds the
 * text from the id and a seed; once Stage 2 is open it waits for the word bank, because real words
 * are what the drill is then made of.
 */
export function ReviewDrillExercise({
  drillId,
  mode,
}: {
  readonly drillId: string
  readonly mode: AttemptMode
}) {
  const { layout, progress } = useDerived()
  const elements = parseReviewDrillId(layout, drillId)
  const unlocked = progress?.unlockedSet ?? initialUnlockedSet(layout)
  const wantsWords = stage2Open(layout, unlocked)
  const bank = useWordBank(layout.language)

  if (elements === undefined) return <Notice body={m.exercise_not_found_body()} />
  if (wantsWords && bank.status === 'loading') {
    return (
      <p role="status" className="py-16 font-ui text-ink-soft">
        {m.review_drill_loading()}
      </p>
    )
  }
  return (
    <Run
      key={mode}
      drillId={drillId}
      elements={elements}
      unlocked={unlocked}
      bank={wantsWords && bank.status === 'ready' ? bank.bank : null}
      mode={mode}
    />
  )
}

function Notice({ body }: { readonly body: string }) {
  return (
    <section className="mx-auto max-w-xl py-16">
      <h1 className="font-ui text-2xl font-bold">{m.review_drill_title()}</h1>
      <p className="mt-3 font-ui leading-relaxed">{body}</p>
      <Link to="/review" className={`${buttonClass('secondary', 'md')} mt-6`}>
        {m.review_back()}
      </Link>
    </section>
  )
}

function Run(props: {
  readonly drillId: string
  readonly elements: readonly string[]
  readonly unlocked: readonly string[]
  readonly bank: WordBank | null
  readonly mode: AttemptMode
}) {
  const { layout, progress, nextAction } = useDerived()
  const attempts = useAppStore((state) => state.attempts)

  // Decided once: the store changes when the attempt ends, and a recomputed text would hand the
  // engine a different exercise at the moment it completes.
  const [frozen] = useState(() => {
    const seed = seedFor(props.drillId, attempts.filter((a) => a.scaleId === props.drillId).length)
    const drill = buildReviewDrill({
      layout,
      unlocked: props.unlocked,
      elements: props.elements,
      bank: props.bank,
      random: seededRandom(seed),
    })
    if (drill === REQUIREMENTS_UNMET) return null
    const spots = drill.covered.map(spotLabel).join(', ')
    return {
      plan: { text: drill.text, seed, unlocked: props.unlocked },
      wording: {
        title: m.review_drill_title(),
        goalLabel: m.review_drill_goal_label(),
        goal:
          drill.mode === 'words'
            ? m.review_drill_goal_words({ spots })
            : m.review_drill_goal_moves({ spots }),
        focus: m.review_drill_chip(),
      },
      last: attempts.at(-1) ?? null,
      keyConfidence: progress?.keyConfidence ?? {},
      testIsPrimary: false,
      thisScaleIsNext: nextAction === null ? null : nextAction.startsScaleId === props.drillId,
    }
  })

  if (frozen === null) return <Notice body={m.review_drill_locked()} />
  const { plan, ...rest } = frozen
  return (
    <ExerciseRun
      scale={{ id: props.drillId, layoutId: layout.id, focus: null, targetSpm: null }}
      mode={props.mode}
      plan={plan}
      layout={layout}
      {...rest}
    />
  )
}
