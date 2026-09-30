import type {
  Attempt,
  AttemptSummary,
  Language,
  LayoutId,
  Settings,
  StartingLevelChoice,
  StoredEnvelope,
} from '@typing-race/domain'

/**
 * T064. The hand-written typed reducer behind the Zustand store.
 *
 * Ticket 11 chose Zustand **plus reducers** over XState. The reason shows up here: this file is a
 * pure function of `(state, action)` with no React, no store and no `ProgressStore`, so every
 * transition the app can make is testable by calling it — and the four outcomes of loading a store
 * are four assertions rather than four end-to-end runs.
 *
 * Derived values are deliberately absent. Progress, the level and the Next Action are folds over
 * `attempts`, computed in `derive.ts` and recomputed when the attempt list changes; storing them
 * here would create a second truth that can disagree with the first (FR-050).
 */

/** What the app knows about its own local storage. Each value is a different screen. */
export type BootStatus =
  | 'loading'
  /** Loaded, or nothing to load — practice runs normally. */
  | 'ready'
  /** FR-083: a `storeVersion` we do not recognise. The learner is offered a deliberate fresh start. */
  | 'unreadable-version'
  /** FR-052: the browser cannot keep local data. The learner is told; this visit still runs. */
  | 'unavailable'

export interface AppState {
  readonly status: BootStatus
  readonly settings: Settings
  /** Kept forever, in completion order. Never carries a keystroke log — see `StoredEnvelope`. */
  readonly attempts: readonly AttemptSummary[]
  /**
   * `null` until the learner has answered FR-048's starting-level question. The app shows that
   * choice instead of the practice screens while it is null.
   */
  readonly startingLevelChoice: StartingLevelChoice | null
  /** An attempt is under way. The shell dims its navigation while this is true (FR-057). */
  readonly attemptInProgress: boolean
}

export type AppAction =
  | { readonly type: 'store/loaded'; readonly envelope: StoredEnvelope }
  | { readonly type: 'store/empty' }
  | { readonly type: 'store/unreadableVersion' }
  | { readonly type: 'store/unavailable' }
  | { readonly type: 'settings/changed'; readonly patch: Partial<Settings> }
  | { readonly type: 'startingLevel/chosen'; readonly choice: StartingLevelChoice }
  | { readonly type: 'attempt/started' }
  | { readonly type: 'attempt/finished'; readonly attempt: Attempt }
  | { readonly type: 'attempt/abandoned' }
  | { readonly type: 'store/reset' }

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  motion: 'system',
  sound: 'off',
  textSizePx: 28,
  errorMode: 'stopOnLetter',
  typingLanguage: 'uk',
  layoutId: 'yq',
  interfaceLanguage: 'uk',
}

export const initialState: AppState = {
  status: 'loading',
  settings: DEFAULT_SETTINGS,
  attempts: [],
  startingLevelChoice: null,
  attemptInProgress: false,
}

/** The layout follows the typing language unless the learner has overridden it. */
function layoutForLanguage(language: Language): LayoutId {
  return language === 'uk' ? 'yq' : 'qwerty'
}

function withoutLog(attempt: Attempt): AttemptSummary {
  const { log: _log, text: _text, ...summary } = attempt
  return summary
}

export function reduce(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'store/loaded': {
      const { envelope } = action
      const progress = envelope.progressByLanguage[envelope.settings.typingLanguage]
      return {
        ...state,
        status: 'ready',
        settings: envelope.settings,
        attempts: envelope.attempts,
        // An envelope that already holds attempts implies the question was answered, even if the
        // stored progress snapshot is gone: re-asking a returning learner would be a bug.
        startingLevelChoice:
          progress?.startingLevelChoice ??
          (envelope.attempts.length > 0 ? 'neverTouchTyped' : null),
      }
    }

    case 'store/empty':
      return { ...state, status: 'ready' }

    case 'store/unreadableVersion':
      return { ...state, status: 'unreadable-version' }

    case 'store/unavailable':
      // Practice still runs; only persistence is gone. So the state is usable, not broken.
      return { ...state, status: 'unavailable' }

    case 'settings/changed': {
      const settings = { ...state.settings, ...action.patch }
      // Changing the typing language moves the layout with it, unless this very change set one.
      const layoutId =
        action.patch.layoutId ??
        (action.patch.typingLanguage === undefined
          ? settings.layoutId
          : layoutForLanguage(action.patch.typingLanguage))
      return { ...state, settings: { ...settings, layoutId } }
    }

    case 'startingLevel/chosen':
      // FR-073: forward only. Re-answering never takes keys away, because the fold takes the
      // greater of the choice's boundary and what the learner has actually earned.
      return { ...state, startingLevelChoice: action.choice }

    case 'attempt/started':
      return { ...state, attemptInProgress: true }

    case 'attempt/finished': {
      const summary = withoutLog(action.attempt)
      // Idempotent on id, exactly as the store is: a double submit must not double-count.
      if (state.attempts.some((existing) => existing.id === summary.id)) {
        return { ...state, attemptInProgress: false }
      }
      return {
        ...state,
        attemptInProgress: false,
        attempts: [...state.attempts, summary].sort((a, b) => a.completedAt - b.completedAt),
      }
    }

    case 'attempt/abandoned':
      // An abandoned attempt produces nothing: no metrics, no aggregates, no effect on mastery.
      return { ...state, attemptInProgress: false }

    case 'store/reset':
      return { ...initialState, status: 'ready', settings: state.settings }

    default: {
      // Exhaustiveness: adding a variant without handling it is a compile error, not a silent
      // no-op at run time.
      const unhandled: never = action
      return unhandled
    }
  }
}
