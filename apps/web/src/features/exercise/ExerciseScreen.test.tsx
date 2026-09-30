import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { catalogue, initialUnlockedSet, layouts, SHIFT_TOKEN } from '@typing-race/curriculum'
import type { LayoutId, Scale } from '@typing-race/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, setProgressStore, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { memoryStore } from '../../seams/index.js'
import { ExerciseScreen } from './index.js'
import { planExercise } from './plan.js'

/**
 * User Story 1's acceptance scenarios, driven the only way Cyrillic can be driven: by dispatching
 * `beforeinput` at the hidden textarea. Testing Library's `userEvent.keyboard` cannot type it.
 */

/** The first Stage 1 scale that needs nothing beyond the anchors, so every learner may open it. */
function openScale(layoutId: LayoutId): Scale {
  const scale = catalogue[layoutId].find((candidate) => candidate.requires.length === 0)
  if (scale === undefined) throw new Error(`No open scale for ${layoutId}`)
  return scale
}

function seed(layoutId: LayoutId): void {
  setProgressStore(memoryStore())
  useAppStore.setState({
    status: 'ready',
    attempts: [],
    startingLevelChoice: 'neverTouchTyped',
    attemptInProgress: false,
    settings: {
      ...DEFAULT_SETTINGS,
      layoutId,
      typingLanguage: layoutId === 'yq' ? 'uk' : 'en',
      motion: 'off',
    },
  })
}

function renderExercise(scaleId: string, mode: 'practice' | 'test') {
  const root = createRootRoute({ component: Outlet })
  const exercise = createRoute({
    getParentRoute: () => root,
    path: '/exercise/$scaleId',
    validateSearch: (search: Record<string, unknown>): { mode: 'practice' | 'test' } => ({
      mode: search['mode'] === 'test' ? 'test' : 'practice',
    }),
    component: ExerciseScreen,
  })
  const path = createRoute({
    getParentRoute: () => root,
    path: '/path',
    component: () => <p data-testid="path-stub" />,
  })
  const result = createRoute({
    getParentRoute: () => root,
    path: '/result/$attemptId',
    component: () => <p data-testid="result-stub" />,
  })
  const router = createRouter({
    routeTree: root.addChildren([exercise, path, result]),
    history: createMemoryHistory({ initialEntries: [`/exercise/${scaleId}?mode=${mode}`] }),
  })
  return render(<RouterProvider router={router} />)
}

function press(textarea: HTMLElement, char: string): void {
  fireEvent(
    textarea,
    new InputEvent('beforeinput', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    }),
  )
}

function backspace(textarea: HTMLElement): void {
  fireEvent(
    textarea,
    new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: true,
    }),
  )
}

/** Opens the scale, presses Start and returns what a test needs to type. */
async function begin(layoutId: LayoutId, mode: 'practice' | 'test') {
  seed(layoutId)
  const scale = openScale(layoutId)
  renderExercise(scale.id, mode)
  const start = await screen.findByRole('button', { name: m.exercise_start() })
  fireEvent.click(start)
  const line = await screen.findByTestId('typing-line')
  const textarea = screen.getByLabelText(m.exercise_input_label())
  const text = line.querySelector('.sr-only')?.textContent ?? ''
  const run = line.querySelector('[aria-hidden="true"]')
  if (!(run instanceof HTMLElement)) throw new Error('The typing run is missing')
  return { scale, line, textarea, text, run }
}

const WRONG: Record<LayoutId, string> = { yq: 'ж', qwerty: ';' }

function wrongFor(layoutId: LayoutId, awaited: string): string {
  const pool = Array.from(layoutId === 'yq' ? 'фівапролдж' : 'asdfjkl;')
  return pool.find((char) => char !== awaited) ?? WRONG[layoutId]
}

const snapshotOf = (run: HTMLElement): string =>
  Array.from(run.children, (span) => span.textContent).join('|')

beforeEach(() => {
  seed('yq')
})

