import 'fake-indexeddb/auto'

import type { Attempt } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { indexedDbOutbox, memoryOutbox, type OutboxStore } from './outbox.js'

/**
 * The outbox: completed attempts waiting for the server. One suite, two adapters, plus the one
 * property only the real adapter can have — it survives a reload.
 */

function attempt(id: string): Attempt {
  return {
    id,
    scaleId: 'yq.run.KeyG',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    text: 'фі',
    seed: 1,
    startedAt: 0,
    completedAt: 1_000,
    elapsedMs: 1_000,
    metrics: {
      spm: 120,
      wpm: 24,
      accuracy: 1,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
    log: {
      formatVersion: 1,
      dt: [0, 400],
      kind: ['char', 'char'],
      char: ['ф', 'і'],
      correct: [true, true],
    },
  }
}

let databases = 0
const adapters: Record<string, () => OutboxStore> = {
  memory: () => memoryOutbox(),
  indexedDb: () => indexedDbOutbox({ databaseName: `outbox-test-${databases++}` }),
}

for (const [name, make] of Object.entries(adapters)) {
  describe(`outbox — ${name}`, () => {
    it('keeps a queued attempt whole, text and log included, until it is removed', async () => {
      const outbox = make()
      await outbox.put(attempt('a1'))
      await outbox.put(attempt('a2'))
      expect((await outbox.all()).map((a) => a.id).sort()).toEqual(['a1', 'a2'])
      expect((await outbox.all())[0]?.text).toBe('фі')

      await outbox.remove(['a1'])
      expect((await outbox.all()).map((a) => a.id)).toEqual(['a2'])
    })

    it('queues an attempt once however often it is put', async () => {
      const outbox = make()
      await outbox.put(attempt('a1'))
      await outbox.put(attempt('a1'))
      expect(await outbox.all()).toHaveLength(1)
    })
  })
}

describe('outbox — indexedDb', () => {
  it('survives a reload', async () => {
    await indexedDbOutbox({ databaseName: 'outbox-reload' }).put(attempt('a1'))
    const afterReload = indexedDbOutbox({ databaseName: 'outbox-reload' })
    expect((await afterReload.all()).map((a) => a.id)).toEqual(['a1'])
  })
})
