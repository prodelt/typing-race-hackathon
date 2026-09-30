import { Link, useNavigate } from '@tanstack/react-router'
import { Button, Card, Chip } from '@typing-race/ui'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { nextActionText } from './labels.js'
import { MASTERY_STREAK, streakFor, totalKeyCount, unlockedKeyCount } from './model.js'
import { StartingLevel } from './StartingLevel.js'

/**
 * T112. Today, L1 — the hub a returning learner sees first.
 *
 * It shows exactly one Next Action (FR-031). The type of `nextAction` is a single value, not a
 * list, so there is no second action to render by accident; the button starts that scale and
 * nothing else on the screen competes with it for the primary style.
 *
 * With no starting-level answer there is no progress to show, and inventing a default boundary
 * would pick one on the learner's behalf, so the question replaces the hub (FR-048).
 */

const LINK_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline-strong bg-paper-raised font-ui font-semibold h-10 px-4 text-[0.95rem] hover:bg-sage-tint'

export function TodayScreen() {
  const navigate = useNavigate()
  const { progress, nextAction, layout, catalogue, accuracyFloor } = useDerived()

  if (progress === null || nextAction === null) return <StartingLevel mode="first" />

  const streak = streakFor(progress, nextAction.startsScaleId)
  const floor = Math.round(accuracyFloor * 100)

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-ui text-2xl font-bold">{m.path_today_title()}</h1>
        <p className="mt-1 font-ui text-muted">{m.path_today_lead()}</p>
      </header>

      <Card raised className="p-6" role="region" aria-labelledby="today-next-title">
        <h2 id="today-next-title" className="font-mono text-xs uppercase tracking-wide text-muted">
          {m.path_next_title()}
        </h2>
        <p className="mt-3 font-ui text-xl" data-testid="next-action">
          {nextActionText(nextAction, (id) => catalogue.find((scale) => scale.id === id))}
        </p>
        <div className="mt-5">
          <Button
            variant="primary"
            size="lg"
            onClick={() =>
              void navigate({
                to: '/exercise/$scaleId',
                params: { scaleId: nextAction.startsScaleId },
                search: { mode: 'practice' },
              })
            }
          >
            {m.path_next_start()}
          </Button>
        </div>
      </Card>

      <Card className="p-6" role="region" aria-labelledby="today-where-title">
        <h2 id="today-where-title" className="font-ui text-lg font-bold">
          {m.path_where_title()}
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs text-muted">{m.path_where_stage()}</dt>
            <dd className="font-ui">{m.path_where_stage_value({ n: progress.stage.current })}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-muted">{m.path_where_level()}</dt>
            <dd className="font-ui">{m.path_level_introduction()}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-muted">{m.path_where_keys()}</dt>
            <dd className="font-ui">
              {m.path_where_keys_value({
                unlocked: unlockedKeyCount(progress),
                total: totalKeyCount(layout),
              })}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-muted">{m.path_where_streak()}</dt>
            <dd className="font-ui">
              {m.path_where_streak_value({ count: streak, target: MASTERY_STREAK })}
            </dd>
          </div>
        </dl>
        <p className="mt-4 font-ui text-sm text-muted">
          {m.path_streak_explain({ target: MASTERY_STREAK, floor })}
        </p>
        {progress.stage.stage1Complete && (
          <p className="mt-3">
            <Chip tone="sage">{m.path_stage1_complete()}</Chip>
          </p>
        )}
      </Card>

      <nav className="flex flex-wrap gap-3">
        <Link to="/session" className={LINK_SECONDARY}>
          {m.path_open_session()}
        </Link>
        <Link to="/path" className={LINK_SECONDARY}>
          {m.path_open_path()}
        </Link>
        <Link to="/academy" className={LINK_SECONDARY} data-testid="today-academy">
          {m.academy_stage_open()}
        </Link>
      </nav>
    </div>
  )
}
