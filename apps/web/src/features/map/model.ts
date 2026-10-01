import {
  type AcademyCourse,
  type AcademyModule,
  type AcademyStep,
  type CourseProgress,
  keyOf,
  SHIFT_TOKEN,
} from '@typing-race/curriculum'
import type { Layout, Scale } from '@typing-race/domain'
import type { ScaleRow } from '../path/model.js'
import { type DrillGroup, type DrillRow, groupOf } from '../words/model.js'

/**
 * The Map as a view model: the whole curriculum as one route through three regions, read from the
 * derived data the app already has (Stage 1 scale rows, the Stage 2 drill rows, the Academy
 * progress fold). Nothing here decides what is open or mastered — it only groups those answers
 * into nodes a learner can take in at a glance, and picks the one node that says «ти тут».
 *
 * Granularity: one node per block of exercises, never one per exercise. Stage 1 is grouped by the
 * row of the key each scale is focused on (the Unlock Order runs row by row, so the groups follow
 * the route); Stage 2 by its three drill groups; Stage 3 by pairs of the §3.3 steps.
 */

export type Stage = 1 | 2 | 3
export type NodeState = 'done' | 'current' | 'open' | 'locked'

export type Stage1Group = 'home' | 'top' | 'bottom' | 'shift' | 'symbols'
export type AcademyGroup = 'keys' | 'syllables' | 'phrases' | 'text'

export const STAGE1_GROUPS: readonly Stage1Group[] = ['home', 'top', 'bottom', 'shift', 'symbols']
export const STAGE2_GROUPS: readonly DrillGroup[] = ['ladder', 'keys', 'sets']
export const ACADEMY_GROUPS: readonly AcademyGroup[] = ['keys', 'syllables', 'phrases', 'text']

const ACADEMY_GROUP_OF: Record<AcademyStep, AcademyGroup> = {
  keys: 'keys',
  pairs: 'keys',
  morphemes: 'syllables',
  words: 'syllables',
  phrases: 'phrases',
  sentences: 'phrases',
  text: 'text',
  tempo: 'text',
}

/** What Enter on a node starts: an exercise route and the mode it opens in. */
export interface StartTarget {
  readonly route: 'exercise' | 'academy'
  readonly id: string
  readonly mode: 'practice' | 'test'
}

export interface StepNode {
  readonly kind: 'step'
  readonly id: string
  readonly stage: Stage
  readonly group: Stage1Group | DrillGroup | AcademyGroup
  readonly state: NodeState
  /** 1-based position among the step nodes of the whole route. */
  readonly n: number
  readonly done: number
  /** `null` while the exercises behind the node are still loading. */
  readonly total: number | null
  readonly next: StartTarget | null
}

/** A weak-spot review stop. Review is open to everyone, always. */
export interface ReviewNode {
  readonly kind: 'review'
  readonly id: string
  readonly stage: Stage
}

/** The finish line of a region: the Stage is complete. */
export interface FinishNode {
  readonly kind: 'finish'
  readonly id: string
  readonly stage: Stage
  readonly done: boolean
}

export type MapNode = StepNode | ReviewNode | FinishNode

export type RegionStatus = 'done' | 'here' | 'open' | 'locked'

export interface RegionView {
  readonly stage: Stage
  readonly status: RegionStatus
  readonly nodes: readonly MapNode[]
}

export interface MapView {
  readonly regions: readonly [RegionView, RegionView, RegionView]
  /** Every node in route order. */
  readonly nodes: readonly MapNode[]
  /** The node «ти тут» sits on; `null` once every step is done. */
  readonly currentId: string | null
}

/* ---- Stage 1 ---------------------------------------------------------------------------- */

/** The row block a Stage 1 scale belongs to, from the key its focus is on. */
export function stage1GroupOf(layout: Layout, scale: Scale): Stage1Group {
  const focus = scale.focus.value
  if (focus === SHIFT_TOKEN) return 'shift'
  if (focus === ' ' || layout.homeAnchors.includes(focus)) return 'home'
  const key = keyOf(layout, focus)
  // A shifted character (`;` on the Ukrainian 4) is punctuation, whatever key carries it.
  if (key === undefined || key.plain !== focus) return 'symbols'
  if (key.kind === 'digit') return 'shift'
  if (key.kind !== 'letter') return 'symbols'
  return key.row === 'top' ? 'top' : key.row === 'bottom' ? 'bottom' : 'home'
}

export function stage1Groups(
  layout: Layout,
  rows: readonly ScaleRow[],
): { readonly group: Stage1Group; readonly rows: readonly ScaleRow[] }[] {
  return STAGE1_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => stage1GroupOf(layout, row.scale) === group),
  })).filter((entry) => entry.rows.length > 0)
}