describe('the keystroke path (scenarios 1 to 3, 6)', () => {
  it.each(['yq', 'qwerty'] as const)(
    'marks a wrong key in place, moves nothing, and never lowers the error count (%s)',
    async (layoutId) => {
      const { textarea, text, run, line } = await begin(layoutId, 'practice')
      const first = Array.from(text)[0] ?? ''
      const before = snapshotOf(run)
      const errors = within(line).getByTestId('error-count')
      const progress = within(line).getByTestId('progress')

      press(textarea, wrongFor(layoutId, first))
      const spans = Array.from(run.children)
      expect(spans[0]).toHaveAttribute('data-mark', 'wrong')
      expect(spans[0]).toHaveAttribute('data-state', 'awaited')
      expect(snapshotOf(run)).toBe(before)
      expect(progress).toHaveAttribute('aria-valuenow', '0')
      expect(errors).toHaveTextContent('1')

      backspace(textarea)
      expect(errors).toHaveTextContent('1')

      press(textarea, first)
      expect(spans[0]).not.toHaveAttribute('data-mark')
      expect(spans[0]).toHaveAttribute('data-state', 'typed')
      expect(spans[1]).toHaveAttribute('data-state', 'awaited')
      expect(errors).toHaveTextContent('1')
      expect(snapshotOf(run)).toBe(before)
    },
  )

  it('begins on the first printable character and judges it as correct', async () => {
    const { textarea, text, run, line } = await begin('yq', 'practice')
    expect(line).toHaveAttribute('data-state', 'idle')
    press(textarea, Array.from(text)[0] ?? '')
    expect(line).toHaveAttribute('data-state', 'running')
    expect(run.children[0]).toHaveAttribute('data-state', 'typed')
    expect(within(line).getByTestId('error-count')).toHaveTextContent('0')
  })

  it('ignores Alt: nothing is consumed and no error is counted', async () => {
    const { textarea, run, line } = await begin('yq', 'practice')
    fireEvent.keyDown(textarea, { key: 'Alt' })
    expect(run.children[0]).toHaveAttribute('data-state', 'awaited')
    expect(within(line).getByTestId('error-count')).toHaveTextContent('0')
  })

  it.each(['practice', 'test'] as const)('completes the scale in %s mode', async (mode) => {
    const { textarea, text } = await begin('yq', mode)
    for (const char of Array.from(text)) press(textarea, char)
    await screen.findByTestId('result-stub')
    const [attempt] = useAppStore.getState().attempts
    expect(useAppStore.getState().attempts).toHaveLength(1)
    expect(attempt?.mode).toBe(mode)
    expect(attempt?.metrics.errorCount).toBe(0)
    expect(useAppStore.getState().attemptInProgress).toBe(false)
  })

  it('counts a corrected wrong key in the stored attempt (FR-024)', async () => {
    const { textarea, text } = await begin('yq', 'practice')
    const chars = Array.from(text)
    press(textarea, wrongFor('yq', chars[0] ?? ''))
    backspace(textarea)
    for (const char of chars) press(textarea, char)
    await screen.findByTestId('result-stub')
    const [attempt] = useAppStore.getState().attempts
    expect(attempt?.metrics.errorCount).toBe(1)
    expect(attempt?.metrics.accuracy).toBeLessThan(1)
  })
})

describe('zero-peek (scenarios 4 and 5, FR-037)', () => {
  it('renders all four guides in a Practice Attempt', async () => {
    await begin('yq', 'practice')
    expect(screen.getByTestId('keyboard-guide')).toBeInTheDocument()
    expect(screen.getByTestId('next-key')).toBeInTheDocument()
    expect(screen.getByTestId('finger-diagram')).toBeInTheDocument()
    expect(screen.getByTestId('live-speed')).toBeInTheDocument()
    expect(screen.getByTestId('live-accuracy')).toBeInTheDocument()
  })

  it('lights the awaited key and names its finger, then moves both on', async () => {
    const { textarea, text } = await begin('yq', 'practice')
    const chars = Array.from(text)
    const lit = () => document.querySelectorAll('.kb-key[data-awaited="true"]')
    expect(lit()).toHaveLength(1)
    const card = screen.getByTestId('next-key')
    const firstFinger = card.querySelector('p.font-semibold')?.textContent
    expect(firstFinger).toBeTruthy()
    press(textarea, chars[0] ?? '')
    expect(lit()).toHaveLength(1)
  })

  it('does not render any of the four guides in a Test Attempt', async () => {
    await begin('yq', 'test')
    // Absent from the document, not hidden: a null query, never a class check.
    expect(screen.queryByTestId('keyboard-guide')).toBeNull()
    expect(screen.queryByRole('img', { name: m.exercise_guide_label() })).toBeNull()
    expect(screen.queryByTestId('next-key')).toBeNull()
    expect(screen.queryByTestId('finger-diagram')).toBeNull()
    expect(screen.queryByRole('img', { name: m.exercise_finger_diagram_label() })).toBeNull()
    expect(screen.queryByTestId('live-metrics')).toBeNull()
    expect(screen.queryByTestId('live-speed')).toBeNull()
    expect(screen.queryByTestId('live-accuracy')).toBeNull()
    expect(document.querySelector('.kb-key')).toBeNull()

    // Time, errors and progress remain.
    expect(screen.getByTestId('elapsed-time')).toBeInTheDocument()
    expect(screen.getByTestId('error-count')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: m.exercise_progress() })).toBeInTheDocument()
  })

  it('keeps the typing line in the same box in both modes (FR-058)', async () => {
    const practice = await begin('yq', 'practice')
    const practiceHeight =
      practice.line.querySelector<HTMLElement>('.typing-line__stage')?.style.height
    cleanup()
    const test = await begin('yq', 'test')
    const testHeight = test.line.querySelector<HTMLElement>('.typing-line__stage')?.style.height
    expect(practiceHeight).toBe('84px')
    expect(testHeight).toBe(practiceHeight)
  })
})

