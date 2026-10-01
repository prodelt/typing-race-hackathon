import { Link } from '@tanstack/react-router'
import { buttonClass } from '@typing-race/ui'
import { useGameStats } from '../../app/state/gameStats.js'
import { m } from '../../paraglide/messages.js'

/**
 * Profile, destination 05. A minimal placeholder until the cloud tickets add sign-in, history and
 * achievements: who is playing and the four game numbers, readable on a phone too.
 */
export function ProfileScreen() {
  const stats = useGameStats()
  const figures = [
    { label: m.profile_level(), value: String(stats.level) },
    {
      label: m.profile_streak(),
      value: m.profile_streak_value({ days: String(stats.streak.days) }),
    },
    {
      label: m.profile_goal(),
      value: m.profile_goal_value({
        today: String(stats.dailyGoal.minutesToday),
        goal: String(stats.dailyGoal.goalMinutes),
      }),
    },
    {
      label: m.profile_rating(),
      value: stats.raceRating === null ? m.profile_rating_none() : String(stats.raceRating),
    },
  ]

  return (
    <section className="grid max-w-3xl gap-6" aria-labelledby="profile-title">
      <header>
        <h1 id="profile-title" className="font-display text-3xl font-semibold tracking-[-0.04em]">
          {m.profile_title()}
        </h1>
        <p className="mt-2 font-ui text-ink-soft">{m.profile_lead()}</p>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-paper-raised p-4">
            <dt className="font-ui text-sm font-medium text-muted">{figure.label}</dt>
            <dd className="mt-2 font-display text-2xl font-medium tracking-[-0.04em]">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="font-ui text-ink-soft">{m.profile_soon()}</p>

      <div>
        <Link to="/settings" className={buttonClass('secondary', 'md')}>
          {m.shell_settings()}
        </Link>
      </div>
    </section>
  )
}
