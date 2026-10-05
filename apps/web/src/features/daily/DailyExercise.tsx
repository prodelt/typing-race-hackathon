import type { WordBank } from '@typing-race/curriculum'
import type { AttemptMode } from '@typing-race/domain'
import { useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ExerciseRun } from '../exercise/ExerciseSession.js'
import { useWordBank } from '../words/useWordBank.js'
import { dailyId, dailySeed, localDay, pickDailyWords } from './model.js'

/** Today's challenge on the ordinary exercise screen: same engine, guides and result screen. */
export function DailyExercise({ mode }: { readonly mode: AttemptMode }) {
  const { layout } = useDerived()
  const bank = useWordBank(layout.language)
  if (bank.status !== 'ready') {
    return (
      <p role="status" className="py-16 font-ui text-ink-soft">
        {bank.status === 'error' ? m.daily_error() : m.daily_loading()}
      </p>
    )
  }
  return <Run key={mode} bank={bank.bank} mode={mode} />
}

function Run({ bank, mode }: { readonly bank: WordBank; readonly mode: AttemptMode }) {
  const { layout, progress } = useDerived()
  const attempts = useAppStore((state) => state.attempts)

  // Decided once: the store changes when the attempt ends, and a recomputed text would hand the
  // engine a different exercise at the moment it completes.
  const [frozen] = useState(() => {
    const day = localDay(new Date())
    return {
      plan: {
        text: pickDailyWords(bank, day).join(' '),
        seed: dailySeed(day, bank.language),
        unlocked: progress?.unlockedSet ?? [],
      },
      wording: {
        title: m.daily_title(),
        goalLabel: m.daily_goal_label(),
        goal: m.daily_lead(),
        focus: day,
      },
      last: attempts.at(-1) ?? null,
      keyConfidence: progress?.keyConfidence ?? {},
      testIsPrimary: false,
    }
  })

  const { plan, ...rest } = frozen
  return (
    <ExerciseRun
      scale={{ id: dailyId(layout), layoutId: layout.id, focus: null, targetSpm: null }}
      mode={mode}
      plan={plan}
      layout={layout}
      {...rest}
    />
  )
}