function scaleStart(rows: readonly ScaleRow[]): StartTarget | null {
  const row =
    rows.find((r) => r.state.kind === 'inProgress') ??
    rows.find((r) => r.state.kind === 'notStarted')
  if (row === undefined) return null
  return {
    route: 'exercise',
    id: row.scale.id,
    mode: row.state.kind === 'inProgress' ? 'test' : 'practice',
  }
}

/* ---- Stage 2 ---------------------------------------------------------------------------- */

export function stage2Groups(
  layout: Layout,
  rows: readonly DrillRow[],
): { readonly group: DrillGroup; readonly rows: readonly DrillRow[] }[] {
  return STAGE2_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => groupOf(row.drill, layout) === group),
  }))
}

/** A drill is finished when it is mastered, or open but with too few words to ever start. */
function drillSettled(row: DrillRow): boolean {
  return row.state.kind === 'complete' || row.state.kind === 'thin'
}

function drillStart(rows: readonly DrillRow[]): StartTarget | null {
  const row =
    rows.find((r) => r.state.kind === 'inProgress') ??
    rows.find((r) => r.state.kind === 'notStarted')
  if (row === undefined) return null
  return {
    route: 'exercise',
    id: row.drill.id,
    mode: row.state.kind === 'inProgress' ? 'test' : 'practice',
  }
}

/* ---- Stage 3 ---------------------------------------------------------------------------- */

export function academyGroups(
  course: AcademyCourse,
): { readonly group: AcademyGroup; readonly modules: readonly AcademyModule[] }[] {
  return ACADEMY_GROUPS.map((group) => ({
    group,
    modules: course.modules.filter((module) => ACADEMY_GROUP_OF[module.step] === group),
  })).filter((entry) => entry.modules.length > 0)
}

/** The first unmastered exercise of the modules: practised already, it is time for the test. */
export function academyStart(
  modules: readonly AcademyModule[],
  progress: CourseProgress,
): StartTarget | null {
  for (const module of modules) {
    for (const exercise of module.exercises) {
      const state = progress.exercises[exercise.id]
      if (state?.mastered === true) continue
      return {
        route: 'academy',
        id: exercise.id,
        mode: state?.practiced === true ? 'test' : 'practice',
      }
    }
  }
  return null
}

/* ---- The whole route -------------------------------------------------------------------- */

export interface MapInput {
  readonly layout: Layout
  readonly scaleRows: readonly ScaleRow[]
  readonly stage1Complete: boolean
  /** Stage 2: closed until the gate keys are open; `rows` is `null` while the Word Bank loads. */
  readonly words: { readonly open: boolean; readonly rows: readonly DrillRow[] | null }
  /** `null` while the course loads. */
  readonly academy: { readonly course: AcademyCourse; readonly progress: CourseProgress } | null
}

type Draft = Omit<StepNode, 'n' | 'state'> & { readonly state: Exclude<NodeState, 'current'> }

function settle(done: number, total: number | null, startable: boolean): Draft['state'] {
  if (total !== null && total > 0 && done === total) return 'done'
  return startable || total === null ? 'open' : 'locked'
}

function stage1Drafts(input: MapInput): Draft[] {
  return stage1Groups(input.layout, input.scaleRows).map(({ group, rows }) => {
    const done = rows.filter((r) => r.state.kind === 'complete').length
    const next = scaleStart(rows)
    return {
      kind: 'step',
      id: `s1-${group}`,
      stage: 1,
      group,
      done,
      total: rows.length,
      next,
      state: settle(done, rows.length, next !== null),
    }
  })
}

function stage2Drafts(input: MapInput): Draft[] {
  const { open, rows } = input.words
  if (rows === null || !open) {
    return STAGE2_GROUPS.map((group) => ({
      kind: 'step',
      id: `s2-${group}`,
      stage: 2,
      group,
      done: 0,
      total: null,
      next: null,
      state: open ? 'open' : 'locked',
    }))
  }
  return stage2Groups(input.layout, rows).map(({ group, rows: inGroup }) => {
    const settled = inGroup.filter(drillSettled).length
    const done = inGroup.filter((r) => r.state.kind === 'complete').length
    const next = open ? drillStart(inGroup) : null
    const allSettled = inGroup.length > 0 && settled === inGroup.length
    return {
      kind: 'step',
      id: `s2-${group}`,
      stage: 2,
      group,
      done,
      total: inGroup.length,
      next,
      state: !open ? 'locked' : allSettled ? 'done' : next !== null ? 'open' : 'locked',
    }
  })
}

