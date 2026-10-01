import {
  type AcademyCourse,
  type CourseProgress,
  catalogue,
  layouts,
  wordCatalogue,
} from '@typing-race/curriculum'
import type { Progress, WordDrill } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { scaleRows } from '../path/model'
import type { DrillRow, DrillState } from '../words/model'
import {
  academyStart,
  initialSelection,
  type MapInput,
  type MapView,
  mapView,
  routeGeometry,
  type StepNode,
  stage1GroupOf,
  stage1Groups,
  stepSelection,
} from './model'

const layout = layouts.yq
const scales = catalogue.yq

function progress(unlocked: readonly string[], completed: readonly string[] = []): Progress {
  return {
    unlockedSet: [...layout.homeAnchors, ' ', ...unlocked],
    completedScales: completed,
    consecutivePasses: {},
  } as unknown as Progress
}

function input(overrides: Partial<MapInput> = {}): MapInput {
  return {
    layout,
    scaleRows: scaleRows(layout, scales, progress([])),
    stage1Complete: false,
    words: { open: false, rows: null },
    academy: null,
    ...overrides,
  }
}

function steps(view: MapView): StepNode[] {
  return view.nodes.filter((node): node is StepNode => node.kind === 'step')
}

function drill(id: string, kind: WordDrill['kind']): WordDrill {
  return { id, kind, focus: null, requires: [], after: null } as unknown as WordDrill
}

function row(id: string, kind: WordDrill['kind'], state: DrillState): DrillRow {
  return { drill: drill(id, kind), state, preview: [] }
}

function course(): AcademyCourse {
  const module = (id: string, step: string, n: number) => ({
    id,
    step,
    kind: 'words',
    title: { uk: id, en: id },
    summary: { uk: id, en: id },
    exercises: Array.from({ length: n }, (_, i) => ({ id: `academy.uk.${id}.${i + 1}` })),
  })
  return {
    modules: [
      module('warm-up', 'keys', 2),
      module('bigrams', 'pairs', 2),
      module('text', 'text', 1),
    ],
  } as unknown as AcademyCourse
}

function courseProgress(
  exercises: Record<string, { mastered?: boolean; practiced?: boolean }>,
  modules: Record<string, boolean> = {},
  complete = false,
): CourseProgress {
  return {
    exercises,
    modules: Object.fromEntries(
      Object.entries(modules).map(([id, done]) => [id, { complete: done }]),
    ),
    complete,
  } as unknown as CourseProgress
}

