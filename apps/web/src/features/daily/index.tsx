import { Link } from '@tanstack/react-router'
import { dailyId } from '@typing-race/curriculum'
import { buttonClass } from '@typing-race/ui'
import { useEffect, useMemo } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { clearedDays, dayStreak, localDay, readStoredDays, writeStoredDays } from './model.js'

/**
 * The daily challenge: one shared exercise a day per language, with a done-today state and a day
 * count of its own in each language.
 */
export function DailyScreen() {
  const { layout, accuracyFloor } = useDerived()
  const { language } = layout
  const attempts = useAppStore((state) => state.attempts)
  const days = useMemo(
    () => clearedDays(attempts, accuracyFloor, readStoredDays(language), language),
    [attempts, accuracyFloor, language],
  )
  useEffect(() => writeStoredDays(language, days), [language, days])

  const now = new Date()
  const done = days.includes(localDay(now))
  const streak = dayStreak(days, now)

  return (
    <section className="mx-auto max-w-xl py-16">
      <h1 className="font-display text-3xl font-bold">{m.daily_title()}</h1>
      <p className="mt-3 font-ui leading-relaxed">{done ? m.daily_done() : m.daily_lead()}</p>
      <p className="mt-2 font-ui text-ink-soft" data-testid="daily-streak">
        {m.daily_streak({ count: String(streak) })}
      </p>
      <Link
        to="/exercise/$scaleId"
        params={{ scaleId: dailyId(layout) }}
        search={{ mode: 'practice' }}
        className={`${buttonClass(done ? 'secondary' : 'primary', 'md')} mt-6`}
      >
        {done ? m.daily_again() : m.daily_start()}
      </Link>
    </section>
  )
}
