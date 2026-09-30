import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { boundaryFor, catalogue, layouts, nextLockedKey } from '@typing-race/curriculum'
import type { Attempt, AttemptSummary, StartingLevelChoice } from '@typing-race/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { derive, initialState, setProgressStore, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { memoryStore } from '../../seams/index.js'
import { PathScreen, TodayScreen } from './index.js'
import { totalKeyCount } from './model.js'

const layout = layouts.yq
const scales = catalogue.yq

/** The scale whose Focus Element is the first key still to unlock — what the learner trains. */
function scaleForNextKey(unlocked: readonly string[]) {
  const next = nextLockedKey(layout, unlocked)
  const scale = scales.find((s) => s.focus.kind === 'key' && s.focus.value === next)
  if (scale === undefined) throw new Error('no scale for the next key')
  return scale
}

let clock = 0

function attempt(scaleId: string, accuracy: number, mode: Attempt['mode'] = 'test'): Attempt {
  clock += 1000
  return {
    id: `attempt-${clock}`,
    scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode,
    text: 'ффф',
    seed: 1,
    startedAt: clock - 500,
    completedAt: clock,
    elapsedMs: 500,
    metrics: {
      spm: 40,
      wpm: 8,
      accuracy,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
    log: null,
  }
}

function summary(scaleId: string, accuracy: number): AttemptSummary {
  const { log: _log, text: _text, ...rest } = attempt(scaleId, accuracy)
  return rest
}

async function boot(seed: Parameters<typeof memoryStore>[0] = {}) {
  setProgressStore(memoryStore(seed))
  useAppStore.setState({ ...initialState })
  await useAppStore.getState().boot()
}

function derived() {
  return derive(useAppStore.getState())
}

function renderAt(path: '/today' | '/path') {
  const root = createRootRoute()
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/today', component: TodayScreen }),
    createRoute({ getParentRoute: () => root, path: '/path', component: PathScreen }),
    createRoute({ getParentRoute: () => root, path: '/session', component: () => <p>session</p> }),
    createRoute({
      getParentRoute: () => root,
      path: '/exercise/$scaleId',
      component: () => <p>exercise</p>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  clock = 0
})
afterEach(cleanup)

describe('starting-level choice (FR-048)', () => {
  it('shows the choice, not the hub, from an empty store', async () => {
    await boot()
    renderAt('/today')
    expect(
      await screen.findByRole('heading', { level: 1, name: m.path_start_title() }),
    ).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByTestId('next-action')).toBeNull()
    expect(screen.queryByRole('heading', { name: m.path_where_title() })).toBeNull()
  })

  it('opens more keys for the third option than the first, and closes none', () => {
    const counts = (['neverTouchTyped', 'knowsHomeRow', 'touchTypesWantsAccuracy'] as const).map(
      (choice) => boundaryFor(layout, choice),
    )
    expect(counts[2]).toBeGreaterThan(counts[0] ?? 0)
    expect(counts[0]).toBe(0)
  })

  it('records the answer and then shows the hub', async () => {
    await boot()
    renderAt('/today')
    fireEvent.click(
      await screen.findByRole('radio', { name: new RegExp(m.path_start_home_title()) }),
    )
    fireEvent.click(screen.getByRole('button', { name: m.path_start_confirm() }))
    expect(await screen.findByTestId('next-action')).toBeVisible()
    expect(useAppStore.getState().startingLevelChoice).toBe('knowsHomeRow')
  })

  it('never reduces the unlocked set when re-answered, and keeps every attempt (FR-073)', async () => {
    const seeded = [summary(scales[0]?.id ?? '', 1)]
    await boot({ attempts: seeded })
    useAppStore.getState().chooseStartingLevel('touchTypesWantsAccuracy')
    const before = derived().progress?.unlockedSet ?? []

    renderAt('/path')
    const lower = await screen.findByRole('radio', {
      name: new RegExp(m.path_start_never_title()),
    })
    expect(lower).toBeDisabled()
    fireEvent.click(lower)
    const save = screen.getByRole('button', { name: m.path_start_change_confirm() })
    expect(save).toBeDisabled()

    const after = derived().progress
    expect(after?.unlockedSet).toEqual(before)
    expect(after?.history).toHaveLength(1)
    expect(useAppStore.getState().startingLevelChoice).toBe('touchTypesWantsAccuracy')
  })

  it('allows moving forward, which only opens keys', async () => {
    await boot({ attempts: [summary(scales[0]?.id ?? '', 1)] })
    useAppStore.getState().chooseStartingLevel('neverTouchTyped')
    const before = derived().progress?.unlockedSet ?? []

    renderAt('/path')
    const higher = await screen.findByRole('radio', {
      name: new RegExp(m.path_start_accuracy_title()),
    })
    fireEvent.click(higher)
    fireEvent.click(screen.getByRole('button', { name: m.path_start_change_confirm() }))

    const after = derived().progress
    expect(after?.unlockedSet.length).toBeGreaterThan(before.length)
    for (const char of before) expect(after?.unlockedSet).toContain(char)
    expect(after?.history).toHaveLength(1)
  })
})

describe('mastery and unlocking (FR-039, FR-041, FR-042)', () => {
  const isPrefix = (unlocked: readonly string[]) => {
    const beyondAnchors = unlocked.filter((c) => c !== ' ' && !layout.homeAnchors.includes(c))
    return beyondAnchors.every((c, i) => c === layout.unlockOrder[i])
  }

  it('unlocks exactly one key after three consecutive passing tests', async () => {
    await boot()
    const store = useAppStore.getState()
    store.chooseStartingLevel('neverTouchTyped')
    const base = derived().progress?.unlockedSet ?? []
    const scale = scaleForNextKey(base)

    for (let i = 0; i < 3; i++) await store.finishAttempt(attempt(scale.id, 0.97))

    const unlocked = derived().progress?.unlockedSet ?? []
    expect(unlocked).toHaveLength(base.length + 1)
    expect(unlocked).toContain(scale.focus.value)
    expect(isPrefix(unlocked)).toBe(true)
  })

  it('resets the streak on a failing attempt and unlocks nothing', async () => {
    await boot()
    const store = useAppStore.getState()
    store.chooseStartingLevel('neverTouchTyped')
    const base = derived().progress?.unlockedSet ?? []
    const scale = scaleForNextKey(base)

    await store.finishAttempt(attempt(scale.id, 0.97))
    await store.finishAttempt(attempt(scale.id, 0.97))
    await store.finishAttempt(attempt(scale.id, 0.5))
    await store.finishAttempt(attempt(scale.id, 0.97))

    const progress = derived().progress
    expect(progress?.unlockedSet).toEqual(base)
    expect(progress?.consecutivePasses[scale.id]).toBe(1)
  })

  it('does not count practice attempts', async () => {
    await boot()
    const store = useAppStore.getState()
    store.chooseStartingLevel('neverTouchTyped')
    const base = derived().progress?.unlockedSet ?? []
    const scale = scaleForNextKey(base)
    for (let i = 0; i < 3; i++) await store.finishAttempt(attempt(scale.id, 1, 'practice'))
    expect(derived().progress?.unlockedSet).toEqual(base)
  })

  it('updates the Path keyboard when the key unlocks', async () => {
    await boot()
    const store = useAppStore.getState()
    store.chooseStartingLevel('neverTouchTyped')
    const base = derived().progress?.unlockedSet ?? []
    const scale = scaleForNextKey(base)
    const first = layout.unlockOrder[0] ?? ''
    const second = layout.unlockOrder[1] ?? ''

    renderAt('/path')
    const keyboard = await screen.findByTestId('keyboard')
    const state = (char: string) => {
      const code = layout.keys.find((k) => k.plain === char)?.code ?? ''
      return keyboard.querySelector(`[data-code="${code}"]`)?.getAttribute('data-state')
    }
    expect(state(first)).toBe('next')
    expect(state(second)).toBe('locked')

    for (let i = 0; i < 3; i++) {
      await useAppStore.getState().finishAttempt(attempt(scale.id, 0.97))
    }
    await waitFor(() => expect(state(first)).toBe('unlocked'))
    expect(state(second)).toBe('next')
  })

  it('states the condition that opens a locked scale, and marks later stages', async () => {
    await boot()
    useAppStore.getState().chooseStartingLevel('neverTouchTyped')
    renderAt('/path')
    const list = within(await screen.findByRole('region', { name: m.path_scales_title() }))
    const items = list.getAllByRole('listitem')
    expect(items.length).toBe(scales.length)
    expect(items.some((li) => li.getAttribute('data-state') === 'locked')).toBe(true)
    expect(screen.getByText(m.path_later_stage2())).toBeVisible()
    expect(screen.getByText(m.path_later_stage3())).toBeVisible()
  })
})

describe('Today', () => {
  it('renders exactly one Next Action with a button that starts it', async () => {
    await boot()
    useAppStore.getState().chooseStartingLevel('neverTouchTyped')
    renderAt('/today')

    const actions = await screen.findAllByTestId('next-action')
    expect(actions).toHaveLength(1)
    const region = within(screen.getByRole('region', { name: m.path_next_title() }))
    expect(region.getAllByRole('button')).toHaveLength(1)
    expect(region.getByRole('button', { name: m.path_next_start() })).toBeEnabled()
  })

  it('shows stage, unlocked key count and the streak, and links to session and Path', async () => {
    await boot()
    useAppStore.getState().chooseStartingLevel('neverTouchTyped')
    const scale = scaleForNextKey(derived().progress?.unlockedSet ?? [])
    await useAppStore.getState().finishAttempt(attempt(scale.id, 0.97))
    renderAt('/today')

    const where = within(await screen.findByRole('region', { name: m.path_where_title() }))
    expect(where.getByText(m.path_where_stage_value({ n: 1 }))).toBeVisible()
    expect(
      where.getByText(m.path_where_keys_value({ unlocked: 8, total: totalKeyCount(layout) })),
    ).toBeVisible()
    expect(where.getByText(m.path_where_streak_value({ count: 1, target: 3 }))).toBeVisible()
    expect(screen.getByRole('link', { name: m.path_open_session() })).toHaveAttribute(
      'href',
      '/session',
    )
    expect(screen.getByRole('link', { name: m.path_open_path() })).toHaveAttribute('href', '/path')
  })

  it('reads the same after a restart from stored attempts', async () => {
    const scale = scaleForNextKey(
      derive({ ...initialState, startingLevelChoice: 'neverTouchTyped' }).progress?.unlockedSet ??
        [],
    )
    const stored = [0.97, 0.97, 0.97].map((accuracy) => summary(scale.id, accuracy))
    await boot({ attempts: stored })
    renderAt('/today')
    const where = within(await screen.findByRole('region', { name: m.path_where_title() }))
    expect(
      where.getByText(m.path_where_keys_value({ unlocked: 9, total: totalKeyCount(layout) })),
    ).toBeVisible()
  })
})

// Kept for the type the seam seed takes; asserts the choices are exactly FR-048's three.
const CHOICES: readonly StartingLevelChoice[] = [
  'neverTouchTyped',
  'knowsHomeRow',
  'touchTypesWantsAccuracy',
]
describe('options', () => {
  it('offers exactly the three FR-048 answers', async () => {
    await boot()
    renderAt('/today')
    const radios = await screen.findAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual([...CHOICES])
  })
})
