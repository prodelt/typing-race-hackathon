import type { Attempt } from '@typing-race/domain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryOutbox } from '../../seams/outbox.js'
import { DEFAULT_SETTINGS, memoryStore } from '../../seams/store.js'
import { appSync, type Remote } from '../../sync/index.js'
import { initialState } from './reduce.js'
import { setProgressStore, useAppStore } from './store.js'

/**
 * The app store wired to the sync engine: what a learner sees after the cloud history unions in,
 * or after a sign-out wipe. The engine's own rules are in `sync/*.test.ts`; this is the seam.
 */

function attempt(id: string, completedAt: number): Attempt {
  return {
    id,
    scaleId: 'yq.run.KeyG',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    text: 'фіва',
    seed: 1,
    startedAt: completedAt - 5_000,
    completedAt,
    elapsedMs: 5_000,
    metrics: {
      spm: 200,
      wpm: 40,
      accuracy: 1,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
    log: { formatVersion: 1, dt: [0], kind: ['char'], char: ['ф'], correct: [true] },
  }
}

function cloudWith(attempts: Attempt[]): Remote & { uploaded: string[] } {
  const uploaded: string[] = []
  return {
    uploaded,
    async push(batch) {
      uploaded.push(...batch.map((a) => a.id))
      return { accepted: batch.map((a) => a.id), rejected: [] }
    },
    pull: async () => attempts.map((a) => ({ ...a, text: '', log: null })),
    settings: async () => null,
    saveSettings: async () => {},
    nick: async () => 'Гість-0001',
    setNick: async (nick) => nick,
  }
}

async function learner(attempts: Attempt[] = []) {
  setProgressStore(
    memoryStore({
      settings: DEFAULT_SETTINGS,
      startingLevelByLanguage: { uk: 'neverTouchTyped' },
      attempts,
    }),
    memoryOutbox(),
  )
  useAppStore.setState(initialState)
  await useAppStore.getState().boot()
}

afterEach(() => {
  appSync().disconnect()
})

describe('app store × sync', () => {
  it('shows the cloud history once it unions in: derived state recomputes', async () => {
    await learner([attempt('here', 1_000)])
    await appSync().connect(cloudWith([attempt('there', 2_000)]))

    await vi.waitFor(() =>
      expect(useAppStore.getState().attempts.map((a) => a.id)).toEqual(['here', 'there']),
    )
  })

  it('uploads a finished attempt once an account is connected', async () => {
    await learner()
    const cloud = cloudWith([])
    await appSync().connect(cloud)
    await useAppStore.getState().finishAttempt(attempt('typed', 3_000))

    await vi.waitFor(() => expect(cloud.uploaded).toEqual(['typed']))
  })

  it('queues a finished attempt without an account, and touches no remote', async () => {
    await learner()
    await useAppStore.getState().finishAttempt(attempt('typed', 3_000))

    expect(appSync().status()).toMatchObject({ connected: false, pending: 1 })
  })

  it('a sign-out wipe resets the learner on screen', async () => {
    await learner([attempt('here', 1_000)])
    await appSync().connect(cloudWith([]))

    expect(await appSync().wipeLocalIfSynced()).toBe('wiped')
    await vi.waitFor(() => expect(useAppStore.getState().attempts).toEqual([]))
  })
})
