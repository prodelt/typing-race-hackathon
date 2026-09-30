import 'fake-indexeddb/auto'

import {
  type Attempt,
  type AttemptMetrics,
  LOG_RETENTION_COUNT,
  type Settings,
  STORE_VERSION,
} from '@typing-race/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ProgressStore } from './index.js'
import { DEFAULT_SETTINGS, emptyEnvelope, indexedDbStore, memoryStore } from './store.js'

/**
 * T024. One suite, two adapters.
 *
 * This is the suite **F2 reuses** when it adds the Supabase adapter. That is why it asserts on
 * behaviour a server must also honour — idempotency by attempt id, a stale write never winning,
 * retention not disturbing anything derived — and never on how a row is stored.
 *
 * Both adapters get the same monotonic fake clock so `writtenAt` is comparable across them.
 */

function metrics(): AttemptMetrics {
  return {
    spm: 120,
    wpm: 24,
    accuracy: 0.96,
    errorCount: 1,
    errorsByChar: { а: 1 },
    rhythmConsistency: { value: 82, breaksExcluded: 0 },
    meanIkiByKey: { а: 500 },
    meanIkiByTransition: { 'а>о': 480 },
  }
}

function attempt(id: string, completedAt: number): Attempt {
  return {
    id,
    scaleId: 'yq-run-home',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    text: 'фіва олдж',
    seed: 1,
    startedAt: completedAt - 10_000,
    completedAt,
    elapsedMs: 10_000,
    metrics: metrics(),
    aggregates: {
      keys: { ф: { count: 2, misses: 0, sumIki: 900, sumIkiSq: 410_000 } },
      transitions: {
        'ф>і': { count: 1, misses: 0, sumIki: 450, sumIkiSq: 202_500 },
      },
    },
    log: {
      formatVersion: 1,
      dt: [0, 450],
      kind: ['char', 'char'],
      char: ['ф', 'і'],
      correct: [true, true],
    },
  }
}

interface Adapter {
  readonly name: string
  /** Two calls with the same generation must reach the same underlying storage. */
  create(generation: number): ProgressStore
  next(): number
}

/** Shared by both adapters so `writtenAt` advances identically and assertions can compare it. */
function tickingClock(): () => number {
  let t = 1_000
  return () => {
    t += 1
    return t
  }
}

/**
 * Each test gets a fresh generation rather than deleting the database between tests: `deleteDB`
 * blocks on any still-open connection, and a store deliberately holds one open for its lifetime.
 * A new name is the same isolation without the deadlock.
 */
function generations(): () => number {
  let n = 0
  return () => {
    n += 1
    return n
  }
}

const memoryGenerations = new Map<number, ProgressStore>()

const adapters: Adapter[] = [
  {
    name: 'memoryStore',
    // memoryStore keeps its state in the closure, so "the same storage" means the same instance.
    create(generation) {
      const existing = memoryGenerations.get(generation)
      if (existing !== undefined) return existing
      const created = memoryStore({}, { now: tickingClock() })
      memoryGenerations.set(generation, created)
      return created
    },
    next: generations(),
  },
  {
    name: 'indexedDbStore',
    create: (generation) =>
      indexedDbStore({
        now: tickingClock(),
        databaseName: `typing-race-test-${generation}`,
      }),
    next: generations(),
  },
]

