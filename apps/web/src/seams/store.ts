import { boundaryFor, layouts } from '@typing-race/curriculum'
import {
  type Attempt,
  type AttemptSummary,
  type KeystrokeEventLog,
  type Language,
  LOG_RETENTION_COUNT,
  type Settings,
  STORE_VERSION,
  type StartingLevelChoice,
  type StoredEnvelope,
} from '@typing-race/domain'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { ProgressStore } from './index.js'

/**
 * T019–T022. The seam F2 replaces with Supabase, so its shape is designed for that today:
 * asynchronous, batched, idempotent by attempt id, version-marked.
 *
 * This is the only file in the application permitted to touch IndexedDB (Constitution III).
 */

const DB_NAME = 'typing-race'
const DB_VERSION = 1
const STORE_NAME = 'envelope'
/** One record. The envelope is written and read whole, so a key is a formality. */
const ENVELOPE_KEY = 'current'

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

export function emptyEnvelope(writtenAt = 0): StoredEnvelope {
  return {
    storeVersion: STORE_VERSION,
    writtenAt,
    progressByLanguage: {},
    startingLevelByLanguage: {},
    settings: DEFAULT_SETTINGS,
    attempts: [],
    logs: {},
  }
}

// -------------------------------------------------------------------------------------------
// The rules both adapters share, so the contract suite can assert one behaviour against two
// implementations rather than two behaviours that happen to look alike.
// -------------------------------------------------------------------------------------------

/**
 * T021. Keep the keystroke logs of the `LOG_RETENTION_COUNT` most recently completed attempts and
 * discard the rest (FR-081).
 *
 * Pruning is safe precisely because every derived value reads `AttemptSummary`, which carries the
 * aggregates and never the log. The contract suite proves that directly (SC-019).
 */
function pruneLogs(
  attempts: readonly AttemptSummary[],
  logs: Readonly<Record<string, KeystrokeEventLog>>,
): Record<string, KeystrokeEventLog> {
  const keep = [...attempts]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, LOG_RETENTION_COUNT)
    .map((attempt) => attempt.id)

  const kept: Record<string, KeystrokeEventLog> = {}
  for (const id of keep) {
    const log = logs[id]
    if (log !== undefined) kept[id] = log
  }
  return kept
}

/**
 * T019, T022. Fold new attempts into an envelope.
 *
 * Two properties this must hold, and both are why the merge takes the *stored* envelope rather
 * than one the caller is holding:
 *
 * - **Idempotent on `attempt.id`** — a retried write, which F2's outbox will do routinely, must
 *   not double-count. An id already present wins over the incoming copy, because an Attempt is
 *   immutable once completed and the stored one is the one other records already reference.
 * - **A stale snapshot cannot silently overwrite newer state.** The caller never supplies a whole
 *   envelope, only the attempts it wants added, so there is no version of this API in which a tab
 *   that loaded ten minutes ago can erase what another tab wrote since.
 */
function mergeAttempts(current: StoredEnvelope, incoming: readonly Attempt[]): StoredEnvelope {
  const byId = new Map(current.attempts.map((attempt) => [attempt.id, attempt]))
  const logs: Record<string, KeystrokeEventLog> = { ...current.logs }

  for (const attempt of incoming) {
    if (byId.has(attempt.id)) continue
    const { log, text: _text, ...summary } = attempt
    byId.set(attempt.id, summary)
    if (log !== null) logs[attempt.id] = log
  }

  const attempts = [...byId.values()].sort((a, b) => a.completedAt - b.completedAt)
  return { ...current, attempts, logs: pruneLogs(attempts, logs) }
}

/**
 * FR-073, enforced in the store rather than only in the screen that asks the question.
 *
 * A learner may re-answer the starting-level question at any time, and the answer may not take a
 * key away — so the stored value is whichever choice opens more of the Unlock Order. Putting the
 * rule here means every caller inherits it, including F2's server adapter when it replaces this
 * file: a rule that lives in a form control is a rule one screen enforces.
 */
function forwardOnlyChoice(
  language: Language,
  current: StartingLevelChoice | undefined,
  incoming: StartingLevelChoice,
): StartingLevelChoice {
  if (current === undefined) return incoming
  const layout = language === 'uk' ? layouts.yq : layouts.qwerty
  return boundaryFor(layout, incoming) >= boundaryFor(layout, current) ? incoming : current
}

/** Monotonic, so two writes in the same millisecond still order. */
function nextWrittenAt(current: StoredEnvelope, now: number): number {
  return Math.max(now, current.writtenAt + 1)
}

// -------------------------------------------------------------------------------------------
// The real adapter
// -------------------------------------------------------------------------------------------

interface TypingRaceDb extends DBSchema {
  [STORE_NAME]: { key: string; value: StoredEnvelope }
}

