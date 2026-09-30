import type { Attempt, Language, Progress, StoredEnvelope } from '@typing-race/domain'
import type { ProgressStore } from '../seams/index.js'

/**
 * The `sync` seam — ticket 21's deep module, and the boundary F2 puts between the application and
 * Supabase.
 *
 * **No `supabase.from(...)` exists outside this directory.** That is the rule the module is for.
 * A screen that reaches into the client directly is a screen that cannot be tested without a
 * server, cannot work offline, and quietly acquires an opinion about the schema — and there will
 * be seven of them.
 *
 * The surface is shaped by what an offline-first product actually needs rather than by what a
 * database offers:
 *
 * - `submitAttempt` **never fails for lack of a network**. It writes locally and queues, and the
 *   outbox drains when it can. FR-074 promises practice offline, and a call that throws when the
 *   train enters a tunnel would break it at the worst moment.
 * - `progress` answers from the cache first and refreshes behind it, because a learner opening
 *   Today should see their ladder immediately and not a spinner.
 * - Every write is idempotent by attempt id, so draining the outbox twice is free.
 *
 * Two adapters, as Constitution III requires: Supabase, and in-memory for unit tests and for the
 * end-to-end suite when Docker is not available.
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

export interface FlushReport {
  readonly accepted: readonly string[]
  readonly rejected: readonly Rejection[]
  /** How many attempts are still queued. Zero means the outbox is empty, not that it never had anything. */
  readonly pending: number
}

export interface SyncStatus {
  readonly online: boolean
  readonly pending: number
  readonly lastFlushAt: number | null
  /**
   * What the server refused on the last flush.
   *
   * It lives on the status rather than only in the return of `flush`, because `submitAttempt`
   * starts a flush of its own and nobody awaits it — so a rejection raised there would otherwise
   * vanish. A learner whose attempt was thrown away has to be told, and the only path to them is
   * a subscriber.
   */
  readonly lastRejections: readonly Rejection[]
}

export interface Sync {
  /**
   * Records an attempt. Resolves once it is **durable locally** — not once the server has it.
   * The difference is the whole design: a learner's work is safe the moment they finish typing.
   */
  submitAttempt(attempt: Attempt): Promise<void>
  /** Cache first, refreshed behind. `null` while nothing is known yet. */
  progress(language: Language): Promise<Progress | null>
  /** Drains the outbox. Safe to call at any time, including when it is empty or offline. */
  flush(): Promise<FlushReport>
  status(): SyncStatus
  subscribe(listener: (status: SyncStatus) => void): () => void
  /**
   * Sign-out clears the local cache, after the caller has warned about anything unsent
   * (ticket 21). This protects a learner on a shared machine; a reload is not a sign-out, so
   * requirement §8.9 is unaffected.
   */
  signOut(): Promise<void>
}

export interface SyncDeps {
  /** The local half. In F1 this is `indexedDbStore`; the interface does not change in F2. */
  readonly store: ProgressStore
  /** Injected so a test can drive connectivity instead of unplugging a cable. */
  readonly isOnline: () => boolean
  /** Posts a batch to `submit-attempt`. Absent in the in-memory adapter. */
  readonly push?: (attempts: readonly Attempt[]) => Promise<{
    accepted: readonly string[]
    rejected: readonly Rejection[]
    progress: Progress | null
  }>
}

/**
 * The adapter-independent core. Both adapters are this function with a different `push` and a
 * different `store`, which is what lets one contract suite cover both — the same trick that
 * already works for `ProgressStore`.
 */
export function createSync(deps: SyncDeps): Sync {
  const listeners = new Set<(status: SyncStatus) => void>()
  const outbox = new Map<string, Attempt>()
  const progressCache = new Map<Language, Progress>()
  let lastFlushAt: number | null = null
  let lastRejections: readonly Rejection[] = []

  const status = (): SyncStatus => ({
    online: deps.isOnline(),
    pending: outbox.size,
    lastFlushAt,
    lastRejections,
  })

  const announce = (): void => {
    const snapshot = status()
    for (const listener of listeners) listener(snapshot)
  }

  return {
    async submitAttempt(attempt) {
      // Local first, always. If the network is there, the flush below is a bonus; if it is not,
      // nothing was lost and nothing threw.
      await deps.store.appendAttempts([attempt])
      outbox.set(attempt.id, attempt)
      announce()
      if (deps.isOnline() && deps.push) void this.flush()
    },

    async progress(language) {
      const cached = progressCache.get(language)
      if (cached) return cached

      const loaded = await deps.store.load()
      if (typeof loaded === 'string') return null
      const local = (loaded as StoredEnvelope).progressByLanguage[language]
      if (local) progressCache.set(language, local)
      return local ?? null
    },

    async flush() {
      const queued = [...outbox.values()]
      if (queued.length === 0 || !deps.push || !deps.isOnline()) {
        return { accepted: [], rejected: [], pending: outbox.size }
      }

      const result = await deps.push(queued)
      for (const id of result.accepted) outbox.delete(id)
      // A rejected attempt leaves the outbox too. Retrying a log the server has already judged
      // malformed would queue it forever, and the learner needs to be told once, not every
      // minute until they clear their storage.
      for (const rejection of result.rejected) outbox.delete(rejection.id)

      lastRejections = result.rejected
      lastFlushAt = Date.now()
      announce()
      return { accepted: result.accepted, rejected: result.rejected, pending: outbox.size }
    },

    status,

    subscribe(listener) {
      listeners.add(listener)
      listener(status())
      return () => {
        listeners.delete(listener)
      }
    },

    async signOut() {
      outbox.clear()
      progressCache.clear()
      lastRejections = []
      await deps.store.clear()
      announce()
    },
  }
}

/**
 * The in-memory adapter: a local store, no server, permanently "online" so `flush` is exercised
 * rather than short-circuited. What the UI tests and the offline end-to-end scenario use.
 */
export function memorySync(store: ProgressStore): Sync {
  return createSync({ store, isOnline: () => true })
}