for (const adapter of adapters) {
  describe(`ProgressStore contract — ${adapter.name}`, () => {
    let store: ProgressStore
    let generation = 0

    beforeEach(() => {
      generation = adapter.next()
      store = adapter.create(generation)
    })

    it('reports an untouched store as empty rather than as an empty envelope', async () => {
      // The two are different screens: a first visit gets the starting-level choice, an envelope
      // with no attempts does not.
      await expect(store.load()).resolves.toBe('empty')
    })

    it('round-trips an appended attempt', async () => {
      await store.appendAttempts([attempt('a1', 2_000)])

      const loaded = await store.load()
      expect(loaded).not.toBe('empty')
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      expect(loaded.attempts.map((a) => a.id)).toEqual(['a1'])
      expect(loaded.storeVersion).toBe(STORE_VERSION)
    })

    it('never stores the attempt text or log on the summary', async () => {
      // Every derived value reads AttemptSummary, and the log may be pruned at any time. If the
      // summary carried either, a derived value could quietly come to depend on it (SC-019).
      await store.appendAttempts([attempt('a1', 2_000)])

      const loaded = await store.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      const [summary] = loaded.attempts
      expect(summary).toBeDefined()
      expect(summary).not.toHaveProperty('log')
      expect(summary).not.toHaveProperty('text')
      expect(loaded.logs['a1']).toBeDefined()
    })

    it('is idempotent on attempt id, so a retried write cannot double-count', async () => {
      // F2's outbox retries by design. Two appends of one attempt must leave one attempt.
      await store.appendAttempts([attempt('a1', 2_000)])
      await store.appendAttempts([attempt('a1', 2_000)])

      const loaded = await store.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      expect(loaded.attempts).toHaveLength(1)
    })

    it('keeps attempts ordered by completion, whatever order they arrive in', async () => {
      // Out-of-order arrival is normal once F2's outbox drains after being offline, and the
      // progress fold is specified over completion order (FR-050).
      await store.appendAttempts([attempt('late', 9_000)])
      await store.appendAttempts([attempt('early', 1_000)])

      const loaded = await store.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      expect(loaded.attempts.map((a) => a.id)).toEqual(['early', 'late'])
    })

    it(`keeps the keystroke logs of only the ${LOG_RETENTION_COUNT} most recent attempts`, async () => {
      const many = Array.from({ length: LOG_RETENTION_COUNT + 5 }, (_, i) =>
        attempt(`a${i}`, 1_000 + i),
      )
      await store.appendAttempts(many)

      const loaded = await store.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')

      expect(loaded.attempts).toHaveLength(LOG_RETENTION_COUNT + 5)
      expect(Object.keys(loaded.logs)).toHaveLength(LOG_RETENTION_COUNT)
      // The five oldest lost their logs; the newest kept theirs.
      expect(loaded.logs['a0']).toBeUndefined()
      expect(loaded.logs[`a${LOG_RETENTION_COUNT + 4}`]).toBeDefined()
    })

    it('pruning a log changes nothing a derived value reads (SC-019)', async () => {
      const first = attempt('a0', 1_000)
      await store.appendAttempts([first])
      const before = await store.load()
      if (typeof before === 'string') throw new Error('expected an envelope')
      const summaryBefore = before.attempts.find((a) => a.id === 'a0')

      // Push it past the retention window.
      await store.appendAttempts(
        Array.from({ length: LOG_RETENTION_COUNT }, (_, i) => attempt(`later${i}`, 2_000 + i)),
      )

      const after = await store.load()
      if (typeof after === 'string') throw new Error('expected an envelope')
      expect(after.logs['a0']).toBeUndefined()
      // The aggregates, which are what progress and confidence are folded from, are untouched.
      expect(after.attempts.find((a) => a.id === 'a0')).toEqual(summaryBefore)
    })

    it('saves and restores settings', async () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        textSizePx: 34,
      }
      await store.saveSettings(settings)

      const loaded = await store.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      expect(loaded.settings).toEqual(settings)
    })

    it('advances writtenAt on every write, so a stale snapshot is detectable', async () => {
      await store.appendAttempts([attempt('a1', 1_000)])
      const first = await store.load()
      if (typeof first === 'string') throw new Error('expected an envelope')

      await store.saveSettings({ ...DEFAULT_SETTINGS, sound: 'on' })
      const second = await store.load()
      if (typeof second === 'string') throw new Error('expected an envelope')

      expect(second.writtenAt).toBeGreaterThan(first.writtenAt)
    })

    it('cannot be made to lose a concurrent write, because callers never hand back an envelope', async () => {
      // Two "tabs" over the same underlying storage. The second knows nothing of the first's
      // attempt, yet appending must not erase it — this is the concurrent-tab rule (T022), and
      // the API shape is what enforces it: there is no `save(envelope)`.
      const tabA = adapter.create(generation)
      const tabB = adapter.create(generation)

      await tabA.appendAttempts([attempt('from-a', 1_000)])
      await tabB.appendAttempts([attempt('from-b', 2_000)])

      const loaded = await tabA.load()
      if (typeof loaded === 'string') throw new Error('expected an envelope')
      expect(loaded.attempts.map((a) => a.id).sort()).toEqual(['from-a', 'from-b'])
    })

    it('clear() returns the store to empty', async () => {
      await store.appendAttempts([attempt('a1', 1_000)])
      await store.clear()
      await expect(store.load()).resolves.toBe('empty')
    })
  })
}

describe('memoryStore seeding', () => {
  it('reports a seeded store as an envelope, not as empty', async () => {
    // This is the whole reason the adapter exists: US2, US3 and US6 each start from a learner
    // partway through, without typing their way there or depending on each other.
    const store = memoryStore({
      attempts: [{ ...attempt('seeded', 1_000), log: undefined } as never],
    })
    const loaded = await store.load()
    expect(loaded).not.toBe('empty')
  })

  it('reports unavailable when the browser cannot keep local data (FR-052)', async () => {
    const store = memoryStore({}, { unavailable: true })
    await expect(store.load()).resolves.toBe('unavailable')
  })

  it('reports an unreadable version rather than silently resetting (FR-083)', async () => {
    const store = memoryStore({
      ...emptyEnvelope(1),
      storeVersion: STORE_VERSION + 1,
    })
    await expect(store.load()).resolves.toBe('unreadable-version')
  })
})
