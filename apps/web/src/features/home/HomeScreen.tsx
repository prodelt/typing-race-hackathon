import { Link, useNavigate } from '@tanstack/react-router'
import {
  ERROR_RATE_FLOOR,
  rankWeakSpots,
  reviewDrillId,
  SLOW_IKI_MS,
  stage2Open,
  type WeakSpot,
} from '@typing-race/curriculum'
import type { Language, NextAction, Scale } from '@typing-race/domain'
import { Button, IconFlame } from '@typing-race/ui'
import { useMemo, useRef } from 'react'
import { LiveGradient } from '../../app/LiveGradient.js'
import { useScreenKeys } from '../../app/screenKeys.js'
import { useGameStats } from '../../app/state/gameStats.js'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { routeGeometry } from '../map/model.js'
import { RouteLine, useSize } from '../map/RouteLine.js'
import { keyLabel, nextActionText } from '../path/labels.js'
import { MASTERY_STREAK, streakFor, totalKeyCount, unlockedKeyCount } from '../path/model.js'
import { StartingLevel } from '../path/StartingLevel.js'
import { spotLabel } from '../review/format.js'
import { composeSession, type SessionPlan } from '../session/compose.js'
import { useSessionStore } from '../session/store.js'
import { goalChart, keyWindow, sessionXp, stepMinutes, weakTrend } from './model.js'
import './home.css'

/**
 * Home, the hub a returning learner lands on (direction B). One loud thing — Continue — and four
 * quiet panels around it, each with one way in and a key for it. The grid fills the stage; it
 * never scrolls as a page at desktop sizes.
 *
 * With no starting-level answer there is no progress to show, so the question replaces the hub.
 */
export function HomeScreen() {
  const derived = useDerived()
  if (derived.progress === null || derived.nextAction === null) {
    return <StartingLevel mode="first" />
  }
  return <Hub nextAction={derived.nextAction} />
}

const BLOCK_NAMES = [
  () => m.session_block_warmUp(),
  () => m.session_block_target(),
  () => m.session_block_consolidation(),
  () => m.session_block_realText(),
] as const

function titleFor(action: NextAction): string {
  const v = action.values
  const key = (name: string) => keyLabel(String(v[name] ?? ''))
  switch (action.template) {
    case 'coach.nextKey':
      return m.home_title_nextKey({ key: key('key') })
    case 'coach.weakTransition':
      return m.home_title_weakTransition({ from: key('from'), to: key('to') })
    case 'coach.lowerTempo':
      return m.home_title_lowerTempo()
    case 'coach.evenRhythm':
      return m.home_title_evenRhythm()
    default:
      return m.home_title_nextScale()
  }
}

function Hub({ nextAction }: { readonly nextAction: NextAction }) {
  const navigate = useNavigate()
  const { progress, layout, catalogue } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const language = useAppStore((state) => state.settings.typingLanguage)
  const session = useSessionStore((store) => store.session)
  const dispatch = useSessionStore((store) => store.dispatch)

  const scaleById = (id: string): Scale | undefined => catalogue.find((scale) => scale.id === id)

  const plan = useMemo(
    () =>
      progress === null
        ? null
        : composeSession({ layout, catalogue, progress, nextAction, attempts }),
    [layout, catalogue, progress, nextAction, attempts],
  )
  const spot: WeakSpot | undefined = useMemo(
    () => (progress === null ? undefined : rankWeakSpots(progress, layout, 1)[0]),
    [progress, layout],
  )
  const drillId = spot === undefined ? undefined : reviewDrillId(layout, [spot.element])

  const running = session.status === 'running'

  const start = (): void => {
    if (running) {
      void navigate({ to: '/session' })
      return
    }
    if (plan === null) {
      void navigate({
        to: '/exercise/$scaleId',
        params: { scaleId: nextAction.startsScaleId },
        search: { mode: 'practice' },
      })
      return
    }
    dispatch({ type: 'start', plan, baseline: attempts.map((attempt) => attempt.id) })
    const first = plan.blocks[0]
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: first.scaleId },
      search: { mode: first.mode },
    })
  }

  const race = (go: 'quick' | 'friend', lang: Language): void => {
    void navigate({ to: '/races', search: { go, lang } })
  }

  const drill = (): void => {
    if (drillId === undefined) return
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: drillId },
      search: { mode: 'practice' },
    })
  }

  useScreenKeys({
    Enter: start,
    KeyQ: () => race('quick', 'uk'),
    KeyW: () => race('quick', 'en'),
    KeyF: () => race('friend', language),
    KeyD: drill,
  })

  if (progress === null) return null

  return (
    <div className="hub">
      <ContinuePanel
        nextAction={nextAction}
        plan={plan}
        minutes={plan === null ? [] : stepMinutes(plan, attempts, scaleById)}
        running={running}
        streak={streakFor(progress, nextAction.startsScaleId)}
        onStart={start}
        actionText={nextActionText(nextAction, scaleById)}
      />
      <RacePanel onRace={race} language={language} />
      <MapPanel />
      <div className="hub__pair">
        <WeakPanel
          spot={spot}
          history={progress.history}
          onDrill={drillId === undefined ? undefined : drill}
        />
        <GoalPanel />
      </div>
    </div>
  )
}