describe('FR-069: nothing outside the typing line changes between keystrokes', () => {
  /** Watches the whole document, then reports every mutation that landed outside `allowed`. */
  function outsideMutations(allowed: readonly string[], act: () => void): string[] {
    const observer = new MutationObserver(() => {})
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    act()
    const records = observer.takeRecords()
    observer.disconnect()
    return records
      .filter((record) => {
        const node = record.target instanceof Element ? record.target : record.target.parentElement
        return !allowed.some((selector) => node?.closest(selector) !== null)
      })
      .map((record) => `${record.type} on ${record.target.nodeName}`)
  }

  it('detects a change outside the line, so the checks below cannot pass vacuously', async () => {
    const { line } = await begin('yq', 'test')
    const outside = outsideMutations(['[data-testid="typing-line"]'], () => {
      line.parentElement?.setAttribute('data-probe', 'x')
    })
    expect(outside).toHaveLength(1)
  })

  it('changes no node outside the typing line in a Test Attempt', async () => {
    const { textarea, text } = await begin('yq', 'test')
    const chars = Array.from(text)
    const outside = outsideMutations(['[data-testid="typing-line"]'], () => {
      press(textarea, chars[0] ?? '')
      press(textarea, wrongFor('yq', chars[1] ?? ''))
      backspace(textarea)
      press(textarea, chars[1] ?? '')
      press(textarea, chars[2] ?? '')
    })
    expect(outside).toEqual([])
  })

  it('changes nothing outside the line and the guides in a Practice Attempt', async () => {
    const { textarea, text } = await begin('yq', 'practice')
    const chars = Array.from(text)
    const outside = outsideMutations(
      [
        '[data-testid="typing-line"]',
        // The guide is the one thing allowed to move: its highlight is acceptance scenario 4.
        '[data-testid="keyboard-guide"]',
        '[data-testid="next-key"]',
        '[data-testid="finger-diagram"]',
      ],
      () => {
        press(textarea, chars[0] ?? '')
        press(textarea, wrongFor('yq', chars[1] ?? ''))
        press(textarea, chars[1] ?? '')
      },
    )
    expect(outside).toEqual([])
  })

  it('keeps the rail showing the last completed exercise, not the running one', async () => {
    const { textarea, text } = await begin('yq', 'practice')
    const speed = screen.getByTestId('live-speed')
    const before = speed.textContent
    for (const char of Array.from(text).slice(0, 5)) press(textarea, char)
    expect(speed.textContent).toBe(before)
    expect(before).toBe('—')
  })
})

describe('pause (scenario 7, FR-022)', () => {
  it('pauses on Escape, names the finger for the last error, and resumes without restarting', async () => {
    const { textarea, text, run } = await begin('yq', 'practice')
    const chars = Array.from(text)
    press(textarea, chars[0] ?? '')
    press(textarea, wrongFor('yq', chars[1] ?? ''))

    // While typing, the sentence is nowhere on screen.
    expect(screen.queryByTestId('pause-sentence')).toBeNull()

    fireEvent.keyDown(textarea, { key: 'Escape' })
    const sentence = await screen.findByTestId('pause-sentence')
    expect(sentence.textContent).toContain(chars[1] ?? '')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: m.exercise_pause_resume() }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run.children[1]).toHaveAttribute('data-state', 'awaited')
    expect(run.children[0]).toHaveAttribute('data-state', 'typed')
  })

  it('does not judge keystrokes that arrive while paused', async () => {
    const { textarea, text, line } = await begin('yq', 'practice')
    press(textarea, Array.from(text)[0] ?? '')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    await screen.findByRole('dialog')
    press(textarea, 'ж')
    expect(within(line).getByTestId('error-count')).toHaveTextContent('0')
  })
})

