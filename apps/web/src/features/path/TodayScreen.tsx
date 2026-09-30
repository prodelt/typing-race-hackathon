import { Link, useNavigate } from '@tanstack/react-router'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { Arrow, order, ScreenHead } from '../screen.js'
import { nextActionText } from './labels.js'
import { MASTERY_STREAK, streakFor, totalKeyCount, unlockedKeyCount } from './model.js'
import { StartingLevel } from './StartingLevel.js'
import './path.css'

/**
 * Today — the hub a returning learner sees first.
 *
 * It shows exactly one Next Action. The type of `nextAction` is a single value, not a list, so
 * there is no second action to render by accident: the sentence is the screen's statement and the
 * one red poster button starts it. Everything else (where the learner is, the streak) sits in the
 * quieter column beside it.
 *
 * With no starting-level answer there is no progress to show, and inventing a default boundary
 * would pick one on the learner's behalf, so the question replaces the hub.
 */
export function TodayScreen() {
  const navigate = useNavigate()
  const { progress, nextAction, layout, catalogue, accuracyFloor } = useDerived()

  if (progress === null || nextAction === null) return <StartingLevel mode="first" />

  const streak = streakFor(progress, nextAction.startsScaleId)
  const floor = Math.round(accuracyFloor * 100)
  const unlocked = unlockedKeyCount(progress)
  const total = totalKeyCount(layout)

  return (
    <div className="screen">
      <ScreenHead n={1} label={m.path_today_title()} title={m.path_today_title()} dot />

      <div className="today">
        <section className="today__next rise" style={order(1)} aria-labelledby="today-next-title">
          <h2 id="today-next-title" className="flabel">
            {m.path_next_title()}
          </h2>
          <p className="statement today__sentence" data-testid="next-action">
            {nextActionText(nextAction, (id) => catalogue.find((scale) => scale.id === id))}
          </p>
          <button
            type="button"
            className="poster today__cta"
            onClick={() =>
              void navigate({
                to: '/exercise/$scaleId',
                params: { scaleId: nextAction.startsScaleId },
                search: { mode: 'practice' },
              })
            }
          >
            <span>{m.path_next_start()}</span>
            <Arrow size={44} />
          </button>
          <p className="today__links">
            <Link to="/session" className="ulink">
              {m.path_open_session()}
            </Link>
            <Link to="/path" className="ulink">
              {m.path_open_path()}
            </Link>
            <Link to="/academy" className="ulink" data-testid="today-academy">
              {m.academy_stage_open()}
            </Link>
          </p>
        </section>

        <section
          className="today__where panel gp-host gp-host--bright panel--corner rise"
          style={order(2)}
          aria-labelledby="today-where-title"
        >
          <GradLayer tone="bright" seed={2} count={4} />
          <h2 id="today-where-title" className="flabel">
            {m.path_where_title()}
          </h2>

          <dl className="today__keys">
            <dt className="label">{m.path_where_keys()}</dt>
            <dd>
              <span className="sr-only">{m.path_where_keys_value({ unlocked, total })}</span>
              <span className="num today__keys-n" aria-hidden="true">
                {unlocked}
                <span className="today__keys-of">/{total}</span>
              </span>
            </dd>
          </dl>
          <dl className="passport">
            <div>
              <dt>{m.path_where_stage()}</dt>
              <dd>{m.path_where_stage_value({ n: progress.stage.current })}</dd>
            </div>
            <div>
              <dt>{m.path_where_level()}</dt>
              <dd>{m.path_level_introduction()}</dd>
            </div>
            <div>
              <dt>{m.path_where_streak()}</dt>
              <dd>
                <span className="sr-only">
                  {m.path_where_streak_value({ count: streak, target: MASTERY_STREAK })}
                </span>
                <span className="today__streak" aria-hidden="true">
                  {Array.from({ length: MASTERY_STREAK }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of MASTERY_STREAK slots
                      key={i}
                      className={i < streak ? 'disc disc--sm' : 'disc disc--sm disc--empty'}
                    >
                      {i + 1}
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          </dl>

          <p className="note">{m.path_streak_explain({ target: MASTERY_STREAK, floor })}</p>
          {progress.stage.stage1Complete && (
            <p className="flabel today__done">{m.path_stage1_complete()}</p>
          )}
        </section>
      </div>
    </div>
  )
}
