import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalogue, layouts } from '@typing-race/curriculum'
import type { AttemptMetrics, AttemptSummary, MotionSetting } from '@typing-race/domain'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, setProgressStore, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { memoryStore } from '../../seams/index.js'
import { duration, number, signed } from './format.js'
import { fingerName, fingerOfChar } from './model.js'
import { ResultScreen } from './ResultScreen.js'

// The factory body runs when the module is first imported, so `imports` counts fetches. The
// "motion off" test runs before any test that turns celebration on, which is what lets it assert
// the chunk was never requested rather than merely that nothing was drawn.
const confetti = vi.hoisted(() => ({ imports: 0, burst: vi.fn() }))
vi.mock('canvas-confetti', () => {
  confetti.imports += 1
  return { default: confetti.burst }
})

const layout = layouts.yq
const scales = catalogue.yq
const FIRST_KEY = layout.unlockOrder[0] ?? ''
const unlockScale = scales.find((s) => s.focus.kind === 'key' && s.focus.value === FIRST_KEY)
if (unlockScale === undefined) throw new Error('the first unlockable key has no scale')

let clock = 0

function metrics(patch: Partial<AttemptMetrics> = {}): AttemptMetrics {
  return {
    spm: 240,
    wpm: 48,
    accuracy: 0.98,
    errorCount: 0,
    errorsByChar: {},
    rhythmConsistency: { value: 88, breaksExcluded: 0 },
    meanIkiByKey: {},
    meanIkiByTransition: {},
    ...patch,
  }
}

function attempt(id: string, patch: Partial<AttemptSummary> = {}): AttemptSummary {
  clock += 1000
  return {
    id,
    scaleId: unlockScale?.id ?? '',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: clock - 500,
    completedAt: clock,
    elapsedMs: 18400,
    metrics: metrics(),
    aggregates: { keys: {}, transitions: {} },
    ...patch,
  }
}

/** Seeds the app store through the real `memoryStore` seam, as a learner's restart would. */
async function seed(attempts: AttemptSummary[], motion: MotionSetting = 'off') {
  setProgressStore(
    memoryStore({ attempts, settings: { ...DEFAULT_SETTINGS, motion } }, { now: () => 1 }),
  )
  await useAppStore.getState().boot()
}

