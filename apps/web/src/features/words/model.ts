import {
  drillPool,
  MASTERY_STREAK,
  MIN_POOL,
  stage2Gate,
  stage2Open,
  type WeakElements,
  type WordBank,
  weakElements,
  wordCatalogue,
} from '@typing-race/curriculum'
import type { Layout, Progress, WordDrill } from '@typing-race/domain'

/**
 * What the Stage 2 part of the Path shows, from derived `Progress` and the Word Bank alone. Like
 * the Stage 1 ladder, it keeps no list of its own: a drill is open when its keys are in the
 * unlocked set, and complete when the progress fold says so.
 */

export type DrillState =
  | { readonly kind: 'complete' }
  | { readonly kind: 'inProgress'; readonly count: number }
  | { readonly kind: 'notStarted' }
  | { readonly kind: 'lockedKeys'; readonly keys: readonly string[] }
  | { readonly kind: 'lockedAfter'; readonly after: WordDrill }
  /** Open, but the unlocked keys make too few real words yet. */
  | { readonly kind: 'thin' }

export interface DrillRow {
  readonly drill: WordDrill
  readonly state: DrillState
  /** The first words the drill draws from — the learner sees what they will type. */
  readonly preview: readonly string[]
}

export type DrillGroup = 'ladder' | 'keys' | 'sets'

export function groupOf(drill: WordDrill, layout: Layout): DrillGroup {
  if (drill.kind === 'firstWords' || drill.kind === 'length') return 'ladder'
  if (drill.kind === 'newKey') return 'keys'
  // A Ukrainian letter opened like any other key (ї, ґ) sits with the keys; і and є, open with
  // the home row, sit with the sets.
  if (drill.kind === 'ukLetter' && drill.focus !== null) {
    const char = drill.focus.value
    const early = layout.homeAnchors.includes(char) || stage2Gate(layout).includes(char)
    return early ? 'sets' : 'keys'
  }
  return 'sets'
}

export const PREVIEW_SIZE = 10

export function isOpenState(state: DrillState): boolean {
  return state.kind === 'complete' || state.kind === 'inProgress' || state.kind === 'notStarted'
}

export interface Stage2View {
  readonly open: boolean
  /** Gate keys still locked, when Stage 2 is closed. */
  readonly missing: readonly string[]
  readonly rows: readonly DrillRow[]
  readonly weak: WeakElements
}

export function stage2View(layout: Layout, progress: Progress, bank: WordBank): Stage2View {
  const unlocked = progress.unlockedSet
  const open = new Set(unlocked)
  const gateMissing = stage2Gate(layout).filter((char) => !open.has(char))
  const weak = weakElements(progress, layout)
  if (!stage2Open(layout, unlocked)) return { open: false, missing: gateMissing, rows: [], weak }

  const completed = new Set(progress.completedScales)
  const drills = wordCatalogue[layout.id]
  const byId = new Map(drills.map((drill) => [drill.id, drill]))

  const rows = drills.map((drill): DrillRow => {
    const missing = drill.requires.filter((char) => !open.has(char))
    if (missing.length > 0) {
      return { drill, state: { kind: 'lockedKeys', keys: missing }, preview: [] }
    }
    const after = drill.after === null ? undefined : byId.get(drill.after)
    if (after !== undefined && !completed.has(after.id)) {
      return { drill, state: { kind: 'lockedAfter', after }, preview: [] }
    }
    const pool = drillPool({ drill, bank, layout, unlocked, weak })
    const preview = pool.slice(0, PREVIEW_SIZE)
    if (new Set(pool).size < MIN_POOL) return { drill, state: { kind: 'thin' }, preview }
    if (completed.has(drill.id)) return { drill, state: { kind: 'complete' }, preview }
    const count = progress.consecutivePasses[drill.id] ?? 0
    return {
      drill,
      state: count > 0 ? { kind: 'inProgress', count } : { kind: 'notStarted' },
      preview,
    }
  })
  return { open: true, missing: [], rows, weak }
}

/**
 * The drill the Path puts forward: the words of the newest opened key, which is the moment the
 * requirements' demo asks to see ("a new key, and real words from learned keys only"). Before any
 * key past the home row, it is the first words.
 */
export function featuredRow(rows: readonly DrillRow[], layout: Layout): DrillRow | undefined {
  const keys = rows.filter((row) => groupOf(row.drill, layout) === 'keys' && isOpenState(row.state))
  return keys.at(-1) ?? rows.find((row) => row.drill.kind === 'firstWords')
}

export { MASTERY_STREAK }
