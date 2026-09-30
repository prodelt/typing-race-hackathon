import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useParams,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attempt } from '@typing-race/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialState, setProgressStore, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { memoryStore } from '../../seams/index.js'
import { idleSession, sessionAttempts } from './machine.js'
import { SessionScreen } from './SessionScreen.js'
import { useSessionStore } from './store.js'

/**
 * The exercise screen belongs to another lane, so these tests stand in a stub at the same route.
 * It proves the session reaches `/exercise/$scaleId` through the router alone.
 */
function ExerciseStub() {
  const { scaleId } = useParams({ strict: false })
  return <p data-testid="exercise-stub">{scaleId}</p>
}

async function mount() {
  const root = createRootRoute()
  const session = createRoute({
    getParentRoute: () => root,
    path: '/session',
    component: SessionScreen,
  })
  const exercise = createRoute({
    getParentRoute: () => root,
    path: '/exercise/$scaleId',
    validateSearch: (search: Record<string, unknown>) => ({
      mode: search['mode'] === 'test' ? 'test' : 'practice',
    }),
    component: ExerciseStub,
  })
  const today = createRoute({
    getParentRoute: () => root,
    path: '/today',
    component: () => <p>today</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([session, exercise, today]),
    history: createMemoryHistory({ initialEntries: ['/session'] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1 })
  return router
}

let counter = 0
function attemptOn(scaleId: string): Attempt {
  counter += 1
  return {
    id: `attempt-${counter}`,
    scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode: 'practice',
    text: '',
    seed: counter,
    startedAt: counter * 1000,
    completedAt: counter * 1000 + 500,
    elapsedMs: 500,
    metrics: {
      spm: 150,
      wpm: 30,
      accuracy: 0.98,
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

function runningSession() {
  const { session } = useSessionStore.getState()
  if (session.status !== 'running') throw new Error('session is not running')
  return session
}

/** Records one finished attempt on the scale the current block uses, then returns to /session. */
async function finishOneAttempt(router: Awaited<ReturnType<typeof mount>>) {
  const session = runningSession()
  const scaleId = session.plan.blocks[0]?.scaleId ?? ''
  await act(async () => {
    await useAppStore.getState().finishAttempt(attemptOn(scaleId))
    await router.navigate({ to: '/session' })
  })
}

beforeEach(() => {
  setProgressStore(memoryStore())
  useAppStore.setState({ ...initialState, status: 'ready', startingLevelChoice: 'neverTouchTyped' })
  useSessionStore.setState({ session: idleSession })
})

describe('SessionScreen', () => {
  it('states the expected length, between 15 and 25 minutes, before any block starts', async () => {
    await mount()
    const stated = screen.getByTestId('expected-length')
    const minutes = Number(/\d+/.exec(stated.textContent ?? '')?.[0])
    expect(minutes).toBeGreaterThanOrEqual(15)
    expect(minutes).toBeLessThanOrEqual(25)
    expect(screen.queryByTestId('exercise-stub')).not.toBeInTheDocument()
    expect(useSessionStore.getState().session.status).toBe('idle')
  })

  it('names all four blocks up front, the fourth as arriving later', async () => {
    await mount()
    for (const name of [
      m.session_block_warmUp(),
      m.session_block_target(),
      m.session_block_consolidation(),
      m.session_block_realText(),
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(m.session_block_realText_body())).toBeInTheDocument()
  })

  it('falls back to the target skill for the warm-up when there is no earlier session', async () => {
    await mount()
    expect(screen.getByText(m.session_block_warmUp_fallback())).toBeInTheDocument()
  })

  it('explains itself instead of failing when no starting level was chosen', async () => {
    useAppStore.setState({ startingLevelChoice: null })
    await mount()
    expect(screen.getByText(m.session_needs_level())).toBeInTheDocument()
  })

  it('runs the exercise screen through the router, then shows between-blocks exactly twice', async () => {
    const router = await mount()
    await userEvent.click(screen.getByRole('button', { name: m.session_start() }))
    expect(await screen.findByTestId('exercise-stub')).toBeInTheDocument()

    const plan = runningSession().plan
    const total = plan.blocks.reduce((sum, block) => sum + block.reps, 0)
    let betweenSeen = 0

    for (let done = 1; done <= total; done += 1) {
      await finishOneAttempt(router)
      const between = screen.queryByTestId('between-blocks')
      if (between !== null) {
        betweenSeen += 1
        expect(between).toHaveTextContent(m.session_between_title())
        await userEvent.click(screen.getByRole('button', { name: m.session_between_continue() }))
        expect(await screen.findByTestId('exercise-stub')).toBeInTheDocument()
        await act(() => router.navigate({ to: '/session' }))
      }
    }

    expect(betweenSeen).toBe(2)
    expect(screen.getByTestId('real-text-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('between-blocks')).not.toBeInTheDocument()
  })

  it('names real text as arriving with the word curriculum and shows no pseudo-words', async () => {
    const router = await mount()
    await userEvent.click(screen.getByRole('button', { name: m.session_start() }))
    const total = runningSession().plan.blocks.reduce((sum, block) => sum + block.reps, 0)
    for (let done = 0; done < total; done += 1) {
      await finishOneAttempt(router)
      const next = screen.queryByRole('button', { name: m.session_between_continue() })
      if (next !== null) await userEvent.click(next)
      await act(() => router.navigate({ to: '/session' }))
    }

    const pending = screen.getByTestId('real-text-pending')
    expect(pending).toHaveTextContent(m.session_realtext_body())
    expect(pending).toHaveTextContent('F3')
    // Every character on the panel belongs to a message: nothing generated is hiding in it.
    const authored = [
      m.session_realtext_title(),
      m.session_realtext_body(),
      m.session_realtext_mechanics(),
      m.session_realtext_mechanics_note(),
      m.session_realtext_finish(),
    ].join('')
    expect(pending.textContent).toBe(authored)
    expect(pending.querySelector('[data-typing-line]')).toBeNull()
  })

  it('keeps finished attempts when the learner abandons mid-block', async () => {
    const router = await mount()
    await userEvent.click(screen.getByRole('button', { name: m.session_start() }))
    await finishOneAttempt(router)
    const before = useAppStore.getState().attempts.length
    expect(before).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: m.session_abandon() }))
    expect(useSessionStore.getState().session.status).toBe('idle')
    expect(useAppStore.getState().attempts).toHaveLength(before)
    expect(screen.getByRole('button', { name: m.session_start() })).toBeInTheDocument()
  })

  it('counts only attempts recorded after the session began', async () => {
    await useAppStore.getState().finishAttempt(attemptOn('yq.run.anchors'))
    await mount()
    await userEvent.click(screen.getByRole('button', { name: m.session_start() }))
    const session = runningSession()
    expect(sessionAttempts(session, useAppStore.getState().attempts)).toHaveLength(0)
  })
})
