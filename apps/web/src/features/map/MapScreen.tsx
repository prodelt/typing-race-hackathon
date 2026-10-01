import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  academyProgress,
  findExercise,
  realTextId,
  stage2Gate,
  stage2Open,
} from '@typing-race/curriculum'
import type { Language } from '@typing-race/domain'
import { Button, cx } from '@typing-race/ui'
import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useScreenKeys } from '../../app/screenKeys.js'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { useAcademyCourse } from '../academy/data.js'
import { scaleName } from '../path/labels.js'
import { scaleRows, totalKeyCount, unlockedKeyCount } from '../path/model.js'
import { StartingLevel } from '../path/StartingLevel.js'
import { drillName, glyph } from '../words/labels.js'
import { stage2View } from '../words/model.js'
import { useWordBank } from '../words/useWordBank.js'
import { Detail, type MapData } from './Detail.js'
import { nodeName, STAGE_NAMES, stateWord, stepName } from './labels.js'
import {
  initialSelection,
  type LabelSide,
  labelLayout,
  type MapNode,
  type MapView,
  mapView,
  type RegionView,
  routeGeometry,
  type Stage,
  type StartTarget,
  type StepNode,
  slotWeight,
  stepSelection,
} from './model.js'
import { RouteLine, useSize } from './RouteLine.js'
import './map.css'

/**
 * The Map (destination 2): the whole curriculum as one route through three regions — Stage 1
 * scales, Stage 2 words, Stage 3 the Academy — in direction B with C's route line.
 *
 * One node per block of exercises. Selecting a node (click, ← →, Tab) opens its block below the
 * route with every exercise in it; Enter starts the block's next exercise. Review and free
 * practice are always one key away (R, P), and so is the starting-level control.
 */
export function MapScreen() {
  const { progress } = useDerived()
  if (progress === null) return <StartingLevel mode="first" />
  return <MapBody />
}

function useMapData(course: Language): { data: MapData; view: MapView } | null {
  const { progress, layout, catalogue } = useDerived()
  const attempts = useAppStore((state) => state.attempts)
  const bank = useWordBank(layout.language)
  const academy = useAcademyCourse(course)

  return useMemo(() => {
    if (progress === null) return null
    const rows = scaleRows(layout, catalogue, progress)
    const open = stage2Open(layout, progress.unlockedSet)
    const words = bank.status === 'ready' ? stage2View(layout, progress, bank.bank) : null
    const ready = academy.status === 'ready' ? academy.course : null
    const courseProgress = ready === null ? null : academyProgress(ready, attempts)
    const data: MapData = {
      layout,
      progress,
      scaleRows: rows,
      wordsOpen: open,
      wordsMissing: stage2Gate(layout).filter((char) => !progress.unlockedSet.includes(char)),
      words,
      wordsError: bank.status === 'error',
      academyLanguage: course,
      academy:
        ready === null || courseProgress === null
          ? null
          : { course: ready, progress: courseProgress },
      academyError: academy.status === 'error',
    }
    const view = mapView({
      layout,
      scaleRows: rows,
      stage1Complete: progress.stage.stage1Complete,
      words: { open, rows: words?.rows ?? null },
      academy: data.academy,
    })
    return { data, view }
  }, [progress, layout, catalogue, attempts, bank, academy, course])
}

/** The name of what a start target opens, for the button and the «ти тут» line. */
export function targetName(target: StartTarget, data: MapData): string {
  if (target.route === 'academy') {
    const found = data.academy === null ? undefined : findExercise(data.academy.course, target.id)
    return found === undefined ? target.id : found.exercise.title
  }
  const scale = data.scaleRows.find((row) => row.scale.id === target.id)?.scale
  if (scale !== undefined) return scaleName(scale)
  const drill = data.words?.rows.find((row) => row.drill.id === target.id)?.drill
  return drill === undefined ? target.id : drillName(drill)
}

