import type { Attempt } from '@typing-race/domain'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

/**
 * The outbox: every completed attempt, whole (text and keystroke log included), until the server
 * has accepted or refused it. Kept apart from the progress envelope because the envelope strips the
 * text and prunes old logs, and `submit-attempt` needs both to recompute the metrics.
 *
 * Attempts are queued whether or not anyone is signed in: a learner who trains for a week and then
 * signs in uploads that week. Keyed by the attempt's client UUID, so queueing twice is queueing once.
 */
export interface OutboxStore {
  all(): Promise<readonly Attempt[]>
  put(attempt: Attempt): Promise<void>
  remove(ids: readonly string[]): Promise<void>
}

interface OutboxDb extends DBSchema {
  attempts: { key: string; value: Attempt }
}

export interface IndexedDbOutboxOptions {
  /** Overridden only by tests, so suites cannot collide. */
  readonly databaseName?: string
}

export function indexedDbOutbox(options: IndexedDbOutboxOptions = {}): OutboxStore {
  const name = options.databaseName ?? 'typing-race-outbox'
  let connection: Promise<IDBPDatabase<OutboxDb>> | undefined
  // Opened on first use, never at import: a page that never finishes an attempt never opens it.
  const db = (): Promise<IDBPDatabase<OutboxDb>> => {
    connection ??= openDB<OutboxDb>(name, 1, {
      upgrade(database) {
        database.createObjectStore('attempts', { keyPath: 'id' })
      },
    })
    return connection
  }

  return {
    async all() {
      try {
        return await (await db()).getAll('attempts')
      } catch {
        // A browser that keeps no local data has nothing queued; training goes on regardless.
        return []
      }
    },
    async put(attempt) {
      try {
        await (await db()).put('attempts', attempt)
      } catch {
        // Same: an unavailable outbox must never break finishing an attempt.
      }
    },
    async remove(ids) {
      if (ids.length === 0) return
      const transaction = (await db()).transaction('attempts', 'readwrite')
      await Promise.all([...ids.map((id) => transaction.store.delete(id)), transaction.done])
    },
  }
}

export function memoryOutbox(seed: readonly Attempt[] = []): OutboxStore {
  const queued = new Map(seed.map((attempt) => [attempt.id, attempt]))
  return {
    all: () => Promise.resolve([...queued.values()]),
    put(attempt) {
      queued.set(attempt.id, attempt)
      return Promise.resolve()
    },
    remove(ids) {
      for (const id of ids) queued.delete(id)
      return Promise.resolve()
    },
  }
}
