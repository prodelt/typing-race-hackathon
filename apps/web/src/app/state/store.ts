import type { Attempt, Settings, StartingLevelChoice } from '@typing-race/domain'
import { useMemo } from 'react'
import { create } from 'zustand'
import type { ProgressStore } from '../../seams/index.js'
import { indexedDbStore } from '../../seams/index.js'
import { type DerivedState, derive } from './derive.js'
import { type AppAction, type AppState, initialState, reduce } from './reduce.js'

/**
 * T064. Zustand over the hand-written reducer, wired to the `ProgressStore` seam.
 *
 * The store owns three things and nothing else: the reduced state, the effects that talk to the
 * seam, and the derivation. Screens read selectors; they never see the seam and never write state
 * directly, which is what keeps the reducer the only place a transition can happen.
 */

export interface AppStore extends AppState {
  readonly dispatch: (action: AppAction) => void
  /** Reads local storage and resolves the four outcomes — FR-052, FR-083. */
  readonly boot: () => Promise<void>
  readonly chooseStartingLevel: (choice: StartingLevelChoice) => void
  readonly changeSettings: (patch: Partial<Settings>) => Promise<void>
  readonly beginAttempt: () => void
  readonly finishAttempt: (attempt: Attempt) => Promise<void>
  readonly abandonAttempt: () => void
  /** FR-083's deliberate fresh start, chosen by the learner and never by us. */
  readonly startFresh: () => Promise<void>
}

/**
 * Swappable so tests and Playwright fixtures seed a learner with `memoryStore(seed)` instead of
 * typing their way to one. It is module state rather than a React context because the engine path
 * lives outside React (ADR-0003) and must reach it too.
 */
let progressStore: ProgressStore = indexedDbStore()

export function setProgressStore(store: ProgressStore): void {
  progressStore = store
}

export const useAppStore = create<AppStore>()((set, get) => ({
  ...initialState,

  dispatch(action) {
    set((state) => reduce(state, action))
  },

  async boot() {
    const loaded = await progressStore.load()
    const { dispatch } = get()
    if (loaded === 'empty') dispatch({ type: 'store/empty' })
    else if (loaded === 'unreadable-version') dispatch({ type: 'store/unreadableVersion' })
    else if (loaded === 'unavailable') dispatch({ type: 'store/unavailable' })
    else dispatch({ type: 'store/loaded', envelope: loaded })
  },

  chooseStartingLevel(choice) {
    get().dispatch({ type: 'startingLevel/chosen', choice })
  },

  async changeSettings(patch) {
    // Applied first, persisted second: a setting must take effect immediately (FR-049), and a
    // storage failure must not stop the learner changing the theme.
    get().dispatch({ type: 'settings/changed', patch })
    await progressStore.saveSettings(get().settings)
  },

  beginAttempt() {
    get().dispatch({ type: 'attempt/started' })
  },

  async finishAttempt(attempt) {
    get().dispatch({ type: 'attempt/finished', attempt })
    await progressStore.appendAttempts([attempt])
  },

  abandonAttempt() {
    get().dispatch({ type: 'attempt/abandoned' })
  },

  async startFresh() {
    await progressStore.clear()
    get().dispatch({ type: 'store/reset' })
  },
}))

/**
 * Derivation on read rather than stored state (FR-050).
 *
 * The three fields below are the fold's entire input, so they are the memo's entire dependency
 * list. Selecting them separately matters: a selector returning `derive(state)` would build a new
 * object on every store read, and Zustand 5 compares snapshots by reference — that is an infinite
 * render loop, not a performance note.
 */
export function useDerived(): DerivedState {
  const attempts = useAppStore((state) => state.attempts)
  const settings = useAppStore((state) => state.settings)
  const startingLevelChoice = useAppStore((state) => state.startingLevelChoice)

  return useMemo(
    () => derive({ ...initialState, attempts, settings, startingLevelChoice }),
    [attempts, settings, startingLevelChoice],
  )
}