function MapBody() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { stage?: number; course?: string }
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const course: Language =
    search.course === 'uk' || search.course === 'en' ? search.course : typingLanguage
  const asked: Stage | undefined =
    search.stage === 1 || search.stage === 2 || search.stage === 3 ? search.stage : undefined

  const model = useMapData(course)
  const [chosen, setChosen] = useState<string | null>(null)
  const [levelOpen, setLevelOpen] = useState(false)

  const view = model?.view ?? null
  const fallback = view === null ? null : initialSelection(view, asked)
  const selectedId =
    chosen !== null && view?.nodes.some((node) => node.id === chosen) ? chosen : fallback
  const selected = view?.nodes.find((node) => node.id === selectedId) ?? null

  const start = (target: StartTarget): void => {
    if (target.route === 'academy') {
      void navigate({
        to: '/academy/$exerciseId',
        params: { exerciseId: target.id },
        search: { mode: target.mode },
      })
      return
    }
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: target.id },
      search: { mode: target.mode },
    })
  }
  const review = (): void => void navigate({ to: '/review' })
  const free = (): void => {
    if (model === null) return
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: realTextId(model.data.layout) },
      search: { mode: 'practice' },
    })
  }
  const activate = (node: MapNode | null): void => {
    if (node === null) return
    if (node.kind === 'review') review()
    else if (node.kind === 'step' && node.next !== null) start(node.next)
  }
  const move = (delta: -1 | 1): void => {
    if (view !== null) setChosen(stepSelection(view, selectedId, delta))
  }

  useScreenKeys({
    Enter: () => activate(selected),
    ArrowRight: () => move(1),
    ArrowLeft: () => move(-1),
    KeyR: review,
    KeyP: free,
  })

  if (model === null || view === null) return null
  const { data } = model
  const current = view.nodes.find((node): node is StepNode => node.id === view.currentId)

  return (
    <div className="map">
      <header className="map-head">
        <h1 className="map-head__title">{m.map_title()}</h1>
        <p className="map-head__here" data-testid="map-here">
          {current === undefined ? (
            m.map_here_all()
          ) : (
            <>
              <b className="map-red">{m.map_here()}</b> {STAGE_NAMES[current.stage]()} ·{' '}
              <b>{stepName(current)}</b>
              {current.next === null ? null : <> · {targetName(current.next, data)}</>}
            </>
          )}
        </p>
        <div className="map-head__actions">
          <Button variant="secondary" size="sm" hint="R" aria-keyshortcuts="R" onClick={review}>
            {m.map_review()}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            hint="P"
            aria-keyshortcuts="P"
            title={m.map_free_title()}
            onClick={free}
          >
            {m.map_free()}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            aria-expanded={levelOpen}
            onClick={() => setLevelOpen((open) => !open)}
          >
            {levelOpen ? m.map_start_level_close() : m.map_start_level()}
          </Button>
        </div>
      </header>

      <RoutePanel
        view={view}
        data={data}
        selectedId={selectedId}
        onSelect={setChosen}
        onActivate={activate}
      />

      {levelOpen ? (
        <div className="map-level">
          <StartingLevel mode="change" />
        </div>
      ) : selected === null ? null : (
        <Detail
          key={selected.id}
          node={selected}
          data={data}
          onStart={start}
          onReview={review}
          onFree={free}
          targetName={(target) => targetName(target, data)}
          steps={view.nodes.filter((node): node is StepNode => node.kind === 'step')}
        />
      )}
    </div>
  )
}

/* ---- The route ---------------------------------------------------------------------------- */

const HEADER = 58
/** Below a low run: the dot, a name on up to two lines and the count or «ти тут» pill, plus air. */
const LABEL_ROOM = 84
/** How far apart the high and low runs sit: two arcs and a short vertical. */
const RISE = 90

function regionMeta(region: RegionView, data: MapData): string {
  const steps = region.nodes.filter((node): node is StepNode => node.kind === 'step')
  if (region.stage === 1) {
    return m.map_count_keys({
      unlocked: unlockedKeyCount(data.progress),
      total: totalKeyCount(data.layout),
    })
  }
  const done = steps.reduce((sum, node) => sum + node.done, 0)
  const known = steps.every((node) => node.total !== null)
  const total = steps.reduce((sum, node) => sum + (node.total ?? 0), 0)
  if (!known || total === 0) return ''
  return region.stage === 2
    ? m.map_count_drills({ done, total })
    : m.map_count_modules({ done, total })
}

