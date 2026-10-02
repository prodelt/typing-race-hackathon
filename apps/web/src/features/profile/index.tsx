import { Link, useNavigate } from '@tanstack/react-router'
import {
  academyProgress,
  catalogue,
  findExercise,
  resolveWordDrill,
  stage2Gate,
  stage2Open,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { IconFlame } from '@typing-race/ui'
import { useMemo } from 'react'
import { Panel, Screen, ScreenHead } from '../../app/Screen.js'
import { useScreenKeys } from '../../app/screenKeys.js'
import { localDay, useGameStats } from '../../app/state/gameStats.js'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { type CourseState, useAcademyCourse } from '../academy/data.js'
import { AccountPanel } from '../account/AccountPanel.js'
import { initialOf } from '../account/model.js'
import { useAccount } from '../account/state.js'
import { keyLabel, scaleName } from '../path/labels.js'
import { totalKeyCount, unlockedKeyCount } from '../path/model.js'
import { drillName } from '../words/labels.js'
import { attemptKind, careerTotals, RECENT_WINDOW, recentAttempts, speedTrend } from './model.js'
import './profile.css'

/**
 * Profile, destination 05: who is playing, the game numbers, how far along the route they are, and
 * the history of attempts — readable on a phone too. The red block is the Level; everything else
 * is quiet. The Account panel signs in with Google, and once signed in edits the nick, shows the
 * sync state, signs out and deletes the learner's data.
 */

const HISTORY_ROWS = 8
const TREND_POINTS = 20

export function ProfileScreen() {
  const navigate = useNavigate()
  const stats = useGameStats()
  const attempts = useAppStore((state) => state.attempts)
  const language = useAppStore((state) => state.settings.typingLanguage)
  const course = useAcademyCourse(language)
  const totals = useMemo(() => careerTotals(attempts, localDay), [attempts])

  useScreenKeys({ KeyS: () => void navigate({ to: '/settings' }) })

  return (
    <Screen className="prof">
      <ScreenHead title={m.profile_title()} titleId="profile-title">
        <ProfileWho />
        <Link to="/settings" className="scr-seg__btn prof-settings" aria-keyshortcuts="S">
          {m.prof_settings()}
          <span className="kbd" aria-hidden="true">
            S
          </span>
        </Link>
      </ScreenHead>

      <div className="prof-grid">
        <LevelBlock
          level={stats.level}
          have={stats.xpInLevel}
          need={stats.xpForNextLevel}
          tests={totals.tests}
        />
        <Numbers stats={stats} totals={totals} />
        <Mastery course={course} />
        <History attempts={attempts} course={course} />
        <AccountPanel />
      </div>
    </Screen>
  )
}

/** The public nick once there is one; a guest is «Гість». Never a name or photo from Google. */
function ProfileWho() {
  const kind = useAccount((state) => state.kind)
  const nick = useAccount((state) => state.nick)
  const name = nick ?? m.prof_guest()
  return (
    <div className="prof-who">
      <span className="prof-who__avatar" aria-hidden="true">
        {initialOf(name)}
      </span>
      <span className="prof-who__text">
        <b>{name}</b>
        <span>{kind === 'google' ? m.acct_sub_google() : m.prof_guest_sub()}</span>
      </span>
    </div>
  )
}

/* ---- 01 Level: the one loud block ---------------------------------------------------------- */

function LevelBlock(props: {
  readonly level: number
  readonly have: number
  readonly need: number
  readonly tests: number
}) {
  const fill = props.need === 0 ? 1 : Math.min(1, props.have / props.need)
  return (
    <section
      className="scr-panel scr-loud prof-level"
      aria-labelledby="prof-level-title"
      data-testid="profile-level"
    >
      <div className="scr-panel__head">
        <span className="scr-idx">01</span>
        <h2 className="scr-panel__title" id="prof-level-title">
          {m.prof_level_title()}
        </h2>
      </div>
      <p className="prof-level__n num">{props.level}</p>
      <div className="prof-level__bar" aria-hidden="true">
        <i style={{ width: `${fill * 100}%` }} />
      </div>
      <p className="prof-level__xp">
        <b>{m.prof_level_xp({ have: props.have, need: props.need })}</b>{' '}
        {m.prof_level_next({ next: props.level + 1, left: Math.max(0, props.need - props.have) })}
      </p>
      <p className="prof-level__say">{m.prof_level_explain()}</p>
    </section>
  )
}

/* ---- 02 Numbers ------------------------------------------------------------------------- */

function Numbers({
  stats,
  totals,
}: {
  readonly stats: ReturnType<typeof useGameStats>
  readonly totals: ReturnType<typeof careerTotals>
}) {
  const cells = [
    {
      id: 'streak',
      label: m.prof_streak(),
      value: (
        <>
          <IconFlame size={18} className="prof-flame" aria-hidden="true" />
          {m.prof_streak_value({ days: stats.streak.days })}
        </>
      ),
      sub: m.prof_streak_sub({ n: stats.streak.freezes }),
    },
    {
      id: 'goal',
      label: m.prof_goal(),
      value: m.prof_goal_value({
        today: stats.dailyGoal.minutesToday,
        goal: stats.dailyGoal.goalMinutes,
      }),
      sub: m.prof_goal_sub(),
    },
    {
      id: 'rating',
      label: m.prof_rating(),
      value: stats.raceRating === null ? m.prof_rating_none() : String(stats.raceRating),
      sub: stats.raceRating === null ? m.prof_rating_sub_none() : m.prof_rating_sub(),
    },
    {
      id: 'best',
      label: m.prof_best(),
      value: totals.bestSpm === null ? '—' : String(totals.bestSpm),
      sub: totals.bestSpm === null ? m.prof_best_none() : m.prof_best_sub(),
    },
    {
      id: 'accuracy',
      label: m.prof_accuracy(),
      value: totals.recentAccuracy === null ? '—' : `${(totals.recentAccuracy * 100).toFixed(1)}%`,
      sub: m.prof_accuracy_sub({ n: Math.min(RECENT_WINDOW, Math.max(1, totals.attempts)) }),
    },
    {
      id: 'time',
      label: m.prof_time(),
      value: m.prof_time_value({ minutes: totals.minutes }),
      sub: m.prof_time_sub({ attempts: totals.attempts, days: totals.days }),
    },
  ]

  return (
    <Panel id="prof-stats-title" n={2} title={m.prof_stats_title()} className="prof-stats">
      <dl className="prof-cells">
        {cells.map((cell) => (
          <div key={cell.id} className="prof-cell" data-testid={`profile-${cell.id}`}>
            <dt>{cell.label}</dt>
            <dd className="prof-cell__value num">{cell.value}</dd>
            <dd className="prof-cell__sub">{cell.sub}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/* ---- 03 Mastery ------------------------------------------------------------------------- */

function Mastery({ course }: { readonly course: CourseState }) {
  const { progress, layout } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const academy = useMemo(
    () => (course.status === 'ready' ? academyProgress(course.course, attempts) : null),
    [course, attempts],
  )

  if (progress === null) {
    return (
      <Panel id="prof-mastery-title" n={3} title={m.prof_mastery_title()} className="prof-mastery">
        <p className="scr-say">{m.prof_mastery_none()}</p>
      </Panel>
    )
  }

  const keys = { have: unlockedKeyCount(progress), total: totalKeyCount(layout) }
  const words = stage2Open(layout, progress.unlockedSet)
  const missing = stage2Gate(layout).filter((char) => !progress.unlockedSet.includes(char))
  const modules =
    course.status === 'ready' && academy !== null
      ? { have: academy.modulesComplete, total: course.course.modules.length }
      : null

  const rows = [
    {
      n: '01',
      name: m.prof_mastery_stage1(),
      value: m.prof_mastery_stage1_value(keys),
      fill: keys.total === 0 ? 0 : keys.have / keys.total,
    },
    {
      n: '02',
      name: m.prof_mastery_stage2(),
      value: words
        ? m.prof_mastery_stage2_open()
        : m.prof_mastery_stage2_locked({ keys: missing.map(keyLabel).join(' ') }),
      fill: words ? 1 : 0,
    },
    {
      n: '03',
      name: m.prof_mastery_stage3(),
      value:
        modules === null ? m.prof_mastery_stage3_loading() : m.prof_mastery_stage3_value(modules),
      fill: modules === null || modules.total === 0 ? 0 : modules.have / modules.total,
    },
  ]

  return (
    <Panel
      id="prof-mastery-title"
      n={3}
      title={m.prof_mastery_title()}
      meta={
        <Link to="/map" className="prof-link" aria-keyshortcuts="2">
          {m.prof_mastery_map()}
          <span className="kbd" aria-hidden="true">
            2
          </span>
        </Link>
      }
      className="prof-mastery"
      testId="profile-mastery"
    >
      <ol className="prof-stages">
        {rows.map((row) => (
          <li key={row.n} className="prof-stage">
            <span className="prof-stage__n">{row.n}</span>
            <b className="prof-stage__name">{row.name}</b>
            <span className="prof-stage__value">{row.value}</span>
            <span className="prof-stage__bar" aria-hidden="true">
              <i style={{ width: `${row.fill * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/* ---- 04 History ------------------------------------------------------------------------- */

function attemptName(attempt: AttemptSummary, course: CourseState): string {
  switch (attemptKind(attempt.scaleId)) {
    case 'academy': {
      const found =
        course.status === 'ready' ? findExercise(course.course, attempt.scaleId) : undefined
      return found === undefined
        ? m.prof_kind_academy()
        : `${m.prof_kind_academy()} · ${found.exercise.title}`
    }
    case 'words': {
      const drill = resolveWordDrill(attempt.scaleId)
      return drill === undefined ? m.prof_kind_words() : drillName(drill)
    }
    case 'review':
      return m.prof_kind_review()
    default: {
      const scale = catalogue[attempt.layoutId].find((s) => s.id === attempt.scaleId)
      return scale === undefined ? attempt.scaleId : scaleName(scale)
    }
  }
}

function when(ms: number): string {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en-GB' : 'uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

function History({
  attempts,
  course,
}: {
  readonly attempts: readonly AttemptSummary[]
  readonly course: CourseState
}) {
  const rows = recentAttempts(attempts, HISTORY_ROWS)
  const trend = speedTrend(attempts, TREND_POINTS)

  return (
    <Panel
      id="prof-history-title"
      n={4}
      title={m.prof_history_title()}
      meta={
        attempts.length === 0
          ? undefined
          : m.prof_history_meta({ n: rows.length, total: attempts.length })
      }
      className="prof-history"
      testId="profile-history"
    >
      {rows.length === 0 ? (
        <div className="scr-empty">
          <p className="scr-say">{m.prof_history_empty()}</p>
          <Link to="/" className="scr-seg__btn prof-start">
            {m.prof_history_start()}
          </Link>
        </div>
      ) : (
        <>
          {trend.length >= 2 ? <Trend points={trend} /> : null}
          <div className="prof-hist__heads" aria-hidden="true">
            <span />
            <span>{m.prof_col_spm()}</span>
            <span>{m.prof_col_accuracy()}</span>
          </div>
          <ol className="scr-rows prof-hist">
            {rows.map((attempt) => {
              const name = attemptName(attempt, course)
              const date = when(attempt.completedAt)
              return (
                <li key={attempt.id}>
                  <Link
                    to="/result/$attemptId"
                    params={{ attemptId: attempt.id }}
                    className="scr-row prof-hist__row"
                    aria-label={m.prof_history_open({ name, date })}
                    data-testid="profile-attempt"
                  >
                    <span className="prof-hist__what">
                      <b>{name}</b>
                      <span>
                        {date}
                        <span
                          className={`scr-tag${attempt.mode === 'test' ? ' scr-tag--ink' : ''}`}
                        >
                          {attempt.mode === 'test'
                            ? m.prof_history_test()
                            : m.prof_history_practice()}
                        </span>
                      </span>
                    </span>
                    <span className="prof-hist__fig num">{Math.round(attempt.metrics.spm)}</span>
                    <span className="prof-hist__fig prof-hist__fig--acc num">
                      {(Math.floor(attempt.metrics.accuracy * 1000) / 10).toFixed(1)}%
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </Panel>
  )
}

function Trend({ points }: { readonly points: readonly number[] }) {
  const lo = Math.min(...points) * 0.9
  const hi = Math.max(...points) * 1.05 || 1
  const y = (value: number) => 56 - ((value - lo) / Math.max(1, hi - lo)) * 50
  const x = (i: number) => 4 + (i * 392) / Math.max(1, points.length - 1)
  const line = points.map((value, i) => `${x(i)},${y(value).toFixed(1)}`).join(' ')
  return (
    <figure className="prof-trend">
      <svg
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        role="img"
        aria-label={m.prof_history_trend_aria({ values: points.join(', ') })}
      >
        <polygon className="prof-trend__area" points={`4,60 ${line} 396,60`} />
        <polyline className="prof-trend__line" points={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="scr-note">
        {m.prof_history_trend({
          n: points.length,
          from: points[0] ?? 0,
          to: points.at(-1) ?? 0,
        })}
      </figcaption>
    </figure>
  )
}