export interface IndexedDbStoreOptions {
  /** Injected so the contract suite can drive `writtenAt` deterministically. */
  readonly now?: () => number
  /** Overridden only by tests, so one suite's databases cannot collide with another's. */
  readonly databaseName?: string
}

export function indexedDbStore(options: IndexedDbStoreOptions = {}): ProgressStore {
  const now = options.now ?? (() => Date.now())
  const databaseName = options.databaseName ?? DB_NAME
  let connection: Promise<IDBPDatabase<TypingRaceDb>> | undefined

  const db = (): Promise<IDBPDatabase<TypingRaceDb>> => {
    connection ??= openDB<TypingRaceDb>(databaseName, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore(STORE_NAME)
      },
    })
    return connection
  }

  /**
   * Read, transform and write inside **one** IndexedDB transaction. The atomicity is what makes
   * the concurrent-tab rule hold: a second tab's transaction either runs entirely before this one
   * or entirely after, so neither can base a write on a snapshot the other has already replaced.
   */
  const mutate = async (change: (current: StoredEnvelope) => StoredEnvelope): Promise<void> => {
    const database = await db()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const stored = await transaction.store.get(ENVELOPE_KEY)
    const current =
      stored !== undefined && stored.storeVersion === STORE_VERSION ? stored : emptyEnvelope()
    const updated = change(current)
    await transaction.store.put(
      { ...updated, writtenAt: nextWrittenAt(current, now()) },
      ENVELOPE_KEY,
    )
    await transaction.done
  }

  return {
    async load() {
      try {
        const stored = await (await db()).get(STORE_NAME, ENVELOPE_KEY)
        if (stored === undefined) return 'empty'
        // FR-083: a version we do not recognise is never read as if it were current. The learner
        // is told and offered a deliberate fresh start, rather than being silently reset.
        if (stored.storeVersion !== STORE_VERSION) return 'unreadable-version'
        return stored
      } catch {
        // FR-052: private mode, a disabled origin, a quota refusal. The learner is told plainly
        // and this visit's practice still runs — which is why this is a value, not a throw.
        return 'unavailable'
      }
    },

    async appendAttempts(attempts) {
      if (attempts.length === 0) return
      await mutate((current) => mergeAttempts(current, attempts))
    },

    async saveSettings(settings) {
      await mutate((current) => ({ ...current, settings }))
    },

    async saveStartingLevel(language, choice) {
      await mutate((current) => ({
        ...current,
        startingLevelByLanguage: {
          ...current.startingLevelByLanguage,
          [language]: forwardOnlyChoice(
            language,
            current.startingLevelByLanguage[language],
            choice,
          ),
        },
      }))
    },

    async clear() {
      const database = await db()
      await database.clear(STORE_NAME)
    },
  }
}

// -------------------------------------------------------------------------------------------
// The in-memory adapter
// -------------------------------------------------------------------------------------------

export interface MemoryStoreOptions {
  readonly now?: () => number
  /** Simulates FR-052 — a browser that cannot keep local data at all. */
  readonly unavailable?: boolean
}

/**
 * T020. The adapter every screen test seeds. Its whole value is that a test can start from a
 * learner three attempts into mastery without typing three attempts, so the result, path and
 * session screens stay independent of one another and of the engine.
 */
export function memoryStore(
  seed: Partial<StoredEnvelope> = {},
  options: MemoryStoreOptions = {},
): ProgressStore {
  const now = options.now ?? (() => Date.now())
  let envelope: StoredEnvelope = { ...emptyEnvelope(), ...seed }
  let seeded = Object.keys(seed).length > 0

  const mutate = (change: (current: StoredEnvelope) => StoredEnvelope): void => {
    const updated = change(envelope)
    envelope = { ...updated, writtenAt: nextWrittenAt(envelope, now()) }
    seeded = true
  }

  return {
    load() {
      if (options.unavailable === true) return Promise.resolve('unavailable')
      if (!seeded) return Promise.resolve('empty')
      if (envelope.storeVersion !== STORE_VERSION) return Promise.resolve('unreadable-version')
      return Promise.resolve(envelope)
    },

    appendAttempts(attempts) {
      if (attempts.length > 0) mutate((current) => mergeAttempts(current, attempts))
      return Promise.resolve()
    },

    saveSettings(settings) {
      mutate((current) => ({ ...current, settings }))
      return Promise.resolve()
    },

    saveStartingLevel(language, choice) {
      mutate((current) => ({
        ...current,
        startingLevelByLanguage: {
          ...current.startingLevelByLanguage,
          [language]: forwardOnlyChoice(
            language,
            current.startingLevelByLanguage[language],
            choice,
          ),
        },
      }))
      return Promise.resolve()
    },

    clear() {
      envelope = emptyEnvelope()
      seeded = false
      return Promise.resolve()
    },
  }
}
