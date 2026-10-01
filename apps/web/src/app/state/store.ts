import type { Attempt, Language, Settings, StartingLevelChoice } from '@typing-race/domain'
import { useMemo } from 'react'
import { create } from 'zustand'
import type { OutboxStore, ProgressStore } from '../../seams/index.js'
import { indexedDbOutbox, indexedDbStore, memoryOutbox } from '../../seams/index.js'
import { createSync, type Sync, setAppSync } from '../../sync/index.js'
import { missingFrom } from '../../sync/policy.js'
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
  /** Re-reads local storage after sync changed it; an emptied store resets the learner. */
  readonly reload: () => Promise<void>
  readonly chooseStartingLevel: (choice: StartingLevelChoice) => Promise<void>
  /**
   * The starting level recorded for each typing language. The state keeps only the current
   * language's answer; start over needs both, so it may offer each language's forward-only floor.
   */
  readonly recordedStartingLevels: () => Promise<
    Readonly<Partial<Record<Language, StartingLevelChoice>>>
  >
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
let sync: Sync = makeSync(progressStore, indexedDbOutbox())

/**
 * The sync engine over the same store. Every finished attempt goes through it, so it is queued in
 * the outbox whether or not anyone is signed in (ADR-0006); it leaves the browser only once
 * `startSync` connects an account.
 */
function makeSync(store: ProgressStore, outbox: OutboxStore): Sync {
  const created = createSync({
    store,
    outbox,
    // A pull, cloud settings or a wipe changed the store underneath us: re-read it, and derived
    // state (progress, Level, XP, Streak) recomputes through the normal path.
    onLocalChanged: () => void useAppStore.getState().reload(),
  })
  setAppSync(created)
  return created
}

export function setProgressStore(store: ProgressStore, outbox: OutboxStore = memoryOutbox()): void {
  sync.disconnect()
  progressStore = store
  sync = makeSync(store, outbox)
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

  async reload() {
    const loaded = await progressStore.load()
    if (loaded === 'empty') {
      get().dispatch({ type: 'store/reset' })
      return
    }
    if (typeof loaded === 'string') return
    // An attempt finished while the read was in flight is in memory but maybe not yet on disk;
    // a reload must not make it vanish from the screen.
    const unsaved = missingFrom(loaded.attempts, get().attempts)
    const attempts =
      unsaved.length === 0
        ? loaded.attempts
        : [...loaded.attempts, ...unsaved].sort((x, y) => x.completedAt - y.completedAt)
    get().dispatch({ type: 'store/loaded', envelope: { ...loaded, attempts } })
  },

  async chooseStartingLevel(choice) {
    get().dispatch({ type: 'startingLevel/chosen', choice })
    // Persisted through the seam, which applies FR-073's forward-only rule and then reports what
    // it actually kept — so a backwards answer is corrected in one place rather than guarded in
    // every screen that offers the question.
    await progressStore.saveStartingLevel(get().settings.typingLanguage, choice)
    const stored = await progressStore.load()
    if (typeof stored === 'string') return
    const kept = stored.startingLevelByLanguage[get().settings.typingLanguage]
    if (kept !== undefined && kept !== get().startingLevelChoice) {
      get().dispatch({ type: 'startingLevel/chosen', choice: kept })
    }
  },

  async recordedStartingLevels() {
    const stored = await progressStore.load()
    const recorded: Partial<Record<Language, StartingLevelChoice>> =
      typeof stored === 'string' ? {} : { ...stored.startingLevelByLanguage }
    // The in-memory answer counts too: it may not have reached storage (FR-052), or it may have
    // come from the attempt-count fallback of an older envelope.
    const { startingLevelChoice, settings } = get()
    if (startingLevelChoice !== null && recorded[settings.typingLanguage] === undefined) {
      recorded[settings.typingLanguage] = startingLevelChoice
    }
    return recorded
  },

  async changeSettings(patch) {
    // Applied first, persisted second: a setting must take effect immediately (FR-049), and a
    // storage failure must not stop the learner changing the theme.
    get().dispatch({ type: 'settings/changed', patch })
    await progressStore.saveSettings(get().settings)
    await sync.settingsChanged()
  },

  beginAttempt() {
    get().dispatch({ type: 'attempt/started' })
  },

  async finishAttempt(attempt) {
    get().dispatch({ type: 'attempt/finished', attempt })
    await sync.submitAttempt(attempt)
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