function regionStatus(region: RegionView, data: MapData): string {
  switch (region.status) {
    case 'done':
      return m.map_region_done()
    case 'here':
      return m.map_region_here()
    case 'locked':
      return region.stage === 2
        ? m.map_region_locked({ keys: data.wordsMissing.map(glyph).join(' ') })
        : m.map_state_locked()
    case 'open':
      return region.stage === 3 && !data.progress.stage.stage1Complete
        ? m.map_region_after1()
        : m.map_region_open()
  }
}

function RoutePanel(props: {
  readonly view: MapView
  readonly data: MapData
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
  readonly onActivate: (node: MapNode) => void
}) {
  const { view, data, selectedId } = props
  const area = useRef<HTMLDivElement>(null)
  const { width, height } = useSize(area)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const focusFollows = useRef(false)

  const geometry = useMemo(
    () =>
      routeGeometry({
        width,
        regions: view.regions.map((region) => region.nodes.map(slotWeight)),
        // Both runs sit around the middle of the band, so no band is a tall empty field above
        // its nodes; the low run still leaves the room its names need below.
        levels: (() => {
          const low = Math.min(Math.round((HEADER + height) / 2 + RISE / 2), height - LABEL_ROOM)
          // The high run keeps clear of the region header for the names drawn above it.
          return [low, Math.max(HEADER + 66, low - RISE), low]
        })(),
        gap: 8,
        radius: width < 1000 ? 28 : 40,
        pad: width < 1000 ? 22 : 34,
        minShare: 0.24,
      }),
    [view, width, height],
  )

  // Names alternate below and above the line, so neighbours never share the same strip of room.
  const placed = view.regions.flatMap((region, r) => {
    const points = geometry.points[r] ?? []
    const labels = labelLayout(
      region.nodes.map((node, i) => ({ x: points[i]?.x ?? 0, labelled: node.kind === 'step' })),
    )
    return region.nodes.map((node, i) => ({
      node,
      point: points[i],
      side: labels[i]?.side ?? 'below',
      labelWidth: labels[i]?.width ?? 120,
    }))
  })
  const currentAt = placed.find((p) => p.node.id === view.currentId)?.point?.at
  const lastDone = placed.filter((p) => p.node.kind === 'step' && p.node.state === 'done').at(-1)
    ?.point?.at
  const walked =
    currentAt ??
    (view.regions.every((region) => region.status === 'done') ? geometry.length : (lastDone ?? 0))

  // Arrow keys move the selection; focus follows it when it started on the route.
  useEffect(() => {
    if (!focusFollows.current || selectedId === null) return
    focusFollows.current = false
    buttons.current.get(selectedId)?.focus()
  }, [selectedId])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = (delta: -1 | 1) => {
      const next = stepSelection(view, selectedId, delta)
      if (next !== null) {
        focusFollows.current = true
        props.onSelect(next)
      }
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step(1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step(-1)
    else if (event.key === 'Home' || event.key === 'End') {
      const id = event.key === 'Home' ? view.nodes[0]?.id : view.nodes.at(-1)?.id
      if (id === undefined) return
      focusFollows.current = true
      props.onSelect(id)
    } else if (event.key === 'Enter') {
      const node = view.nodes.find((n) => n.id === selectedId)
      if (node !== undefined) props.onActivate(node)
    } else return
    event.preventDefault()
  }

  const stepCount = view.nodes.filter((node) => node.kind === 'step').length

  return (
    <section className="map-route" aria-labelledby="map-route-title" data-testid="map-route">
      <h2 id="map-route-title" className="sr-only">
        {m.map_aria({ count: stepCount })}
      </h2>
      <div className="map-route__area" ref={area}>
        <RouteLine
          geometry={geometry}
          width={width}
          height={height}
          walked={walked}
          bandClass={(i) => {
            const status = view.regions[i]?.status
            return status === 'here' ? 'is-cur' : status === 'locked' ? 'is-lock' : ''
          }}
        />
        {view.regions.map((region, r) => {
          const band = geometry.bands[r]
          if (band === undefined || width <= 0) return null
          const meta = regionMeta(region, data)
          return (
            <div
              key={region.stage}
              className="map-region"
              data-status={region.status}
              data-testid={`map-region-${region.stage}`}
              style={{ left: band.x, width: band.width }}
            >
              <p className="map-region__name">
                <span className="map-region__n">0{region.stage}</span>
                {m.map_stage({ n: region.stage })} · {STAGE_NAMES[region.stage]()}
              </p>
              <p className="map-region__status">
                <span className="map-region__word">{regionStatus(region, data)}</span>
                {meta === '' ? null : <span> · {meta}</span>}
              </p>
            </div>
          )
        })}
        {width > 0 && (
          <div
            role="toolbar"
            aria-label={m.map_aria({ count: stepCount })}
            aria-orientation="horizontal"
            className="map-nodes"
            onKeyDown={onKeyDown}
          >
            {placed.map(({ node, point, side, labelWidth }) =>
              point === undefined ? null : (
                <NodeButton
                  key={node.id}
                  node={node}
                  side={side}
                  labelWidth={labelWidth}
                  x={point.x}
                  y={point.y}
                  selected={node.id === selectedId}
                  refCallback={(el) => {
                    if (el === null) buttons.current.delete(node.id)
                    else buttons.current.set(node.id, el)
                  }}
                  onClick={() => props.onSelect(node.id)}
                />
              ),
            )}
          </div>
        )}
      </div>
      <Legend />
    </section>
  )
}

function NodeButton(props: {
  readonly node: MapNode
  readonly side: LabelSide
  readonly labelWidth: number
  readonly x: number
  readonly y: number
  readonly selected: boolean
  readonly refCallback: (el: HTMLButtonElement | null) => void
  readonly onClick: () => void
}) {
  const { node, selected } = props
  const name = nodeName(node)
  const state =
    node.kind === 'step'
      ? node.state
      : node.kind === 'finish'
        ? node.done
          ? 'done'
          : 'locked'
        : 'open'
  const label =
    node.kind === 'step'
      ? m.map_node_aria({ n: node.n, name, state: stateWord(node.state) })
      : node.kind === 'finish'
        ? `${name}. ${node.done ? m.map_finish_done() : m.map_finish_not()}`
        : name

  return (
    <button
      ref={props.refCallback}
      type="button"
      className={cx('mnode2', `mnode2--${node.kind}`, selected && 'is-selected')}
      data-node={node.id}
      data-node-state={state}
      data-side={props.side}
      aria-pressed={selected}
      aria-label={label}
      tabIndex={selected ? 0 : -1}
      style={{ left: props.x, top: props.y, '--label-w': `${props.labelWidth}px` } as CSSProperties}
      onClick={props.onClick}
    >
      {node.kind === 'step' ? (
        <>
          <span className="mnode2__dot" aria-hidden="true">
            {node.n}
          </span>
          <span className="mnode2__label" aria-hidden="true">
            <span className="mnode2__name">{name}</span>
            {node.state === 'current' ? (
              <span className="mnode2__here">
                {m.map_state_current()}
                {node.total === null
                  ? null
                  : ` · ${m.map_node_count({ done: node.done, total: node.total })}`}
              </span>
            ) : node.total === null ? null : (
              <span className="mnode2__count">
                {m.map_node_count({ done: node.done, total: node.total })}
              </span>
            )}
          </span>
        </>
      ) : node.kind === 'review' ? (
        <span className="mnode2__dot" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />
          </svg>
        </span>
      ) : (
        <span className="mnode2__dot" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 20V4M7 4h10l-2.5 4L17 12H7" />
          </svg>
        </span>
      )}
    </button>
  )
}

function Legend() {
  return (
    <div className="map-legend" role="note" aria-label={m.map_legend()}>
      <span>
        <i className="lg2 lg2--done" />
        {m.map_legend_done()}
      </span>
      <span>
        <i className="lg2 lg2--cur" />
        {m.map_legend_here()}
      </span>
      <span>
        <i className="lg2 lg2--open" />
        {m.map_legend_open()}
      </span>
      <span>
        <i className="lg2 lg2--lock" />
        {m.map_legend_locked()}
      </span>
      <span>
        <i className="lg2 lg2--review" />
        {m.map_legend_review()}
      </span>
      <span>
        <i className="lg2 lg2--finish" />
        {m.map_legend_finish()}
      </span>
      <span className="map-legend__keys">
        <span className="kbd">←</span>
        <span className="kbd">→</span> {m.map_legend_keys()} · <span className="kbd">Enter</span>{' '}
        {m.map_legend_enter()}
      </span>
    </div>
  )
}
