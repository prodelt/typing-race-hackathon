import type { Attempt, AttemptMetrics } from '@typing-race/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../seams/store.js'
import { createSync, memorySync, type Rejection, type Sync } from './index.js'

/**
 * The `sync` contract. Like the `ProgressStore` suite it sits beside, this is written to be run
 * against **every** adapter, so it asserts on behaviour a server must also honour and never on
 * how anything is stored.
 *
 * The behaviour that matters most here is the one the offline promise rests on: a submitted
 * attempt is durable before the network is consulted, and no call throws because the network is
 * gone (FR-074).
 */

function metrics(): AttemptMetrics {
  return {
    spm: 210,
    wpm: 42,
    accuracy: 0.97,
    errorCount: 1,
    errorsByChar: { ф: 1 },
    rhythmConsistency: { value: 80, breaksExcluded: 0 },
    meanIkiByKey: { ф: 280 },
    meanIkiByTransition: { 'ф>і': 260 },
  }
}

function attempt(id: string, completedAt = 1_000): Attempt {
  return {
    id,
    scaleId: 'yq.run.KeyG',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    text: 'фіва олдж',
    seed: 7,
    startedAt: completedAt - 8_000,
    completedAt,
    elapsedMs: 8_000,
    metrics: metrics(),
    aggregates: { keys: {}, transitions: {} },
    log: {
      formatVersion: 1,
      dt: [0, 260],
      kind: ['char', 'char'],
      char: ['ф', 'і'],
      correct: [true, true],
    },
  }
}

describe('sync — offline behaviour, the promise FR-074 rests on', () => {
  let sync: Sync

  beforeEach(() => {
    sync = memorySync(memoryStore())
  })

  it('makes an attempt durable locally before any network is consulted', async () => {
    const store = memoryStore()
    const offline = createSync({ store, isOnline: () => false })

    await offline.submitAttempt(attempt('a1'))

    const loaded = await store.load()
    if (typeof loaded === 'string') throw new Error('expected an envelope')
    expect(loaded.attempts.map((a) => a.id)).toEqual(['a1'])
  })

  it('does not throw when there is no network', async () => {
    const offline = createSync({ store: memoryStore(), isOnline: () => false })
    // The whole point. A call that threw in a tunnel would break practice at the worst moment.
    await expect(offline.submitAttempt(attempt('a1'))).resolves.toBeUndefined()
    await expect(offline.flush()).resolves.toMatchObject({ pending: 1 })
  })

  it('queues while offline and drains once online', async () => {
    let online = false
    const push = vi.fn(async (attempts: readonly Attempt[]) => ({
      accepted: attempts.map((a) => a.id),
      rejected: [] as Rejection[],
      progress: null,
    }))
    const queued = createSync({ store: memoryStore(), isOnline: () => online, push })

    await queued.submitAttempt(attempt('a1', 1_000))
    await queued.submitAttempt(attempt('a2', 2_000))
    expect(push).not.toHaveBeenCalled()
    expect(queued.status().pending).toBe(2)

    online = true
    const report = await queued.flush()

    // One batched call, not one per attempt: the outbox flushes everything at once.
    expect(push).toHaveBeenCalledTimes(1)
    expect(report.accepted).toEqual(['a1', 'a2'])
    expect(queued.status().pending).toBe(0)
  })

  it('drops a rejected attempt from the outbox instead of retrying it forever', async () => {
    // A log the server has judged malformed will be judged malformed again. Retrying it would
    // queue it until the learner clears their storage, and would tell them about it every minute.
    let online = false
    const push = vi.fn(async (attempts: readonly Attempt[]) => ({
      accepted: [] as string[],
      rejected: attempts.map((a) => ({ id: a.id, reason: 'log_malformed' as const })),
      progress: null,
    }))
    const rejecting = createSync({ store: memoryStore(), isOnline: () => online, push })

    await rejecting.submitAttempt(attempt('bad'))
    online = true
    const report = await rejecting.flush()

    expect(report.rejected).toEqual([{ id: 'bad', reason: 'log_malformed' }])
    expect(rejecting.status().pending).toBe(0)
  })

  it('surfaces a rejection raised by the flush submitAttempt starts on its own', async () => {
    // `submitAttempt` kicks off a flush nobody awaits, so a rejection raised there has no return
    // value to travel in. It has to reach the learner through the status, or an attempt is
    // silently thrown away.
    const push = vi.fn(async (attempts: readonly Attempt[]) => ({
      accepted: [] as string[],
      rejected: attempts.map((a) => ({ id: a.id, reason: 'too_fast' as const })),
      progress: null,
    }))
    const s = createSync({ store: memoryStore(), isOnline: () => true, push })

    await s.submitAttempt(attempt('suspicious'))
    await vi.waitFor(() => {
      expect(s.status().lastRejections).toEqual([{ id: 'suspicious', reason: 'too_fast' }])
    })
  })

  it('flushing twice accepts nothing the second time', async () => {
    const push = vi.fn(async (attempts: readonly Attempt[]) => ({
      accepted: attempts.map((a) => a.id),
      rejected: [] as Rejection[],
      progress: null,
    }))
    const s = createSync({ store: memoryStore(), isOnline: () => true, push })

    await s.submitAttempt(attempt('a1'))
    await s.flush()
    const second = await s.flush()

    expect(second.accepted).toEqual([])
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('flushing an empty outbox is a no-op, not an error', async () => {
    await expect(sync.flush()).resolves.toEqual({ accepted: [], rejected: [], pending: 0 })
  })

  it('tells a subscriber the current status immediately, not only on the next change', async () => {
    const seen: number[] = []
    sync.subscribe((status) => seen.push(status.pending))
    await sync.submitAttempt(attempt('a1'))
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
  })

  it('sign-out clears the local cache and the outbox', async () => {
    // Ticket 21: this protects a learner on a shared machine. A reload is not a sign-out, so
    // requirement §8.9 is unaffected — that is asserted in the ProgressStore suite.
    const store = memoryStore()
    const s = createSync({ store, isOnline: () => false })

    await s.submitAttempt(attempt('a1'))
    await s.signOut()

    expect(s.status().pending).toBe(0)
    await expect(store.load()).resolves.toBe('empty')
  })
})