function stage3Drafts(input: MapInput): Draft[] {
  const { academy } = input
  if (academy === null) {
    return ACADEMY_GROUPS.map((group) => ({
      kind: 'step',
      id: `s3-${group}`,
      stage: 3,
      group,
      done: 0,
      total: null,
      next: null,
      state: 'open',
    }))
  }
  return academyGroups(academy.course).map(({ group, modules }) => {
    const done = modules.filter((m) => academy.progress.modules[m.id]?.complete === true).length
    const next = academyStart(modules, academy.progress)
    return {
      kind: 'step',
      id: `s3-${group}`,
      stage: 3,
      group,
      done,
      total: modules.length,
      next,
      state: settle(done, modules.length, next !== null),
    }
  })
}

export function mapView(input: MapInput): MapView {
  const drafts: [Draft[], Draft[], Draft[]] = [
    stage1Drafts(input),
    stage2Drafts(input),
    stage3Drafts(input),
  ]
  const steps = drafts.flat()
  // «Ти тут»: the first block along the route that is neither finished nor closed.
  const current = steps.find((d) => d.state === 'open' && d.next !== null)
  const currentId = current?.id ?? null

  const finished: [boolean, boolean, boolean] = [
    input.stage1Complete,
    drafts[1].length > 0 && drafts[1].every((d) => d.state === 'done'),
    input.academy?.progress.complete === true,
  ]

  let n = 0
  const regions = drafts.map((list, index): RegionView => {
    const stage = (index + 1) as Stage
    const stepNodes: StepNode[] = list.map((draft) => {
      n += 1
      return { ...draft, n, state: draft.id === currentId ? 'current' : draft.state }
    })
    const nodes: MapNode[] = [
      ...(stage === 1 ? [] : [{ kind: 'review' as const, id: `review-${stage}`, stage }]),
      ...stepNodes,
      { kind: 'finish', id: `finish-${stage}`, stage, done: finished[index] ?? false },
    ]
    const status: RegionStatus = finished[index]
      ? 'done'
      : stepNodes.some((s) => s.state === 'current')
        ? 'here'
        : stepNodes.every((s) => s.state === 'locked')
          ? 'locked'
          : 'open'
    return { stage, status, nodes }
  }) as unknown as [RegionView, RegionView, RegionView]

  return { regions, nodes: regions.flatMap((r) => r.nodes), currentId }
}

/**
 * The node a visit should open on: the current one, or — when the visit asks for a Stage — the
 * current one if it is in that Stage, else that Stage's first unfinished block, else its first.
 */
export function initialSelection(view: MapView, stage?: Stage): string | null {
  const steps = view.nodes.filter((node): node is StepNode => node.kind === 'step')
  if (stage === undefined) return view.currentId ?? steps.at(-1)?.id ?? null
  const inStage = steps.filter((node) => node.stage === stage)
  const current = inStage.find((node) => node.state === 'current')
  return (
    current?.id ??
    inStage.find((node) => node.state === 'open')?.id ??
    inStage.find((node) => node.state !== 'done')?.id ??
    inStage[0]?.id ??
    null
  )
}

/** Arrow keys walk the route; the ends stop rather than wrap. */
export function stepSelection(view: MapView, id: string | null, delta: -1 | 1): string | null {
  const index = view.nodes.findIndex((node) => node.id === id)
  if (index === -1) return view.nodes[0]?.id ?? null
  const next = Math.min(view.nodes.length - 1, Math.max(0, index + delta))
  return view.nodes[next]?.id ?? id
}

/* ---- Geometry --------------------------------------------------------------------------- */

/** How much room a node takes on the route: a block is a full slot, a review or a flag less. */
export function slotWeight(node: MapNode): number {
  return node.kind === 'step' ? 1 : 0.62
}

export interface RouteGeometryInput {
  readonly width: number
  /** Per region, the weights of its slots in route order. */
  readonly regions: readonly (readonly number[])[]
  /** The y of each region's run of the route. */
  readonly levels: readonly number[]
  readonly gap: number
  readonly radius: number
  /** Inner margin of the first and last runs. */
  readonly pad: number
  /** Each band is at least this share of the width, so a short region still reads as a region. */
  readonly minShare?: number
}

export interface Point {
  readonly x: number
  readonly y: number
  /** Distance along the route from its start. */
  readonly at: number
}

export interface RouteGeometry {
  readonly bands: readonly { readonly x: number; readonly width: number }[]
  readonly d: string
  readonly length: number
  /** Per region, one point per slot. */
  readonly points: readonly (readonly Point[])[]
}