/** A real router, so the screen's `useParams` and its button's `navigate` are exercised as shipped. */
async function show(attemptId: string) {
  const root = createRootRoute()
  const result = createRoute({
    getParentRoute: () => root,
    path: '/result/$attemptId',
    component: ResultScreen,
  })
  const exercise = createRoute({
    getParentRoute: () => root,
    path: '/exercise/$scaleId',
    component: () => <p>exercise screen</p>,
  })
  const today = createRoute({
    getParentRoute: () => root,
    path: '/today',
    component: () => <p>today screen</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([result, exercise, today]),
    history: createMemoryHistory({ initialEntries: [`/result/${attemptId}`] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1 })
}

const region = (name: string) => screen.getByRole('region', { name })

describe('ResultScreen', () => {
  it('shows every metric the requirements list (FR-023, FR-025, FR-026)', async () => {
    await seed([
      attempt('a1', {
        metrics: metrics({
          spm: 312.4,
          wpm: 62.48,
          accuracy: 0.9667,
          errorCount: 3,
          errorsByChar: { а: 2, о: 1 },
          rhythmConsistency: { value: 81.3, breaksExcluded: 2 },
          meanIkiByKey: { а: 180, о: 260 },
          meanIkiByTransition: { 'а>о': 420, 'о>а': 200 },
        }),
      }),
    ])
    await show('a1')

    const tiles = region(m.result_tiles_label())
    expect(tiles).toHaveTextContent(m.result_tile_spm())
    expect(tiles).toHaveTextContent(number(312))
    expect(tiles).toHaveTextContent(`${number(96.7, 1)} %`)
    expect(tiles).toHaveTextContent(duration(18400))

    const all = within(region(m.result_metrics_heading()))
    for (const label of [
      m.result_tile_spm(),
      m.result_metric_wpm(),
      m.result_tile_accuracy(),
      m.result_tile_errors(),
      m.result_tile_time(),
      m.result_metric_rhythm(),
    ]) {
      expect(all.getAllByText(label, { exact: false }).length).toBeGreaterThan(0)
    }
    expect(all.getByText(number(312.4, 1))).toBeInTheDocument()
    expect(all.getByText(number(62.5, 1))).toBeInTheDocument()
    expect(all.getByText(number(81.3, 1))).toBeInTheDocument()

    // Mean interval per key and per Transition, each in its own named table.
    const perKey = all.getByRole('table', { name: m.result_iki_key_heading() })
    expect(perKey).toHaveTextContent(m.result_ms({ ms: '260' }))
    const perTransition = all.getByRole('table', { name: m.result_iki_transition_heading() })
    expect(perTransition).toHaveTextContent('а → о')
    expect(perTransition).toHaveTextContent(m.result_ms({ ms: '420' }))

    // Errors by character, with their weight.
    const errors = within(region(m.result_errors_heading()))
    expect(errors.getByText('а')).toBeInTheDocument()
    expect(errors.getByText(m.result_errors_item({ count: 2, share: '67' }))).toBeInTheDocument()
  })

  it('shows breaksExcluded, so a smooth figure cannot hide what it left out', async () => {
    await seed([
      attempt('a1', { metrics: metrics({ rhythmConsistency: { value: 95, breaksExcluded: 4 } }) }),
    ])
    await show('a1')
    expect(screen.getByTestId('breaks-excluded')).toHaveTextContent(
      m.result_metric_breaks({ count: 4 }),
    )
  })

  it('states that nothing was left out when nothing was (the zero case is still shown)', async () => {
    await seed([attempt('a1')])
    await show('a1')
    expect(screen.getByTestId('breaks-excluded')).toHaveTextContent(m.result_metric_breaks_none())
  })

  it('counts a corrected error: one wrong key fixed by Backspace still reads as 1 (FR-024)', async () => {
    // 20 correct character keystrokes and 1 wrong one the learner fixed: 21 in the denominator.
    await seed([
      attempt('a1', {
        metrics: metrics({ accuracy: 20 / 21, errorCount: 1, errorsByChar: { а: 1 } }),
      }),
    ])
    await show('a1')

    const tiles = within(region(m.result_tiles_label()))
    expect(tiles.getByText(m.result_tile_errors()).closest('div')).toHaveTextContent('1')
    expect(tiles.getByText('1')).toBeInTheDocument()
    expect(tiles.queryByText('0')).not.toBeInTheDocument()
    expect(tiles.getByText(`${number(95.2, 1)} %`)).toBeInTheDocument()
    expect(screen.getByText(m.result_metric_accuracy_note())).toBeInTheDocument()
    expect(
      within(region(m.result_metrics_heading())).getByText(m.result_tile_errors()).closest('div'),
    ).toHaveTextContent('1')
  })

  it('renders exactly one Next Action, with exactly one button that starts it (FR-031)', async () => {
    await seed([attempt('a1')])
    await show('a1')

    expect(screen.getAllByRole('region', { name: m.result_next_heading() })).toHaveLength(1)
    const next = within(region(m.result_next_heading()))
    expect(next.getAllByRole('button')).toHaveLength(1)
    // No unlock card on a first attempt, so the page as a whole carries that one button and no other.
    expect(screen.getAllByRole('button')).toHaveLength(1)

    await userEvent.click(next.getByRole('button', { name: m.result_next_start() }))
    expect(await screen.findByText('exercise screen')).toBeInTheDocument()
  })

  it('below the floor, the one action names a lower tempo and nothing else (scenario 4)', async () => {
    await seed([attempt('a1', { metrics: metrics({ accuracy: 0.9, spm: 300 }) })])
    await show('a1')
    const next = region(m.result_next_heading())
    expect(next).toHaveTextContent('90%')
    expect(next).toHaveTextContent('95%')
    // 80% of the speed just typed, rounded to 5: a named speed, not "slow down".
    expect(next).toHaveTextContent('240 SPM')
    expect(within(next).getAllByRole('button')).toHaveLength(1)
    expect(next.querySelectorAll('p')).toHaveLength(1)
  })

  it('offers the next key when accuracy and rhythm are fine (scenario 6)', async () => {
    await seed([attempt('a1')])
    await show('a1')
    expect(region(m.result_next_heading()).querySelector('[data-rule]')).toHaveAttribute(
      'data-rule',
      'nextKey',
    )
  })

  it('names the previous best and the difference, or says there is none (FR-027)', async () => {
    await seed([
      attempt('old', { metrics: metrics({ spm: 200, accuracy: 0.95 }) }),
      attempt('new', { metrics: metrics({ spm: 230, accuracy: 0.97 }) }),
    ])
    await show('new')
    const comparison = region(m.result_comparison_heading())
    expect(comparison).toHaveTextContent(
      m.result_compare_previous({ spm: number(200, 1), accuracy: number(95, 1) }),
    )
    expect(comparison).toHaveTextContent(signed(30, 1))
  })

  it('says there is nothing to compare on the first attempt', async () => {
    await seed([attempt('a1')])
    await show('a1')
    expect(region(m.result_comparison_heading())).toHaveTextContent(m.result_compare_none())
  })

  it('draws intervals over 400 ms distinctly and says so in words (scenario 9)', async () => {
    await seed([
      attempt('a1', {
        metrics: metrics({ meanIkiByTransition: { 'а>о': 520, 'о>а': 210, 'а>в': 180 } }),
      }),
    ])
    await show('a1')
    const chart = region(m.result_chart_heading())
    expect(within(chart).getByRole('img')).toHaveAccessibleName(
      new RegExp(m.result_chart_summary({ slow: 1, total: 3 }).replace('.', '\\.')),
    )
    expect(within(chart).getByTestId('chart-summary')).toHaveTextContent(
      m.result_chart_summary({ slow: 1, total: 3 }),
    )
    // The slow bar is hatched through a pattern fill, the others are plain.
    const fills = [...chart.querySelectorAll('rect.result-bar')].map((r) => r.getAttribute('fill'))
    expect(fills.filter((f) => f?.startsWith('url(#'))).toHaveLength(1)
  })

  it('says keystroke detail is no longer kept once the log has been pruned (T105)', async () => {
    const many = Array.from({ length: 22 }, (_, i) => attempt(`p${i}`))
    await seed(many)
    await show('p0')
    expect(screen.getByTestId('pruned-note')).toHaveTextContent(m.result_pruned_note())
    // The figures are still there, from the aggregates.
    expect(region(m.result_metrics_heading())).toBeInTheDocument()
  })

  it('is honest about a result that does not exist', async () => {
    await seed([attempt('a1')])
    await show('nope')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.result_not_found_title())
  })
})

describe('Key Unlock card (FR-041)', () => {
  it('appears on the third consecutive passing test attempt', async () => {
    await seed([attempt('t1'), attempt('t2'), attempt('t3')])
    await show('t3')

    const card = within(region(m.result_unlock_heading()))
    expect(card.getByText(m.result_unlock_key({ key: FIRST_KEY }))).toBeInTheDocument()
    expect(
      card.getByText(
        m.result_unlock_finger({ finger: fingerName(fingerOfChar(layout, FIRST_KEY)) }),
      ),
    ).toBeInTheDocument()
    expect(card.getAllByRole('button')).toHaveLength(1)
    expect(card.getByRole('button', { name: m.result_unlock_start() })).toBeInTheDocument()
    // The Next Action is still exactly one, beside the card rather than replaced by it.
    expect(screen.getAllByRole('region', { name: m.result_next_heading() })).toHaveLength(1)
  })

  it('does not appear one attempt short of the threshold', async () => {
    await seed([attempt('t1'), attempt('t2')])
    await show('t2')
    expect(screen.queryByRole('region', { name: m.result_unlock_heading() })).toBeNull()
  })

  it('does not appear when the third attempt is below the floor', async () => {
    await seed([
      attempt('t1'),
      attempt('t2'),
      attempt('t3', { metrics: metrics({ accuracy: 0.9 }) }),
    ])
    await show('t3')
    expect(screen.queryByRole('region', { name: m.result_unlock_heading() })).toBeNull()
  })

  it('does not appear for practice attempts, which never count toward mastery', async () => {
    await seed([attempt('t1'), attempt('t2'), attempt('t3', { mode: 'practice' })])
    await show('t3')
    expect(screen.queryByRole('region', { name: m.result_unlock_heading() })).toBeNull()
  })

  it('does not show on the attempt after the unlock, which unlocked nothing', async () => {
    await seed([attempt('t1'), attempt('t2'), attempt('t3'), attempt('t4')])
    await show('t4')
    expect(screen.queryByRole('region', { name: m.result_unlock_heading() })).toBeNull()
  })

  it('never fetches the confetti chunk with motion off, and bursts once with motion on', async () => {
    await seed([attempt('t1'), attempt('t2'), attempt('t3')], 'off')
    await show('t3')
    await screen.findByRole('region', { name: m.result_unlock_heading() })
    expect(confetti.imports).toBe(0)
    expect(confetti.burst).not.toHaveBeenCalled()

    document.body.innerHTML = ''
    await seed([attempt('u1'), attempt('u2'), attempt('u3')], 'system')
    await show('u3')
    await waitFor(() => {
      expect(confetti.burst).toHaveBeenCalledTimes(1)
    })
    expect(confetti.imports).toBe(1)
  })
})
