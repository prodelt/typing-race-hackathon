import type { Attempt, Settings } from '@typing-race/domain'
import type { OutboxStore, ProgressStore } from '../seams/index.js'

/**
 * The sync engine — ADR-0006's "progress syncs as a union of attempts".
 *
 * **No `supabase.from(...)` exists outside this directory.** The engine itself knows nothing of
 * Supabase either: it talks to a `Remote`, and `cloud.ts` (loaded lazily, only when a session
 * exists) is the adapter that turns a `Remote` into table reads and `submit-attempt` calls.
 *
 * What it guarantees:
 *
 * - **Training never waits on it.** `submitAttempt` resolves once the attempt is durable locally
 *   and queued in the outbox; nothing it does can throw for lack of a network.
 * - **Disconnected means local.** Until `connect` is given a remote, nothing leaves the browser.
 *   The engine never creates an identity; the caller connects only when a session already exists.
 * - **Merging is a set union.** Attempts are immutable with client UUIDs (ADR-0004), so the cloud
 *   history is appended to the local store, which is idempotent by id, and derived state (progress,
 *   Level, XP, Streak) is recomputed by the application from the result.
 * - **Uploads are idempotent and retried.** The outbox persists across reloads, a re-sent id is a
 *   no-op on the server, and a failed flush retries on `online` and with exponential backoff.
 * - **Settings are last-write-wins** by `updatedAt`, in both directions.
 */

/** Why an attempt the server refused was refused, so the interface can say something true. */
export type RejectionReason =
  | 'text_mismatch'
  | 'unknown_scale'
  | 'implausible_interval'
  | 'too_fast'
  | 'log_malformed'
  | 'future_timestamp'

export interface Rejection {
  readonly id: string
  readonly reason: RejectionReason
}

export interface StampedSettings {
  readonly settings: Settings
  /** Epoch ms of the write. The later stamp wins. */
  readonly updatedAt: number
}

/** The account's side of sync. One adapter talks to Supabase; tests use an in-memory cloud. */
export interface Remote {
  /** Uploads through `submit-attempt`. Re-sending an id the server already has is accepted and changes nothing. */
  push(attempts: readonly Attempt[]): Promise<{
    readonly accepted: readonly string[]
    readonly rejected: readonly Rejection[]
  }>
  /** Every attempt of the account. The server keeps no text, so `text` comes back empty. */
  pull(): Promise<readonly Attempt[]>
  settings(): Promise<StampedSettings | null>
  saveSettings(stamped: StampedSettings): Promise<void>
  nick(): Promise<string>
  setNick(nick: string): Promise<string>
}

export interface FlushReport {
  readonly accepted: readonly string[]
  readonly rejected: readonly Rejection[]
  /** How many attempts are still queued. */
  readonly pending: number
}

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  /** A remote is attached: a session exists and sync runs. */
  readonly connected: boolean
  readonly phase: SyncPhase
  readonly online: boolean
  /** Attempts queued and not yet accepted by the server. */
  readonly pending: number
  readonly lastSyncAt: number | null
  /** What the server refused on the last flush, so the learner can be told once. */
  readonly lastRejections: readonly Rejection[]
}

export interface Sync {
  /** Durable locally and queued once this resolves; uploads behind it when connected. */
  submitAttempt(attempt: Attempt): Promise<void>
  /** Call after the local settings were saved; pushes them when connected. */
  settingsChanged(): Promise<void>
  /** Attaches the account and runs a first full sync. Never rejects. */
  connect(remote: Remote): Promise<void>
  /** Detaches the account. Local data and the outbox stay. */
  disconnect(): void
  /** Flush the outbox, pull and union the cloud history, reconcile settings. Never rejects. */
  syncNow(): Promise<void>
  flush(): Promise<FlushReport>
  /** The profile nick, or `null` when disconnected. */
  nick(): Promise<string | null>
  setNick(nick: string): Promise<string>
  /**
   * For sign-out. Wipes the local copy only when the outbox is empty, and says `'pending'`
   * otherwise — it never discards an attempt the cloud does not have.
   */
  wipeLocalIfSynced(): Promise<'wiped' | 'pending'>
  status(): SyncStatus
  subscribe(listener: (status: SyncStatus) => void): () => void
}

