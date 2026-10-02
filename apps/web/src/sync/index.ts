import type { Attempt, Settings } from '@typing-race/domain'
import type { OutboxStore, ProgressStore } from '../seams/index.js'
import { batches, missingFrom, resolveSettings, retryDelay, settleUpload } from './policy.js'

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

/**
 * A failure the remote can describe: a dropped request, or the server asking the device to back off
 * (`submit-attempt` answers 429 with `Retry-After` past its per-user window). Any other error is
 * treated the same way, just without a minimum wait.
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    /** The server asked for at least this long before the next attempt. */
    readonly retryAfterMs = 0,
  ) {
    super(message)
    this.name = 'RemoteError'
  }
}

/**
 * Why a nick was not saved. `taken`: another learner has it (nicks are unique, case-insensitive).
 * `invalid`: outside 2–32 characters once trimmed — the profile's own check. `signed-out`: there
 * is no account to write it to.
 */
export class NickError extends Error {
  constructor(readonly code: 'taken' | 'invalid' | 'signed-out') {
    super(`nick not saved: ${code}`)
    this.name = 'NickError'
  }
}

/** The profile's check (`char_length(nickname) between 2 and 32`), applied before the round trip. */
export const NICK_MIN = 2
export const NICK_MAX = 32

/**
 * Attempts per `submit-attempt` request. The function recomputes every attempt's metrics within one
 * call, so a week offline goes up in several modest requests rather than one that outlives the
 * function's time limit — and each batch leaves the outbox as soon as it is accepted.
 */
export const UPLOAD_BATCH = 50

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
  /** Saves and returns the stored nick. Throws `NickError('taken')` when another learner has it. */
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
  /** Trims, checks and saves the nick; resolves to what was stored. Rejects with `NickError`. */
  setNick(nick: string): Promise<string>
  /**
   * For sign-out. Wipes the local copy only when the outbox is empty, and says `'pending'`
   * otherwise — it never discards an attempt the cloud does not have.
   */
  wipeLocalIfSynced(): Promise<'wiped' | 'pending'>
  /**
   * For "delete my data", once the server has deleted the account: detaches, empties the outbox
   * and wipes the local copy unconditionally. There is no account left to upload anything to.
   */
  forgetLocal(): Promise<void>
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

  const failed = (error: unknown) => {
    phase = 'error'
    clearRetry()
    const delay = retryDelay(failures, error instanceof RemoteError ? error.retryAfterMs : 0)
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
    const accepted: string[] = []
    const rejected: Rejection[] = []
    // Oldest first, so an interrupted upload leaves the newest work queued, not a gap in the past.
    const ordered = [...queued].sort((x, y) => x.completedAt - y.completedAt)
    for (const batch of batches(ordered, UPLOAD_BATCH)) {
      const result = await target.push(batch)
      // Settled per batch: a failure further on keeps only what was not sent.
      await deps.outbox.remove(settleUpload(result))
      accepted.push(...result.accepted)
      rejected.push(...result.rejected)
    }
    lastRejections = rejected
    return { accepted, rejected, pending: await refreshPending() }
  }

  const pullAttempts = async (target: Remote): Promise<boolean> => {
    const cloud = await target.pull()
    const loaded = await deps.store.load()
    const missing = missingFrom(typeof loaded === 'string' ? [] : loaded.attempts, cloud)
    if (missing.length === 0) return false
    await deps.store.appendAttempts(missing)
    return true
  }

  const reconcileSettings = async (target: Remote): Promise<boolean> => {
    const loaded = await deps.store.load()
    if (loaded === 'unavailable' || loaded === 'unreadable-version') return false
    const local =
      loaded === 'empty'
        ? null
        : { settings: loaded.settings, updatedAt: loaded.settingsUpdatedAt ?? 0 }
    const cloud = await target.settings()
    const decision = resolveSettings(local, cloud)
    if (decision === 'take' && cloud !== null) {
      await deps.store.saveSettings(cloud.settings, cloud.updatedAt)
      return true
    }
    if (decision === 'push' && local !== null) await target.saveSettings(local)
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
        if (await pullAttempts(target)) localChanged()
        try {
          if (await reconcileSettings(target)) localChanged()
        } catch {
          // Settings are a convenience; a failure there must not hold the attempts hostage. The
          // next sync reconciles them again.
        }
        failures = 0
        clearRetry()
        phase = 'idle'
        lastSyncAt = now()
        announce()
      } catch (error) {
        // A batch may have gone up before the failure; the count the learner sees must say so.
        await refreshPending()
        if (remote === target) failed(error)
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
      } catch (error) {
        if (remote === target) failed(error)
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
      if (remote === null) throw new NickError('signed-out')
      const trimmed = nick.trim()
      const length = [...trimmed].length
      if (length < NICK_MIN || length > NICK_MAX) throw new NickError('invalid')
      return remote.setNick(trimmed)
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

    forgetLocal() {
      remote = null
      clearRetry()
      stopListening?.()
      stopListening = null
      phase = 'off'
      return serially(async () => {
        const queued = await deps.outbox.all()
        if (queued.length > 0) await deps.outbox.remove(queued.map((attempt) => attempt.id))
        await deps.store.clear()
        await refreshPending()
        lastSyncAt = null
        lastRejections = []
        announce()
        localChanged()
      })
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
// The application's one engine, and the small surface the sign-in UI and Profile's Account section
// call. Everything below is safe to import eagerly: the Supabase client loads only inside
// `startSync`, and only when a backend is configured.
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

export type StartResult = 'syncing' | 'no-backend' | 'no-session'

/**
 * Connects the signed-in account and runs a first full sync: the outbox uploads, the cloud history
 * unions in, settings reconcile. Call it after a sign-in (Google or the first race's guest) and at
 * boot. It never signs anyone in: with no session it answers `'no-session'` and touches nothing,
 * and with no backend configured `'no-backend'`. Never rejects.
 */
export async function startSync(): Promise<StartResult> {
  try {
    const cloud = await import('./cloud.js')
    return await cloud.startSync()
  } catch {
    return 'no-backend'
  }
}

/** Detaches the account. Local progress and the outbox stay. */
export function stopSync(): void {
  shared?.disconnect()
}

/** A sync right now — a "sync" button, or after the app regains focus. Never rejects. */
export function syncNow(): Promise<void> {
  return appSync().syncNow()
}

/** Observable sync status for the account UI. Subscribing calls back immediately. */
export const syncStatus = {
  get: (): SyncStatus => appSync().status(),
  subscribe: (listener: (status: SyncStatus) => void): (() => void) =>
    appSync().subscribe(listener),
}

/** The account's public nick, or `null` with no account connected. */
export function accountNick(): Promise<string | null> {
  return appSync().nick()
}

/** Saves the account's nick; resolves to what was stored, rejects with `NickError`. */
export function setAccountNick(nick: string): Promise<string> {
  return appSync().setNick(nick)
}

/**
 * The first half of sign-out (ADR-0006): flushes the outbox, then wipes the local copy only if
 * nothing is left to upload. `'pending'` means attempts are still unsynced and nothing was touched:
 * the UI warns, and may retry or let the learner stay signed in. On `'wiped'` the caller signs out
 * of Supabase, which disconnects sync.
 */
export function wipeLocalIfSynced(): Promise<'wiped' | 'pending'> {
  return appSync().wipeLocalIfSynced()
}

/**
 * The local half of "delete my data": after `delete-account` succeeded, the outbox and the local
 * copy go too — unconditionally, since the account they would upload to no longer exists.
 */
export function forgetLocalData(): Promise<void> {
  return appSync().forgetLocal()
}
