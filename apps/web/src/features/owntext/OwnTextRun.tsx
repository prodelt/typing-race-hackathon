import { Navigate } from '@tanstack/react-router'
import { initialUnlockedSet, ownTextId } from '@typing-race/curriculum'
import { useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { ExerciseRun } from '../exercise/ExerciseSession.js'
import { lastOwnText, type OwnText, ownTextWording } from './model.js'

/**
 * One run of an own text: free practice on the ordinary exercise screen, recorded under its own id
 * (`yq.owntext`) so mastery, XP, the streak, the daily goal, weak spots and sync all ignore it.
 * Always practice: there is no test of a text the learner brought.
 */
export function OwnTextRun({ own }: { readonly own: OwnText }) {
  const { layout, progress } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  // Read once: the attempt list changes when this attempt ends.
  const [frozen] = useState(() => ({
    plan: {
      text: own.text,
      seed: 0,
      unlocked: progress?.unlockedSet ?? initialUnlockedSet(layout),
    },
    wording: ownTextWording(own),
    last: attempts.at(-1) ?? null,
    keyConfidence: progress?.keyConfidence ?? {},
  }))
  return (
    <ExerciseRun
      scale={{ id: ownTextId(layout), layoutId: layout.id, focus: null, targetSpm: null }}
      mode="practice"
      layout={layout}
      testIsPrimary={false}
      {...frozen}
    />
  )
}

/**
 * "Again" from the result screen (`/exercise/yq.owntext`): the same text once more, or the form when
 * the text is gone (a reload, or another layout since).
 */
export function OwnTextAgain() {
  const { layout } = useDerived()
  const [own] = useState(() => lastOwnText(layout.id))
  if (own === null) return <Navigate to="/own" replace />
  return <OwnTextRun own={own} />
}