/* ---- 01 Continue ------------------------------------------------------------------------- */

function ContinuePanel(props: {
  readonly nextAction: NextAction
  readonly plan: SessionPlan | null
  readonly minutes: readonly number[]
  readonly running: boolean
  readonly streak: number
  readonly onStart: () => void
  readonly actionText: string
}) {
  const { plan, minutes } = props
  const total = minutes.reduce((sum, n) => sum + n, 0)
  const steps =
    plan === null
      ? []
      : [
          ...plan.blocks.map((block, i) => ({
            name: BLOCK_NAMES[i]?.() ?? '',
            focus: spotLabel(block.focus.value),
            minutes: minutes[i] ?? 0,
          })),
          { name: BLOCK_NAMES[3](), focus: undefined, minutes: minutes[3] ?? 0 },
        ]

  return (
    <section className="hub-go on-red" aria-labelledby="hub-go-title" data-testid="home-continue">
      <LiveGradient tone="ember" />
      <div className="hub-go__top">
        <span className="hub-idx">01</span>
        {m.home_go_top({ n: 1, stage: m.home_stage_1() })}
      </div>
      <h1 className="hub-go__title" id="hub-go-title">
        {titleFor(props.nextAction)}
      </h1>
      <p className="hub-go__what" data-testid="next-action">
        {total > 0 ? m.home_what({ minutes: total, action: props.actionText }) : props.actionText}
      </p>
      {steps.length > 0 && (
        <ol className="hub-steps" aria-label={m.home_steps_label()}>
          {steps.map((step, i) => (
            <li className="hub-step" key={step.name}>
              <span className="hub-step__n num">{i + 1}</span>
              <b>
                {step.name}
                {step.focus === undefined ? null : ` «${step.focus}»`}
              </b>
              <span>{m.home_step_minutes({ n: step.minutes })}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="hub-go__bot">
        <button
          type="button"
          className="hub-btn hub-btn--inverse"
          aria-keyshortcuts="Enter"
          aria-label={props.running ? m.home_resume() : m.home_start()}
          onClick={props.onStart}
        >
          {props.running ? m.home_resume() : m.home_start()}
          <span className="kbd" aria-hidden="true">
            Enter
          </span>
        </button>
        <span className="hub-chip" data-testid="home-streak">
          {m.path_where_streak()}{' '}
          {m.path_where_streak_value({ count: props.streak, target: MASTERY_STREAK })}
        </span>
        {plan !== null && <span className="hub-chip">{m.home_xp({ xp: sessionXp(plan) })}</span>}
      </div>
    </section>
  )
}

/* ---- 02 Races ---------------------------------------------------------------------------- */

const QUICK: readonly { readonly lang: Language; readonly key: string }[] = [
  { lang: 'uk', key: 'Q' },
  { lang: 'en', key: 'W' },
]

function RacePanel(props: {
  readonly onRace: (go: 'quick' | 'friend', lang: Language) => void
  readonly language: Language
}) {
  return (
    <section className="hub-panel hub-race" aria-labelledby="hub-race-title">
      <div className="hub-panel__head">
        <span className="hub-idx">02</span>
        <h2 className="hub-panel__title" id="hub-race-title">
          {m.home_race_title()}
        </h2>
      </div>
      <p className="hub-race__lead">{m.home_race_lead()}</p>
      <div className="hub-tiles">
        {QUICK.map(({ lang, key }) => (
          <button
            key={lang}
            type="button"
            className="hub-tile"
            aria-keyshortcuts={key}
            onClick={() => props.onRace('quick', lang)}
          >
            <span className="hub-tile__name">
              <em>{lang === 'uk' ? m.home_race_lang_uk() : m.home_race_lang_en()}</em> ·{' '}
              {m.home_race_quick()}
            </span>
            <span className="hub-tile__sub">{m.home_race_quick_sub()}</span>
            <span className="kbd" aria-hidden="true">
              {key}
            </span>
          </button>
        ))}
      </div>
      <div className="hub-race__foot">
        <Button
          variant="secondary"
          hint="F"
          aria-keyshortcuts="F"
          onClick={() => props.onRace('friend', props.language)}
        >
          {m.home_race_friend()}
        </Button>
      </div>
    </section>
  )
}

/* ---- 03 The mini-map --------------------------------------------------------------------- */

type NodeKind = 'done' | 'cur' | 'lock' | 'open' | 'goal' | 'goal-lock'
interface MapNode {
  readonly kind: NodeKind
  readonly label: string
  readonly band: 0 | 1 | 2
}

/**
 * The mini-map: the Map's route line (`RouteLine`, `routeGeometry`) at Home's size, with the last
 * few keys of Stage 1, the door to Stage 2 and the goal. The full route is destination 2.
 */
function MapPanel() {
  const { progress, layout } = useDerived()
  const box = useRef<HTMLDivElement>(null)
  const { width, height } = useSize(box)

  const unlocked = progress?.unlockedSet ?? []
  const view = keyWindow(layout, unlocked, { done: 3, later: 0 })
  const after = keyWindow(layout, unlocked, { done: 0, later: 1 }).later[0]
  const total = totalKeyCount(layout)
  const open = progress === null ? 0 : unlockedKeyCount(progress)
  const words = stage2Open(layout, unlocked)
  const stage1Done = progress?.stage.stage1Complete ?? false

  const nodes: MapNode[] = [
    ...view.done.map((char) => ({
      kind: 'done' as const,
      label: keyLabel(char),
      band: 0 as const,
    })),
    ...(view.current === undefined
      ? []
      : [{ kind: 'cur' as const, label: keyLabel(view.current), band: 0 as const }]),
    { kind: words ? 'open' : 'lock', label: 'аб', band: 1 },
    { kind: 'goal', label: '', band: 2 },
  ]
  const geometry = routeGeometry({
    width,
    regions: [0, 1, 2].map((band) => nodes.filter((n) => n.band === band).map(() => 1)),
    levels: [height - 34, 92, height - 34],
    gap: 12,
    radius: 32,
    pad: 26,
    minShare: 1 / 3,
  })
  const placed = nodes.map((node) => {
    const index = nodes.filter((n) => n.band === node.band).indexOf(node)
    return { node, point: geometry.points[node.band]?.[index] }
  })
  const cur = placed.find((p) => p.node.kind === 'cur')?.point?.at
  const walked = Math.max(
    cur ?? placed.filter((p) => p.node.kind === 'done').at(-1)?.point?.at ?? 0,
    stage1Done ? (geometry.points[1]?.[0]?.at ?? 0) - 40 : 0,
  )
  const bandX = (i: number) => (geometry.bands[i]?.x ?? 0) + 12

  return (
    <section className="hub-panel hub-map" aria-labelledby="hub-map-title" data-testid="home-map">
      <div className="hub-panel__head">
        <span className="hub-idx">03</span>
        <h2 className="hub-panel__title" id="hub-map-title">
          {m.home_map_title()}
        </h2>
        <span className="hub-panel__meta">{m.home_map_meta({ unlocked: open, total })}</span>
      </div>
      <p className="hub-say">
        {stage1Done && <b>{m.path_stage1_complete()} </b>}
        <b className="hub-red">{m.home_map_here()}</b>{' '}
        {view.current === undefined ? (
          m.home_map_here_all()
        ) : (
          <>
            {m.home_map_here_key({ key: keyLabel(view.current) })}
            {after === undefined ? null : ` · ${m.home_map_here_next({ key: keyLabel(after) })}`}
          </>
        )}
      </p>
      <div
        className="hub-map__svg"
        ref={box}
        role="img"
        aria-label={m.home_map_aria({ unlocked: open, total })}
      >
        <RouteLine
          geometry={geometry}
          width={width}
          height={height}
          walked={walked}
          bandClass={(i) =>
            i === 0 && !stage1Done ? 'is-cur' : i === 1 && !words ? 'is-lock' : ''
          }
        >
          <text className="m-n" x={bandX(0)} y={28}>
            01
          </text>
          <text className="m-name" x={bandX(0) + 34} y={28}>
            {m.home_stage_1()}
          </text>
          <text className={`m-n${words ? '' : ' m-dim'}`} x={bandX(1)} y={28}>
            02
          </text>
          <text className={`m-name${words ? '' : ' m-dim'}`} x={bandX(1) + 34} y={28}>
            {m.home_stage_2()}
          </text>
          <text className="m-n" x={bandX(2)} y={28}>
            03
          </text>
          <text className="m-name" x={bandX(2) + 34} y={28}>
            {m.home_stage_3()}
          </text>
          {placed.map(({ node, point }) =>
            point === undefined ? null : (
              <g
                key={`${node.band}-${node.kind}-${node.label}`}
                transform={`translate(${point.x} ${point.y})`}
              >
                <MapGlyph node={node} />
              </g>
            ),
          )}
        </RouteLine>
      </div>
      <div className="hub-legend">
        <span>
          <i className="lg lg--done" />
          {m.home_legend_done()}
        </span>
        <span>
          <i className="lg lg--cur" />
          {m.home_legend_here()}
        </span>
        <span>
          <i className="lg lg--open" />
          {m.home_legend_open()}
        </span>
        <span>
          <i className="lg lg--lock" />
          {m.home_legend_locked()}
        </span>
        <Link to="/map" className="hub-link" aria-keyshortcuts="2">
          {m.home_map_all()}
          <span className="kbd" aria-hidden="true">
            2
          </span>
        </Link>
      </div>
    </section>
  )
}

function MapGlyph({ node }: { readonly node: MapNode }) {
  const cls = `mnode mnode--${node.kind}`
  if (node.kind === 'cur') {
    return (
      <g className={cls}>
        <rect className="halo" x={-27} y={-27} width={54} height={54} />
        <path className="core" d="M-20 -20 H 10 A 10 10 0 0 1 20 -10 V 20 H -20 Z" />
        <text y={1}>{node.label}</text>
      </g>
    )
  }
  if (node.kind === 'goal' || node.kind === 'goal-lock') {
    return (
      <g className={cls}>
        <rect x={-16} y={-16} width={32} height={32} />
        <path d="M-5 -7 V 8 M-5 -7 H 7 L 4 -3 L 7 1 H -5" />
      </g>
    )
  }
  return (
    <g className={cls}>
      <circle r={14} />
      <text y={1}>{node.label}</text>
    </g>
  )
}

/* ---- 04 Weak spot ------------------------------------------------------------------------ */

function WeakPanel(props: {
  readonly spot: WeakSpot | undefined
  readonly history: Parameters<typeof weakTrend>[0]
  readonly onDrill: (() => void) | undefined
}) {
  const { spot } = props
  const trend = spot === undefined ? [] : weakTrend(props.history, spot.element)

  let sentence = m.home_weak_none()
  if (spot !== undefined) {
    const what = spot.kind === 'transition' ? m.home_weak_transition() : m.home_weak_key()
    const label = `«${spotLabel(spot.element)}»`
    const slow = (spot.meanIkiMs ?? 0) >= SLOW_IKI_MS
    sentence = slow
      ? m.home_weak_slow({ what, label, ms: Math.round(spot.meanIkiMs ?? 0), target: SLOW_IKI_MS })
      : m.home_weak_errors({
          what,
          label,
          rate: Math.round(spot.errorRate * 100),
          target: Math.round(ERROR_RATE_FLOOR * 100),
        })
  }

  return (
    <section
      className="hub-panel hub-weak"
      aria-labelledby="hub-weak-title"
      data-testid="home-weak"
    >
      <div className="hub-panel__head">
        <span className="hub-idx">04</span>
        <h2 className="hub-panel__title" id="hub-weak-title">
          {m.home_weak_title()}
        </h2>
      </div>
      <p className="hub-say">{sentence}</p>
      {trend.length >= 2 && <Spark points={trend} />}
      {props.onDrill !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          hint="D"
          aria-keyshortcuts="D"
          onClick={props.onDrill}
        >
          {m.home_weak_drill()}
        </Button>
      )}
    </section>
  )
}

function Spark({ points }: { readonly points: readonly number[] }) {
  const lo = Math.min(SLOW_IKI_MS, ...points) * 0.9
  const hi = Math.max(SLOW_IKI_MS, ...points) * 1.05
  const y = (value: number) => 64 - ((value - lo) / (hi - lo)) * 58
  const x = (i: number) => 12 + (i * 176) / Math.max(1, points.length - 1)
  const first = points[0] ?? 0
  const last = points.at(-1) ?? 0
  return (
    <>
      <svg
        className="hub-spark"
        viewBox="0 0 200 70"
        preserveAspectRatio="none"
        role="img"
        aria-label={m.home_weak_trend_aria({ values: points.join(', '), target: SLOW_IKI_MS })}
      >
        <rect className="hub-spark__bg" x="0" y="0" width="200" height="70" />
        <line
          className="hub-spark__goal"
          x1="0"
          x2="200"
          y1={y(SLOW_IKI_MS)}
          y2={y(SLOW_IKI_MS)}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          className="hub-spark__line"
          points={points.map((value, i) => `${x(i)},${y(value).toFixed(1)}`).join(' ')}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="hub-spark__lab">
        {m.home_weak_trend({ n: points.length, from: first, to: last })}
      </p>
    </>
  )
}

/* ---- 05 Daily goal ----------------------------------------------------------------------- */

function weekday(date: string): string {
  return new Intl.DateTimeFormat(getLocale(), { weekday: 'short' }).format(
    new Date(`${date}T12:00:00`),
  )
}

function GoalPanel() {
  const { dailyGoal, streak } = useGameStats()
  const chart = goalChart(dailyGoal.last7, dailyGoal.goalMinutes)
  const left = Math.max(0, dailyGoal.goalMinutes - dailyGoal.minutesToday)

  return (
    <section
      className="hub-panel hub-goal"
      aria-labelledby="hub-goal-title"
      data-testid="home-goal"
    >
      <div className="hub-panel__head">
        <span className="hub-idx">05</span>
        <h2 className="hub-panel__title" id="hub-goal-title">
          {m.home_goal_title()}
        </h2>
      </div>
      <p className="hub-say">
        <b>{m.home_goal_today({ done: dailyGoal.minutesToday, goal: dailyGoal.goalMinutes })}</b>
        {' · '}
        <span className="hub-left">
          {left > 0 ? m.home_goal_left({ n: left }) : m.home_goal_met()}
        </span>
      </p>
      <div
        className="hub-chart"
        role="img"
        aria-label={m.home_goal_chart({
          values: dailyGoal.last7.map((day) => day.minutes).join(', '),
          goal: dailyGoal.goalMinutes,
        })}
      >
        <div
          className="hub-chart__goal"
          style={{ bottom: `calc(20px + (100% - 20px) * ${chart.goalAt})` }}
        >
          <span>{m.home_goal_line({ n: dailyGoal.goalMinutes })}</span>
        </div>
        {chart.bars.map((bar) => (
          <div key={bar.date} className={`hub-day${bar.today ? ' is-today' : ''}`}>
            {bar.today && chart.rest > 0 ? (
              <i className="hub-day__rest" style={{ height: `${chart.rest * 100}%` }} />
            ) : null}
            <i className="hub-day__fill" style={{ height: `${bar.height * 100}%` }} />
            <em>{weekday(bar.date)}</em>
          </div>
        ))}
      </div>
      <p className="hub-streak">
        <IconFlame size={14} aria-hidden="true" />
        <b>{m.home_streak({ n: streak.days })}</b>
        {' · '}
        <span className="hub-dotted" title={m.home_freeze_tip()}>
          {m.home_freeze({ n: streak.freezes })}
        </span>
      </p>
    </section>
  )
}