const round = (value: number): number => Math.round(value * 10) / 10

/**
 * B's route line (C's drawing): one horizontal run per region at its own height, joined in the
 * gaps between regions by 40 px arcs and a vertical. Nodes sit only on the runs, so their names
 * can always go under them. Pure arithmetic in pixels, so the screen can draw text at its real
 * size at any width.
 */
export function routeGeometry(input: RouteGeometryInput): RouteGeometry {
  const { width, regions, levels, gap, pad } = input
  const count = regions.length
  const sums = regions.map((weights) => weights.reduce((sum, w) => sum + w, 0) || 1)
  const total = sums.reduce((sum, w) => sum + w, 0)
  const inner = width - gap * (count - 1)
  // Regions under the minimum get exactly the minimum; the rest share what is left in proportion.
  const minShare = input.minShare ?? 0
  const small = sums.map((s) => s / total < minShare)
  const smallCount = small.filter(Boolean).length
  const bigSum = sums.reduce((sum, s, i) => (small[i] ? sum : sum + s), 0) || 1
  const widths = sums.map((s, i) =>
    small[i] ? minShare * inner : (s / bigSum) * (1 - smallCount * minShare) * inner,
  )

  const bands: { x: number; width: number }[] = []
  let x = 0
  for (const w of widths) {
    bands.push({ x, width: w })
    x += w + gap
  }
  const boundary = (i: number): number => {
    const band = bands[i] as { x: number; width: number }
    return band.x + band.width + gap / 2
  }

  const quarter = (r: number) => (Math.PI * r) / 2
  const parts: string[] = []
  const points: Point[][] = []
  let along = 0

  for (let i = 0; i < count; i++) {
    const y = levels[i] ?? 0
    const prevY = i === 0 ? y : (levels[i - 1] ?? y)
    const nextY = i === count - 1 ? y : (levels[i + 1] ?? y)
    const rIn = Math.min(input.radius, Math.abs(y - prevY) / 2)
    const rOut = Math.min(input.radius, Math.abs(nextY - y) / 2)
    const band = bands[i] as { x: number; width: number }
    const xs = i === 0 ? band.x + pad : boundary(i - 1) + rIn
    const xe = i === count - 1 ? band.x + band.width - pad : boundary(i) - rOut
    if (i === 0) parts.push(`M${round(xs)} ${round(y)}`)

    const weights = regions[i] ?? []
    const sum = sums[i] ?? 1
    let cum = 0
    points.push(
      weights.map((w) => {
        const px = xs + ((cum + w / 2) / sum) * (xe - xs)
        cum += w
        return { x: round(px), y: round(y), at: round(along + (px - xs)) }
      }),
    )
    parts.push(`H${round(xe)}`)
    along += xe - xs

    if (i < count - 1) {
      const b = boundary(i)
      const up = nextY < y
      const dy = Math.abs(nextY - y)
      if (dy === 0) continue
      const s1 = up ? 0 : 1
      const s2 = up ? 1 : 0
      const sign = up ? -1 : 1
      parts.push(
        `A${round(rOut)} ${round(rOut)} 0 0 ${s1} ${round(b)} ${round(y + sign * rOut)}`,
        `V${round(nextY - sign * rOut)}`,
        `A${round(rOut)} ${round(rOut)} 0 0 ${s2} ${round(b + rOut)} ${round(nextY)}`,
      )
      along += quarter(rOut) * 2 + (dy - 2 * rOut)
    }
  }

  return { bands, d: parts.join(' '), length: round(along), points }
}

export type LabelSide = 'below' | 'above'

/**
 * Names alternate below and above the line within a region, so two neighbours never compete for
 * the same strip; each name may then be as wide as the distance to the next name on its side.
 */
export function labelLayout(
  slots: readonly { readonly x: number; readonly labelled: boolean }[],
  limits: { readonly min: number; readonly max: number } = { min: 64, max: 140 },
): { readonly side: LabelSide; readonly width: number }[] {
  let k = 0
  const sides = slots.map((slot): LabelSide => (slot.labelled && k++ % 2 === 1 ? 'above' : 'below'))
  return slots.map((slot, i) => {
    const side = sides[i] ?? 'below'
    if (!slot.labelled) return { side, width: limits.max }
    let room = Number.POSITIVE_INFINITY
    slots.forEach((other, j) => {
      if (j === i || !other.labelled || sides[j] !== side) return
      room = Math.min(room, Math.abs(other.x - slot.x) - 12)
    })
    return { side, width: Math.round(Math.max(limits.min, Math.min(limits.max, room))) }
  })
}
