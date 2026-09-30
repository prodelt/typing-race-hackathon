import {
  type AcademyCourse,
  initialUnlockedSet,
  type RealText,
  realTextBlock,
  realTextId,
  type WordBank,
} from '@typing-race/curriculum'
import type { AttemptSummary, Layout, Progress } from '@typing-race/domain'
import { useEffect, useMemo, useState } from 'react'
import { loadWordBank } from '../../app/state/wordData.js'
import { seededRandom } from '../../seams/index.js'
import { loadAcademyCourse } from '../academy/data.js'
import { seedFor } from '../exercise/plan.js'
import { currentSpm, realTextChars } from './sizing.js'

/**
 * The session's real-text block, built from the Academy course and the word bank of the typing
 * language. Both are lazy chunks, so this loads them and then computes the block.
 *
 * The session card and the exercise screen each call this with the same attempt history, so the
 * seed (id + attempts already made on it) and the size (from current speed) agree, and the text
 * previewed on the card is the text the exercise asks for.
 */

export interface RealTextPlan {
  readonly block: RealText | null
  readonly seed: number
  readonly unlocked: readonly string[]
}

export type RealTextState =
  | { readonly status: 'loading' }
  | ({ readonly status: 'ready' } & RealTextPlan)

interface Sources {
  readonly course: AcademyCourse | null
  readonly bank: WordBank | null
}

function useSources(layout: Layout): Sources | null {
  const [sources, setSources] = useState<{ id: string; value: Sources } | null>(null)
  useEffect(() => {
    let live = true
    // Either may fail on its own; the block degrades to what is left, down to "none".
    void Promise.allSettled([
      loadAcademyCourse(layout.language),
      loadWordBank(layout.language),
    ]).then(([course, bank]) => {
      if (!live) return
      setSources({
        id: layout.id,
        value: {
          course: course.status === 'fulfilled' ? course.value : null,
          bank: bank.status === 'fulfilled' ? bank.value : null,
        },
      })
    })
    return () => {
      live = false
    }
  }, [layout])
  return sources?.id === layout.id ? sources.value : null
}

export function planRealText(args: {
  layout: Layout
  progress: Progress | null
  attempts: readonly AttemptSummary[]
  sources: Sources
}): RealTextPlan {
  const { layout, progress, attempts, sources } = args
  const id = realTextId(layout)
  const unlocked = progress?.unlockedSet ?? initialUnlockedSet(layout)
  const seed = seedFor(id, attempts.filter((attempt) => attempt.scaleId === id).length)
  const block = realTextBlock({
    layout,
    unlocked,
    stage1Complete: progress?.stage.stage1Complete === true,
    course: sources.course,
    bank: sources.bank,
    random: seededRandom(seed),
    size: realTextChars(currentSpm(attempts)),
  })
  return { block, seed, unlocked }
}

export function useRealText(
  layout: Layout,
  progress: Progress | null,
  attempts: readonly AttemptSummary[],
): RealTextState {
  const sources = useSources(layout)
  return useMemo(
    () =>
      sources === null
        ? { status: 'loading' }
        : { status: 'ready', ...planRealText({ layout, progress, attempts, sources }) },
    [layout, progress, attempts, sources],
  )
}