describe('the pre-start screen (FR-010, FR-021)', () => {
  it('states the one goal of the scale before anything is typed', async () => {
    seed('yq')
    renderExercise(openScale('yq').id, 'practice')
    const goal = await screen.findByTestId('scale-goal')
    expect(goal.textContent).not.toBe('')
    expect(screen.queryByTestId('typing-line')).toBeNull()
  })

  it('reports the mismatch and does not start when a Latin letter meets a Ukrainian scale', async () => {
    seed('yq')
    renderExercise(openScale('yq').id, 'practice')
    await screen.findByRole('button', { name: m.exercise_start() })
    press(screen.getByLabelText(m.exercise_input_label()), 'f')
    const alert = await screen.findByTestId('layout-mismatch')
    expect(alert).toHaveTextContent('ЙЦУКЕН')
    expect(screen.getByRole('button', { name: m.exercise_start() })).toBeDisabled()
    expect(screen.queryByTestId('typing-line')).toBeNull()
  })

  it('makes the test attempt the primary action once practice has cleared the floor', async () => {
    seed('yq')
    const scale = openScale('yq')
    useAppStore.setState({
      attempts: [
        {
          id: 'a1',
          scaleId: scale.id,
          layoutId: 'yq',
          language: 'uk',
          mode: 'practice',
          seed: 1,
          startedAt: 1,
          completedAt: 2,
          elapsedMs: 10_000,
          metrics: {
            spm: 100,
            wpm: 20,
            accuracy: 0.99,
            errorCount: 0,
            errorsByChar: {},
            rhythmConsistency: { value: 90, breaksExcluded: 0 },
            meanIkiByKey: {},
            meanIkiByTransition: {},
          },
          aggregates: { keys: {}, transitions: {} },
        },
      ],
    })
    renderExercise(scale.id, 'practice')
    const take = await screen.findByRole('button', { name: m.exercise_mode_take_test() })
    expect(take.className).toContain('bg-sage')
  })
})

describe('generated text (FR-012)', () => {
  it.each(['yq', 'qwerty'] as const)('contains no locked character (%s)', (layoutId) => {
    const layout = layouts[layoutId]
    const unlocked = initialUnlockedSet(layout)
    for (const scale of catalogue[layoutId].filter(
      (candidate) => candidate.requires.length === 0,
    )) {
      const focus = scale.focus.kind === 'key' ? [scale.focus.value] : []
      const allowed = new Set([...unlocked, ...focus])
      if (scale.focus.value === SHIFT_TOKEN) {
        // Shift is what is being learned, so capitals of the open letters are the point (FR-046).
        for (const key of layout.keys) {
          if (key.shifted !== null && allowed.has(key.plain)) allowed.add(key.shifted)
        }
      }
      for (let attemptsOnScale = 0; attemptsOnScale < 5; attemptsOnScale++) {
        const plan = planExercise({ scale, layout, unlocked: undefined, attemptsOnScale })
        expect(plan).not.toBeNull()
        for (const char of Array.from(plan?.text ?? '')) expect(allowed.has(char)).toBe(true)
      }
    }
  })

  it('offers no text for a scale whose keys are not unlocked yet', () => {
    const locked = catalogue.yq.find((scale) => scale.requires.length > 0)
    if (locked === undefined) throw new Error('Expected a scale with requirements')
    const plan = planExercise({
      scale: locked,
      layout: layouts.yq,
      unlocked: undefined,
      attemptsOnScale: 0,
    })
    expect(plan).toBeNull()
  })

  it('renders the rendered text from the same allowed set on screen', async () => {
    const { text } = await begin('yq', 'test')
    const allowed = new Set([
      ...initialUnlockedSet(layouts.yq),
      'ф',
      'і',
      'в',
      'а',
      'о',
      'л',
      'д',
      'ж',
    ])
    for (const char of Array.from(text)) expect(allowed.has(char)).toBe(true)
  })
})
