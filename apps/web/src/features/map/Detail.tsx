import { Link, useNavigate } from '@tanstack/react-router'
import {
  type AcademyCourse,
  type AcademyModule,
  academyLevel,
  type CourseProgress,
  introductionLevel,
  MASTERY_STREAK,
  rankWeakSpots,
} from '@typing-race/curriculum'
import type { Language, Layout, Progress } from '@typing-race/domain'
import { Button, buttonClass, cx } from '@typing-race/ui'
import { type ReactNode, useMemo, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { local } from '../academy/model.js'
import { PathKeyboard } from '../path/Keyboard.js'
import { keyLabel, scaleName } from '../path/labels.js'
import type { ScaleRow, ScaleState } from '../path/model.js'
import { numbers, spotLabel } from '../review/format.js'
import { displayWord, drillGoal, drillName, glyph } from '../words/labels.js'
import { type DrillRow, type DrillState, isOpenState, type Stage2View } from '../words/model.js'
import { STAGE_NAMES, stateWord, stepGoal, stepName } from './labels.js'
import {
  academyGroups,
  type FinishNode,
  type MapNode,
  type StartTarget,
  type StepNode,
  stage1Groups,
  stage2Groups,
} from './model.js'

/** Everything the Map reads, gathered once per render by the screen. */
export interface MapData {
  readonly layout: Layout
  readonly progress: Progress
  readonly scaleRows: readonly ScaleRow[]
  readonly wordsOpen: boolean
  readonly wordsMissing: readonly string[]
  /** `null` while the Word Bank loads. */
  readonly words: Stage2View | null
  readonly wordsError: boolean
  readonly academyLanguage: Language
  readonly academy: { readonly course: AcademyCourse; readonly progress: CourseProgress } | null
  readonly academyError: boolean
}

interface DetailProps {
  readonly node: MapNode
  readonly data: MapData
  readonly onStart: (target: StartTarget) => void
  readonly onReview: () => void
  readonly onFree: () => void
  readonly targetName: (target: StartTarget) => string
  /** Every block on the route, for the finish line's summary. */
  readonly steps: readonly StepNode[]
}

const pct = (fraction: number) => Math.round(fraction * 100)

/** The selected node's block, opened under the route. */
export function Detail(props: DetailProps) {
  const { node } = props
  if (node.kind === 'review') return <ReviewDetail {...props} />
  if (node.kind === 'finish') {
    return (
      <FinishDetail node={node} steps={props.steps.filter((step) => step.stage === node.stage)} />
    )
  }
  return <StepDetail {...props} node={node} />
}

function Frame(props: {
  readonly kicker: ReactNode
  readonly title: string
  readonly stage: number
  readonly info: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section
      className="map-detail"
      aria-labelledby="map-detail-title"
      data-testid="map-detail"
      data-stage={props.stage}
    >
      <div className="md-info">
        <p className="md-kick">{props.kicker}</p>
        <h2 id="map-detail-title" className="md-title">
          {props.title}
        </h2>
        {props.info}
      </div>
      <div className="md-body">{props.children}</div>
    </section>
  )
}

function Meter({ done, total }: { readonly done: number; readonly total: number }) {
  const fraction = total === 0 ? 0 : done / total
  return (
    <div className="md-meter">
      <div
        className="md-meter__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={m.map_node_count({ done, total })}
      >
        <i style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className="md-meter__lab">{m.map_node_count({ done, total })}</span>
    </div>
  )
}

/* ---- A block of exercises ----------------------------------------------------------------- */

function StepDetail(props: DetailProps & { readonly node: StepNode }) {
  const { node, data } = props
  const floor =
    node.stage === 3 ? pct(academyLevel.accuracyFloor) : pct(introductionLevel.accuracyFloor)
  const next = node.next

  const info = (
    <>
      <p className="md-goal">{stepGoal(node)}</p>
      {node.total === null ? null : <Meter done={node.done} total={node.total} />}
      {node.stage === 3 ? <CourseSwitch current={data.academyLanguage} /> : null}
      {next === null ? (
        <p className="md-state">
          {node.state === 'done' ? m.map_detail_all_done() : m.map_detail_locked()}
        </p>
      ) : (
        <div className="md-go">
          <p className="md-next">
            {m.map_detail_next({ name: '' })}
            <b>{props.targetName(next)}</b>
          </p>
          <Button
            variant="primary"
            size="lg"
            hint="Enter"
            aria-keyshortcuts="Enter"
            aria-label={`${next.mode === 'test' ? m.map_detail_start_test() : m.map_detail_start()}: ${props.targetName(next)}`}
            data-testid="map-start"
            onClick={() => props.onStart(next)}
          >
            {next.mode === 'test' ? m.map_detail_start_test() : m.map_detail_start()}
          </Button>
        </div>
      )}
      <p className="md-note">{m.map_mastery({ target: MASTERY_STREAK, floor })}</p>
    </>
  )

  return (
    <Frame
      stage={node.stage}
      kicker={
        <>
          <span className="md-n">{String(node.n).padStart(2, '0')}</span>
          {m.map_stage({ n: node.stage })} · {STAGE_NAMES[node.stage]()}
        </>
      }
      title={stepName(node)}
      info={info}
    >
      {node.stage === 1 ? (
        <Stage1Body node={node} data={data} />
      ) : node.stage === 2 ? (
        <Stage2Body node={node} data={data} />
      ) : (
        <Stage3Body node={node} data={data} />
      )}
    </Frame>
  )
}

/* ---- Stage 1 ------------------------------------------------------------------------------ */

function scaleChip(state: ScaleState): string {
  switch (state.kind) {
    case 'complete':
      return m.path_scale_state_complete()
    case 'inProgress':
      return m.path_scale_state_inProgress({ count: state.count, target: MASTERY_STREAK })
    case 'notStarted':
      return m.path_scale_state_notStarted()
    case 'locked':
      return m.path_scale_state_locked()
  }
}

function scaleLock(state: ScaleState): string | null {
  if (state.kind !== 'locked') return null
  return state.reason.kind === 'requires'
    ? m.path_scale_lock_requires({ keys: state.reason.keys.map(keyLabel).join(' ') })
    : m.path_scale_lock_focus({ key: keyLabel(state.reason.key) })
}

function Stage1Body({ node, data }: { readonly node: StepNode; readonly data: MapData }) {
  const navigate = useNavigate()
  const rows = stage1Groups(data.layout, data.scaleRows).find((g) => g.group === node.group)?.rows
  return (
    <div className="md-split md-split--keys">
      <ol className="md-list" aria-label={m.map_exercises()}>
        {(rows ?? []).map(({ scale, state }, i) => {
          const name = scaleName(scale)
          const lock = scaleLock(state)
          return (
            <li key={scale.id} className="mrow" data-state={state.kind}>
              <span className="mrow__n">{i + 1}</span>
              <span className="mrow__main">
                <span className="mrow__name">{name}</span>
                {lock === null ? null : <span className="mrow__sub">{lock}</span>}
              </span>
              <span className="mrow__state">{scaleChip(state)}</span>
              {state.kind === 'locked' ? (
                <span className="mrow__go" />
              ) : (
                <Button
                  size="sm"
                  className="mrow__go"
                  aria-label={m.path_scale_start_named({ name })}
                  onClick={() =>
                    void navigate({
                      to: '/exercise/$scaleId',
                      params: { scaleId: scale.id },
                      search: { mode: 'practice' },
                    })
                  }
                >
                  {m.path_scale_start()}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
      <aside className="md-keys" aria-label={m.path_keyboard_title()}>
        <PathKeyboard layout={data.layout} progress={data.progress} />
      </aside>
    </div>
  )
}

/* ---- Stage 2 ------------------------------------------------------------------------------ */

function drillChip(state: DrillState): string {
  switch (state.kind) {
    case 'complete':
      return m.path_words_state_complete()
    case 'inProgress':
      return m.path_words_state_inProgress({ count: state.count, target: MASTERY_STREAK })
    case 'notStarted':
      return m.path_words_state_notStarted()
    case 'thin':
      return m.path_words_state_thin()
    default:
      return m.path_words_state_locked()
  }
}

function drillLock(row: DrillRow): string | null {
  const { state } = row
  if (state.kind === 'lockedKeys') {
    const keys = state.keys.map((key) => `«${glyph(key)}»`)
    return keys.length === 1
      ? m.path_words_lock_key({ key: keys[0] ?? '' })
      : m.path_words_lock_keys({ keys: keys.join(' ') })
  }
  if (state.kind === 'lockedAfter') return m.path_words_lock_after({ name: drillName(state.after) })
  if (state.kind === 'thin') {
    return row.drill.kind === 'weak' ? m.path_words_lock_weak() : m.path_words_lock_thin()
  }
  return null
}

/** The demo moment in words: a new key and the real words it brings. */
function featuredTitle(row: DrillRow): string {
  const { drill } = row
  if (drill.kind === 'firstWords') return m.path_words_featured_first()
  if ((drill.kind === 'newKey' || drill.kind === 'ukLetter') && drill.focus !== null) {
    return m.path_words_featured_new({ key: glyph(drill.focus.value) })
  }
  return drillName(drill)
}

function Stage2Body({ node, data }: { readonly node: StepNode; readonly data: MapData }) {
  const navigate = useNavigate()
  const { words, layout } = data
  if (!data.wordsOpen) {
    return (
      <p className="md-empty" data-testid="words-closed">
        {m.path_words_locked({ keys: data.wordsMissing.map(glyph).join(' ') })}
      </p>
    )
  }
  if (data.wordsError) {
    return (
      <p role="alert" className="md-empty">
        {m.path_words_error()}
      </p>
    )
  }
  if (words === null) {
    return (
      <p role="status" className="md-empty">
        {m.path_words_loading()}
      </p>
    )
  }

  const rows = stage2Groups(layout, words.rows).find((g) => g.group === node.group)?.rows ?? []
  // New keys: the opened ones and the very next locked one; the rest is a count, not a list.
  const locked = rows.filter((row) => row.state.kind === 'lockedKeys')
  const shown =
    node.group === 'keys'
      ? [...rows.filter((row) => row.state.kind !== 'lockedKeys'), ...locked.slice(0, 1)]
      : rows
  const ahead = node.group === 'keys' ? locked.length - 1 : 0
  const featured =
    rows.find((row) => row.drill.id === node.next?.id) ??
    rows.filter((row) => isOpenState(row.state)).at(-1)

  const start = (id: string) =>
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: id },
      search: { mode: 'practice' },
    })

  return (
    <div className="md-split md-split--words">
      <div className="md-scroll">
        <ol className="md-list" aria-label={m.map_exercises()}>
          {shown.map((row, i) => {
            const name = drillName(row.drill)
            const lock = drillLock(row)
            const open = isOpenState(row.state)
            return (
              <li
                key={row.drill.id}
                className="mrow"
                data-state={row.state.kind}
                data-drill-id={row.drill.id}
              >
                <span className="mrow__n">{i + 1}</span>
                <span className="mrow__main">
                  <span className="mrow__name">{name}</span>
                  <span className="mrow__sub">
                    {lock ?? drillGoal(row.drill, layout, words.weak)}
                  </span>
                </span>
                <span className="mrow__state">{drillChip(row.state)}</span>
                {open ? (
                  <Button
                    size="sm"
                    className="mrow__go"
                    aria-label={m.path_words_start_named({ name })}
                    onClick={() => start(row.drill.id)}
                  >
                    {m.path_words_start()}
                  </Button>
                ) : (
                  <span className="mrow__go" />
                )}
              </li>
            )
          })}
        </ol>
        {ahead > 0 ? <p className="md-more">{m.path_words_keys_ahead({ count: ahead })}</p> : null}
      </div>
      {featured === undefined || featured.preview.length === 0 ? null : (
        <aside className="md-words" data-testid="words-featured" aria-labelledby="md-words-title">
          <p id="md-words-title" className="md-words__title">
            {featuredTitle(featured)}
          </p>
          <p className="md-words__list" lang={layout.language}>
            {featured.preview.slice(0, 8).map((word) => (
              <span key={word}>{displayWord(word)}</span>
            ))}
          </p>
        </aside>
      )}
    </div>
  )
}

/* ---- Stage 3 ------------------------------------------------------------------------------ */

function CourseSwitch({ current }: { readonly current: Language }) {
  const navigate = useNavigate()
  const options: { value: Language; label: string }[] = [
    { value: 'uk', label: m.academy_course_uk() },
    { value: 'en', label: m.academy_course_en() },
  ]
  return (
    // biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, as in the shell's language switch
    <div role="group" aria-label={m.academy_course_group()} className="md-switch">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={option.value === current}
          className="md-switch__option"
          onClick={() =>
            void navigate({ to: '/map', search: { stage: 3, course: option.value }, replace: true })
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function exerciseLabel(state: CourseProgress['exercises'][string] | undefined): string {
  if (state?.mastered) return m.academy_exercise_mastered()
  if (state !== undefined && state.streak > 0) {
    return m.academy_exercise_streak({ count: state.streak, target: MASTERY_STREAK })
  }
  return state?.practiced ? m.academy_exercise_practiced() : m.academy_exercise_new()
}

function Stage3Body({ node, data }: { readonly node: StepNode; readonly data: MapData }) {
  const { academy } = data
  const modules = useMemo(
    () =>
      academy === null
        ? []
        : (academyGroups(academy.course).find((g) => g.group === node.group)?.modules ?? []),
    [academy, node.group],
  )
  const initial =
    modules.find((module) => module.exercises.some((e) => e.id === node.next?.id)) ?? modules[0]
  const [openId, setOpenId] = useState<string | undefined>(initial?.id)
  const open = modules.find((module) => module.id === openId) ?? initial

  if (data.academyError) {
    return (
      <p role="alert" className="md-empty">
        {m.academy_error()}
      </p>
    )
  }
  if (academy === null) {
    return (
      <p role="status" className="md-empty">
        {m.academy_loading()}
      </p>
    )
  }

  return (
    <div className="md-split md-split--academy">
      <ol className="md-modules" aria-label={m.map_modules()}>
        {modules.map((module) => (
          <ModuleTab
            key={module.id}
            module={module}
            n={academy.course.modules.indexOf(module) + 1}
            progress={academy.progress}
            open={module.id === open?.id}
            onOpen={() => setOpenId(module.id)}
          />
        ))}
      </ol>
      {open === undefined ? null : (
        <ol
          className="md-list md-scroll"
          aria-label={m.map_module_exercises({ title: local(open.title) })}
          data-testid={`module-${open.id}`}
        >
          {open.exercises.map((exercise, i) => {
            const state = academy.progress.exercises[exercise.id]
            return (
              <li
                key={exercise.id}
                className="mrow mrow--academy"
                data-mastered={state?.mastered || undefined}
                data-testid={`exercise-${exercise.id}`}
              >
                <span className="mrow__n">{i + 1}</span>
                <span className="mrow__main">
                  <span className="mrow__name">
                    {exercise.title}
                    {exercise.targetSpm === null ? null : (
                      <span className="mrow__tempo">
                        {' '}
                        · {m.academy_tempo({ spm: exercise.targetSpm })}
                      </span>
                    )}
                  </span>
                  <span className="mrow__sub mrow__text" lang={exercise.id.split('.')[1]}>
                    {exercise.text}
                  </span>
                </span>
                <span className="mrow__state" data-testid="exercise-state">
                  {exerciseLabel(state)}
                </span>
                <span className="mrow__go mrow__go--pair">
                  <Link
                    to="/academy/$exerciseId"
                    params={{ exerciseId: exercise.id }}
                    search={{ mode: 'practice' }}
                    className={buttonClass('secondary', 'sm')}
                    aria-label={m.academy_practice_named({ title: exercise.title })}
                  >
                    {m.academy_practice()}
                  </Link>
                  <Link
                    to="/academy/$exerciseId"
                    params={{ exerciseId: exercise.id }}
                    search={{ mode: 'test' }}
                    className={buttonClass('quiet', 'sm')}
                    aria-label={m.academy_test_named({ title: exercise.title })}
                  >
                    {m.academy_test()}
                  </Link>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function ModuleTab(props: {
  readonly module: AcademyModule
  readonly n: number
  readonly progress: CourseProgress
  readonly open: boolean
  readonly onOpen: () => void
}) {
  const state = props.progress.modules[props.module.id]
  const complete = state?.complete === true
  return (
    <li>
      <button
        type="button"
        className={cx('mmod', props.open && 'is-open')}
        aria-pressed={props.open}
        data-complete={complete || undefined}
        data-module={props.module.id}
        onClick={props.onOpen}
      >
        <span className="mmod__n">{String(props.n).padStart(2, '0')}</span>
        <span className="mmod__title">{local(props.module.title)}</span>
        <span className="mmod__count" data-testid="module-count">
          {m.academy_module_count({
            mastered: state?.mastered ?? 0,
            total: props.module.exercises.length,
          })}
        </span>
        <span className="mmod__bar" aria-hidden="true">
          <i style={{ width: `${(state?.fraction ?? 0) * 100}%` }} />
        </span>
      </button>
    </li>
  )
}

/* ---- Review and the finish line ----------------------------------------------------------- */

function ReviewDetail(props: DetailProps) {
  const { data } = props
  const spots = useMemo(() => rankWeakSpots(data.progress, data.layout, 4), [data])
  return (
    <Frame
      stage={props.node.stage}
      kicker={m.map_legend_review()}
      title={m.map_review_node()}
      info={
        <>
          <p className="md-goal">{m.map_review_body()}</p>
          <div className="md-go">
            <Button
              variant="primary"
              size="lg"
              hint="Enter"
              aria-keyshortcuts="Enter R"
              onClick={props.onReview}
            >
              {m.map_review_open()}
            </Button>
          </div>
        </>
      }
    >
      {spots.length === 0 ? (
        <ReviewEmpty onFree={props.onFree} />
      ) : (
        <ol className="md-spots">
          {spots.map((spot) => (
            <li key={spot.element}>
              <b>{spotLabel(spot.element)}</b>
              <span>{numbers(spot)}</span>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  )
}

const HOW_REVIEW_FILLS = [
  [m.map_review_step1_title, m.map_review_step1_body],
  [m.map_review_step2_title, m.map_review_step2_body],
  [m.map_review_step3_title, m.map_review_step3_body],
] as const

/** No weak spot yet: how review fills up, and something to type meanwhile. */
function ReviewEmpty({ onFree }: { readonly onFree: () => void }) {
  return (
    <div className="md-rempty" data-testid="map-review-empty">
      <p className="md-rempty__title">{m.map_review_empty_title()}</p>
      <ol className="md-rempty__steps">
        {HOW_REVIEW_FILLS.map(([title, body], i) => (
          <li key={title()}>
            <span className="md-rempty__n">{i + 1}</span>
            <b>{title()}</b>
            <span>{body()}</span>
          </li>
        ))}
      </ol>
      <div className="md-rempty__free">
        <Button variant="secondary" size="sm" hint="P" aria-keyshortcuts="P" onClick={onFree}>
          {m.map_free()}
        </Button>
        <span>{m.map_review_empty_free()}</span>
      </div>
    </div>
  )
}

const FINISH: Record<1 | 2 | 3, () => string> = {
  1: m.map_finish_1,
  2: m.map_finish_2,
  3: m.map_finish_3,
}

function FinishDetail(props: { readonly node: FinishNode; readonly steps: readonly StepNode[] }) {
  const { node, steps } = props
  return (
    <Frame
      stage={node.stage}
      kicker={`${m.map_stage({ n: node.stage })} · ${STAGE_NAMES[node.stage]()}`}
      title={m.map_finish_node({ n: node.stage })}
      info={
        <>
          <p className="md-goal">{FINISH[node.stage]()}</p>
          <p className="md-state" data-testid="map-finish-state" data-done={node.done || undefined}>
            {node.done ? m.map_finish_done() : m.map_finish_not()}
          </p>
        </>
      }
    >
      <ol className="md-list" aria-label={m.map_exercises()}>
        {steps.map((step) => (
          <li key={step.id} className="mrow" data-node-state={step.state}>
            <span className="mrow__n">{step.n}</span>
            <span className="mrow__main">
              <span className="mrow__name">{stepName(step)}</span>
              <span className="mrow__sub">{stepGoal(step)}</span>
            </span>
            <span className="mrow__state">
              {step.total === null ? '' : m.map_node_count({ done: step.done, total: step.total })}
            </span>
            <span className="mrow__go mrow__word">{stateWord(step.state)}</span>
          </li>
        ))}
      </ol>
    </Frame>
  )
}