export interface SyncDeps {
  readonly store: ProgressStore
  readonly outbox: OutboxStore
  /** Injected so a test can drive connectivity. Defaults to `navigator.onLine`. */
  readonly isOnline?: () => boolean
  /** Subscribes to the browser coming back online. Defaults to the window `online` event. */
  readonly onOnline?: (listener: () => void) => () => void
  /** Schedules a retry. Defaults to `setTimeout`. */
  readonly schedule?: (run: () => void, ms: number) => () => void
  /** Local data changed underneath the application (a pull, cloud settings, a wipe): reload it. */
  readonly onLocalChanged?: () => void
  readonly now?: () => number
}

const FIRST_RETRY_MS = 2_000
const MAX_RETRY_MS = 5 * 60_000

const defaultIsOnline = (): boolean => globalThis.navigator?.onLine ?? true

const defaultOnOnline = (listener: () => void): (() => void) => {
  if (typeof globalThis.addEventListener !== 'function') return () => {}
  globalThis.addEventListener('online', listener)
  return () => globalThis.removeEventListener('online', listener)
}

const defaultSchedule = (run: () => void, ms: number): (() => void) => {
  const handle = setTimeout(run, ms)
  return () => clearTimeout(handle)
}

export function createSync(deps: SyncDeps): Sync {
  const isOnline = deps.isOnline ?? defaultIsOnline
  const onOnline = deps.onOnline ?? defaultOnOnline
  const schedule = deps.schedule ?? defaultSchedule
  const now = deps.now ?? (() => Date.now())
  const localChanged = () => deps.onLocalChanged?.()

  const listeners = new Set<(status: SyncStatus) => void>()
  let remote: Remote | null = null
  let phase: SyncPhase = 'off'
  let pending = 0
  let lastSyncAt: number | null = null
  let lastRejections: readonly Rejection[] = []
  let failures = 0
  let cancelRetry: (() => void) | null = null
  let stopListening: (() => void) | null = null
  /** One operation at a time, so two flushes never upload the same batch concurrently. */
  let queue: Promise<unknown> = Promise.resolve()

  const status = (): SyncStatus => ({
    connected: remote !== null,
    phase,
    online: isOnline(),
    pending,
    lastSyncAt,
    lastRejections,
  })

  const announce = (): void => {
    const snapshot = status()
    for (const listener of listeners) listener(snapshot)
  }

  const refreshPending = async (): Promise<number> => {
    pending = (await deps.outbox.all()).length
    return pending
  }

  const serially = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  const clearRetry = () => {
    cancelRetry?.()
    cancelRetry = null
  }

  const failed = () => {
    phase = 'error'
    clearRetry()
    const delay = Math.min(FIRST_RETRY_MS * 2 ** failures, MAX_RETRY_MS)
    failures += 1
    cancelRetry = schedule(() => {
      cancelRetry = null
      void syncNow()
    }, delay)
    announce()
  }

  /** Uploads the outbox. Throws on a network or server failure; the caller decides about retries. */
  const upload = async (target: Remote): Promise<FlushReport> => {
    const queued = await deps.outbox.all()
    if (queued.length === 0) return { accepted: [], rejected: [], pending: 0 }
    const result = await target.push(queued)
    // A refused attempt leaves the outbox too: the server would refuse it again forever.
    await deps.outbox.remove([...result.accepted, ...result.rejected.map((r) => r.id)])
    lastRejections = result.rejected
    return { accepted: result.accepted, rejected: result.rejected, pending: await refreshPending() }
  }

  const pullAttempts = async (target: Remote): Promise<boolean> => {
    const cloud = await target.pull()
    const loaded = await deps.store.load()
    const known = new Set(typeof loaded === 'string' ? [] : loaded.attempts.map((a) => a.id))
    const missing = cloud.filter((a) => !known.has(a.id))
    if (missing.length === 0) return false
    await deps.store.appendAttempts(missing)
    return true
  }

  const reconcileSettings = async (target: Remote): Promise<boolean> => {
    const loaded = await deps.store.load()
    if (loaded === 'unavailable' || loaded === 'unreadable-version') return false
    const localStamp = loaded === 'empty' ? 0 : (loaded.settingsUpdatedAt ?? 0)
    const cloud = await target.settings()
    const cloudStamp = cloud?.updatedAt ?? 0
    if (cloud !== null && cloudStamp > localStamp) {
      await deps.store.saveSettings(cloud.settings, cloud.updatedAt)
      return true
    }
    if (loaded !== 'empty' && localStamp > cloudStamp) {
      await target.saveSettings({ settings: loaded.settings, updatedAt: localStamp })
    }
    return false
  }

  const syncNow = (): Promise<void> =>
    serially(async () => {
      const target = remote
      if (target === null || !isOnline()) return
      phase = 'syncing'
      announce()
      try {
        await upload(target)
        const pulled = await pullAttempts(target)
        const settingsApplied = await reconcileSettings(target)
        if (pulled || settingsApplied) localChanged()
        failures = 0
        clearRetry()
        phase = 'idle'
        lastSyncAt = now()
        announce()
      } catch {
        if (remote === target) failed()
      }
    })

  const flush = (): Promise<FlushReport> =>
    serially(async () => {
      const target = remote
      if (target === null || !isOnline()) {
        return { accepted: [], rejected: [], pending: await refreshPending() }
      }
      try {
        const report = await upload(target)
        failures = 0
        clearRetry()
        phase = 'idle'
        lastSyncAt = now()
        announce()
        return report
      } catch {
        if (remote === target) failed()
        return { accepted: [], rejected: [], pending: await refreshPending() }
      }
    })

  return {
    async submitAttempt(attempt) {
      await deps.store.appendAttempts([attempt])
      await deps.outbox.put(attempt)
      await refreshPending()
      announce()
      if (remote !== null && isOnline()) void flush()
    },

    async settingsChanged() {
      const target = remote
      if (target === null || !isOnline()) return
      await serially(async () => {
        try {
          if (await reconcileSettings(target)) localChanged()
        } catch {
          // The next full sync reconciles again; a settings push is never worth an error state.
        }
      })
    },

    async connect(next) {
      remote = next
      failures = 0
      clearRetry()
      stopListening?.()
      stopListening = onOnline(() => void syncNow())
      phase = 'idle'
      await refreshPending()
      announce()
      await syncNow()
    },

    disconnect() {
      remote = null
      clearRetry()
      stopListening?.()
      stopListening = null
      phase = 'off'
      announce()
    },

    syncNow,
    flush,

    async nick() {
      return remote === null ? null : remote.nick()
    },

    async setNick(nick) {
      if (remote === null) throw new Error('not signed in')
      return remote.setNick(nick)
    },

    async wipeLocalIfSynced() {
      if (remote !== null) await flush()
      if ((await refreshPending()) > 0) {
        announce()
        return 'pending'
      }
      await deps.store.clear()
      announce()
      localChanged()
      return 'wiped'
    },

    status,

    subscribe(listener) {
      listeners.add(listener)
      listener(status())
      void refreshPending().then((count) => {
        if (listeners.has(listener) && count !== 0) announce()
      })
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// -------------------------------------------------------------------------------------------
// The application's one engine, and the small surface the account UI calls. `startSync` lives in
// `cloud.ts` so the Supabase client loads only when a session is about to be used.
// -------------------------------------------------------------------------------------------

let shared: Sync | null = null

/** Called by the app store, which owns the engine because it owns the local store. */
export function setAppSync(sync: Sync): void {
  shared?.disconnect()
  shared = sync
}

export function appSync(): Sync {
  if (shared === null) throw new Error('sync is not configured; import the app store first')
  return shared
}

/** Observable sync status for the account UI. Subscribing calls back immediately. */
export const syncStatus = {
  get: (): SyncStatus => appSync().status(),
  subscribe: (listener: (status: SyncStatus) => void): (() => void) =>
    appSync().subscribe(listener),
}

/** Detaches the account. Local progress and the outbox stay. */
export function stopSync(): void {
  shared?.disconnect()
}

/** For sign-out: `'wiped'` only when nothing is left to upload, else `'pending'` and nothing is touched. */
export function wipeLocalIfSynced(): Promise<'wiped' | 'pending'> {
  return appSync().wipeLocalIfSynced()
}