describe('stage1GroupOf', () => {
  it('puts every scale of the catalogue in a row block, in route order', () => {
    const groups = scales.map((scale) => stage1GroupOf(layout, scale))
    expect(groups[0]).toBe('home')
    expect(groups).toContain('top')
    expect(groups).toContain('bottom')
    expect(groups).toContain('shift')
    expect(groups).toContain('symbols')
    // The catalogue follows the Unlock Order, which runs row by row: the blocks never interleave.
    const order = ['home', 'top', 'bottom', 'shift', 'symbols']
    const ranks = groups.map((group) => order.indexOf(group))
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('keeps every scale exactly once across the blocks', () => {
    const rows = scaleRows(layout, scales, progress([]))
    const total = stage1Groups(layout, rows).reduce((sum, g) => sum + g.rows.length, 0)
    expect(total).toBe(scales.length)
  })
})

describe('mapView', () => {
  it('a fresh learner: «ти тут» on the first block, Stage 2 closed, numbers run along the route', () => {
    const view = mapView(input())
    expect(view.currentId).toBe('s1-home')
    const all = steps(view)
    expect(all.map((node) => node.n)).toEqual(all.map((_, i) => i + 1))
    expect(all.find((node) => node.id === 's1-top')?.state).toBe('locked')
    expect(all.filter((node) => node.stage === 2).every((node) => node.state === 'locked')).toBe(
      true,
    )
    expect(view.regions[0].status).toBe('here')
    expect(view.regions[1].status).toBe('locked')
    // Enter on the current node starts its first open scale, in practice.
    expect(all[0]?.next).toEqual({ route: 'exercise', id: scales[0]?.id, mode: 'practice' })
  })

  it('every region ends with its finish flag; Stages 2 and 3 open with a review stop', () => {
    const view = mapView(input())
    for (const region of view.regions) {
      expect(region.nodes.at(-1)?.kind).toBe('finish')
      expect(region.nodes[0]?.kind).toBe(region.stage === 1 ? 'step' : 'review')
    }
  })

  it('a finished block is done and «ти тут» moves on to the next open one', () => {
    const home = stage1Groups(layout, scaleRows(layout, scales, progress([])))[0]
    const completed = home?.rows.map((r) => r.scale.id) ?? []
    const unlocked = layout.unlockOrder.slice(0, 3)
    const rows = scaleRows(layout, scales, progress(unlocked, completed))
    const view = mapView(input({ scaleRows: rows }))
    expect(steps(view)[0]?.state).toBe('done')
    expect(view.currentId).toBe('s1-top')
  })

  it('a scale with a streak is resumed as a test attempt', () => {
    const p = { ...progress([]), consecutivePasses: { [scales[0]?.id ?? '']: 2 } } as Progress
    const view = mapView(input({ scaleRows: scaleRows(layout, scales, p) }))
    expect(steps(view)[0]?.next?.mode).toBe('test')
  })

  it('Stage 2 blocks follow their drill rows; a thin drill does not hold a block open', () => {
    const rows: DrillRow[] = [
      row('yq.words.first', 'firstWords', { kind: 'complete' }),
      row('yq.words.length.short', 'length', { kind: 'thin' }),
      row('yq.words.key.KeyG', 'newKey', { kind: 'notStarted' }),
      row('yq.words.repeat', 'repeat', { kind: 'lockedAfter', after: drill('x', 'repeat') }),
    ]
    const view = mapView(input({ words: { open: true, rows } }))
    const stage2 = steps(view).filter((node) => node.stage === 2)
    expect(stage2.map((node) => node.state)).toEqual(['done', 'open', 'locked'])
    expect(stage2[1]?.next?.id).toBe('yq.words.key.KeyG')
  })

  it('while the Word Bank loads, an open Stage 2 shows its blocks without counts', () => {
    const view = mapView(input({ words: { open: true, rows: null } }))
    const stage2 = steps(view).filter((node) => node.stage === 2)
    expect(stage2.map((node) => [node.state, node.total])).toEqual([
      ['open', null],
      ['open', null],
      ['open', null],
    ])
  })

  it('Academy blocks pair the §3.3 steps and are never locked', () => {
    const view = mapView(input({ academy: { course: course(), progress: courseProgress({}) } }))
    const stage3 = steps(view).filter((node) => node.stage === 3)
    expect(stage3.map((node) => node.group)).toEqual(['keys', 'text'])
    expect(stage3.map((node) => node.total)).toEqual([2, 1])
    expect(stage3.every((node) => node.state === 'open')).toBe(true)
  })

  it('every Stage 1 block done puts «ти тут» in the next Stage, and the flag follows stage1Complete', () => {
    const all = scales.map((scale) => scale.id)
    const rows = scaleRows(layout, scales, progress(layout.unlockOrder, all))
    const view = mapView(
      input({
        scaleRows: rows,
        stage1Complete: true,
        words: { open: true, rows: [row('yq.words.first', 'firstWords', { kind: 'notStarted' })] },
      }),
    )
    expect(view.regions[0].status).toBe('done')
    expect(view.regions[0].nodes.at(-1)).toMatchObject({ kind: 'finish', done: true })
    expect(view.currentId).toBe('s2-ladder')
  })

  it('with every step done there is no current node', () => {
    const all = scales.map((scale) => scale.id)
    const view = mapView(
      input({
        scaleRows: scaleRows(layout, scales, progress(layout.unlockOrder, all)),
        stage1Complete: true,
        words: {
          open: true,
          rows: wordCatalogue.yq.map((d) => ({
            drill: d,
            state: { kind: 'complete' },
            preview: [],
          })),
        },
        academy: {
          course: course(),
          progress: courseProgress({}, { 'warm-up': true, bigrams: true, text: true }, true),
        },
      }),
    )
    expect(view.currentId).toBeNull()
    expect(view.regions.every((region) => region.status === 'done')).toBe(true)
    expect(initialSelection(view)).toBe(steps(view).at(-1)?.id)
  })
})

describe('academyStart', () => {
  it('starts the first unmastered exercise, as a test once it has been practised', () => {
    const c = course()
    const id = (n: number) => `academy.uk.warm-up.${n}`
    expect(academyStart(c.modules, courseProgress({}))).toEqual({
      route: 'academy',
      id: id(1),
      mode: 'practice',
    })
    expect(
      academyStart(
        c.modules,
        courseProgress({ [id(1)]: { mastered: true }, [id(2)]: { practiced: true } }),
      ),
    ).toEqual({ route: 'academy', id: id(2), mode: 'test' })
  })
})

describe('selection', () => {
  const view = mapView(input())

  it('opens on the current node, or on the asked-for Stage', () => {
    expect(initialSelection(view)).toBe('s1-home')
    expect(initialSelection(view, 3)).toBe('s3-keys')
    expect(initialSelection(view, 1)).toBe('s1-home')
  })

  it('arrow keys walk every stop of the route and stop at the ends', () => {
    expect(stepSelection(view, 's1-home', -1)).toBe('s1-home')
    expect(stepSelection(view, 's1-home', 1)).toBe('s1-top')
    const last = view.nodes.at(-1)?.id ?? ''
    expect(stepSelection(view, last, 1)).toBe(last)
    expect(stepSelection(view, 'finish-1', 1)).toBe('review-2')
  })
})

describe('routeGeometry', () => {
  const geometry = routeGeometry({
    width: 1000,
    regions: [[1, 1], [0.6, 1, 0.6], [1]],
    levels: [200, 100, 200],
    gap: 8,
    radius: 40,
    pad: 20,
  })

  it('splits the width into bands in proportion to their slots, with the gaps between', () => {
    const [a, b, c] = geometry.bands
    expect(a?.x).toBe(0)
    expect((a?.width ?? 0) + 8).toBeCloseTo(b?.x ?? 0)
    expect((c?.x ?? 0) + (c?.width ?? 0)).toBeCloseTo(1000)
    expect(a?.width ?? 0).toBeGreaterThan(c?.width ?? 0)
  })

  it('puts each slot on its region’s run, in order, with distance along the route rising', () => {
    const flat = geometry.points.flat()
    expect(geometry.points.map((p) => p.length)).toEqual([2, 3, 1])
    expect(geometry.points[1]?.every((p) => p.y === 100)).toBe(true)
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i]?.x ?? 0).toBeGreaterThan(flat[i - 1]?.x ?? 0)
      expect(flat[i]?.at ?? 0).toBeGreaterThan(flat[i - 1]?.at ?? 0)
    }
    expect(geometry.length).toBeGreaterThan(flat.at(-1)?.at ?? 0)
  })

  it('draws the route as runs joined by arcs and a vertical', () => {
    expect(geometry.d.startsWith('M20 200')).toBe(true)
    expect(geometry.d.match(/A40 40/g)).toHaveLength(4)
    expect(geometry.d).toContain('V140')
  })

  it('a minimum share keeps a short region readable', () => {
    const narrow = routeGeometry({
      width: 1000,
      regions: [[1, 1, 1, 1, 1, 1, 1, 1], [1], [1]],
      levels: [200, 100, 200],
      gap: 0,
      radius: 40,
      pad: 0,
      minShare: 0.25,
    })
    expect(narrow.bands[1]?.width ?? 0).toBeGreaterThanOrEqual(0.2 * 1000)
  })
})
