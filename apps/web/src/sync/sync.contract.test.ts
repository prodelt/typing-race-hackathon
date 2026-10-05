import type { Attempt, AttemptMetrics, Settings } from '@typing-race/domain'
import { describe, expect, it, vi } from 'vitest'
import type { ProgressStore } from '../seams/index.js'
import { memoryOutbox } from '../seams/outbox.js'
import { DEFAULT_SETTINGS, memoryStore } from '../seams/store.js'
import {
  createSync,
  NickError,
  type Rejection,
  type Remote,
  RemoteError,
  type StampedSettings,
  UPLOAD_BATCH,
} from './index.js'

/**
 * The sync engine (ADR-0006), driven through its interface against an in-memory cloud.
 *
 * The cloud below behaves as `submit-attempt` and the tables do: an upload is idempotent by attempt
 * id, a pull returns every attempt of the account, and the attempt that comes back has lost its
 * text (the server keeps none) — exactly what a real round trip does.
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

interface FakeCloud {
  readonly attempts: Map<string, Attempt>
  settings: StampedSettings | null
  nick: string
  /** Set to make the next requests fail as a dropped connection would. */
  down: boolean
  readonly pushes: Attempt[][]
  remote(): Remote
}

function fakeCloud(): FakeCloud {
  const cloud: FakeCloud = {
    attempts: new Map(),
    settings: null,
    nick: 'typist-1234',
    down: false,
    pushes: [],
    remote() {
      const reachable = () => {
        if (cloud.down) throw new Error('network down')
      }
      return {
        async push(attempts) {
          reachable()
          cloud.pushes.push([...attempts])
          // `on conflict do nothing`: a second copy of an id is accepted and changes nothing.
          for (const a of attempts) if (!cloud.attempts.has(a.id)) cloud.attempts.set(a.id, a)
          return { accepted: attempts.map((a) => a.id), rejected: [] as Rejection[] }
        },
        async pull() {
          reachable()
          return [...cloud.attempts.values()].map((a) => ({ ...a, text: '' }))
        },
        async settings() {
          reachable()
          return cloud.settings
        },
        async saveSettings(stamped) {
          reachable()
          cloud.settings = stamped
        },
        async nick() {
          reachable()
          return cloud.nick
        },
        async setNick(nick) {
          reachable()
          cloud.nick = nick
          return nick
        },
      }
    },
  }
  return cloud
}

async function localIds(store: ProgressStore): Promise<string[]> {
  const loaded = await store.load()
  if (typeof loaded === 'string') return []
  return loaded.attempts.map((a) => a.id)
}

async function localSettings(store: ProgressStore) {
  const loaded = await store.load()
  if (typeof loaded === 'string') throw new Error('expected an envelope')
  return { settings: loaded.settings, updatedAt: loaded.settingsUpdatedAt }
}

function device(options: { store?: ProgressStore; online?: () => boolean } = {}) {
  const store = options.store ?? memoryStore()
  const outbox = memoryOutbox()
  const onLocalChanged = vi.fn()
  const sync = createSync({
    store,
    outbox,
    isOnline: options.online ?? (() => true),
    onOnline: () => () => {},
    schedule: () => () => {},
    onLocalChanged,
  })
  return { store, outbox, sync, onLocalChanged }
}

describe('sync — union of attempts', () => {
  it('unions disjoint histories: each device ends with both', async () => {
    const cloud = fakeCloud()
    const a = device()
    const b = device()
    await a.sync.submitAttempt(attempt('a1', 1_000))
    await b.sync.submitAttempt(attempt('b1', 2_000))

    await a.sync.connect(cloud.remote())
    await b.sync.connect(cloud.remote())
    await a.sync.syncNow()

    expect(await localIds(a.store)).toEqual(['a1', 'b1'])
    expect(await localIds(b.store)).toEqual(['a1', 'b1'])
    expect([...cloud.attempts.keys()].sort()).toEqual(['a1', 'b1'])
  })

  it('unions overlapping histories without counting the shared attempt twice', async () => {
    const cloud = fakeCloud()
    cloud.attempts.set('shared', attempt('shared', 1_000))
    cloud.attempts.set('cloud-only', attempt('cloud-only', 3_000))
    const a = device()
    await a.sync.submitAttempt(attempt('shared', 1_000))
    await a.sync.submitAttempt(attempt('local-only', 2_000))

    await a.sync.connect(cloud.remote())

    expect(await localIds(a.store)).toEqual(['shared', 'local-only', 'cloud-only'])
    expect(cloud.attempts.size).toBe(3)
  })

  it('leaves identical histories exactly as they were', async () => {
    const cloud = fakeCloud()
    cloud.attempts.set('x', attempt('x', 1_000))
    const a = device({ store: memoryStore() })
    await a.store.appendAttempts([attempt('x', 1_000)])
    const before = await a.store.load()

    await a.sync.connect(cloud.remote())

    const after = await a.store.load()
    if (typeof before === 'string' || typeof after === 'string') throw new Error('envelope')
    expect(after.attempts).toEqual(before.attempts)
    expect(cloud.attempts.size).toBe(1)
  })

  it('tells the application that local data changed, so derived state recomputes', async () => {
    const cloud = fakeCloud()
    cloud.attempts.set('c1', attempt('c1'))
    const a = device()
    await a.sync.connect(cloud.remote())
    expect(a.onLocalChanged).toHaveBeenCalled()
  })
})

describe('sync — the outbox', () => {
  it('re-uploading the same attempt is a no-op in the cloud', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.sync.submitAttempt(attempt('a1'))
    await a.sync.connect(cloud.remote())
    // The same attempt queued again, as a retry after a dropped response would.
    await a.outbox.put(attempt('a1'))
    await a.sync.flush()

    expect(cloud.pushes).toHaveLength(2)
    expect(cloud.attempts.size).toBe(1)
    expect(a.sync.status().pending).toBe(0)
  })

  it('queues while offline and flushes once online', async () => {
    let online = false
    const cloud = fakeCloud()
    let wake: () => void = () => {}
    const store = memoryStore()
    const outbox = memoryOutbox()
    const sync = createSync({
      store,
      outbox,
      isOnline: () => online,
      onOnline: (listener) => {
        wake = listener
        return () => {}
      },
      schedule: () => () => {},
    })
    await sync.connect(cloud.remote())
    await sync.submitAttempt(attempt('a1', 1_000))
    await sync.submitAttempt(attempt('a2', 2_000))
    expect(cloud.pushes).toHaveLength(0)
    expect(sync.status().pending).toBe(2)

    online = true
    wake()

    await vi.waitFor(() => expect(sync.status().pending).toBe(0))
    expect([...cloud.attempts.keys()].sort()).toEqual(['a1', 'a2'])
  })

  it('keeps an attempt queued when the upload fails, and retries with backoff', async () => {
    const cloud = fakeCloud()
    cloud.down = true
    const delays: number[] = []
    let retry: () => void = () => {}
    const sync = createSync({
      store: memoryStore(),
      outbox: memoryOutbox(),
      isOnline: () => true,
      onOnline: () => () => {},
      schedule: (fn, ms) => {
        delays.push(ms)
        retry = fn
        return () => {}
      },
    })
    await sync.connect(cloud.remote())
    await sync.submitAttempt(attempt('a1'))
    await vi.waitFor(() => expect(sync.status().phase).toBe('error'))
    expect(sync.status().pending).toBe(1)

    retry()
    await vi.waitFor(() => expect(delays.length).toBeGreaterThanOrEqual(2))
    // Each failure waits longer than the last.
    expect(delays[1]).toBeGreaterThan(delays[0] ?? 0)

    cloud.down = false
    retry()
    await vi.waitFor(() => expect(sync.status().pending).toBe(0))
    expect(sync.status().phase).toBe('idle')
  })

  it('uploads a long outbox in batches, and keeps what a failed batch did not send', async () => {
    const cloud = fakeCloud()
    const remote = cloud.remote()
    let calls = 0
    const flaky: Remote = {
      ...remote,
      async push(attempts) {
        calls += 1
        // The second request drops: the first batch is in the cloud, the rest still queued.
        if (calls === 2) throw new Error('network down')
        return remote.push(attempts)
      },
    }
    const a = device()
    const total = UPLOAD_BATCH * 2 + 3
    for (let i = 0; i < total; i += 1) await a.outbox.put(attempt(`a${i}`, 1_000 + i))

    await a.sync.connect(flaky)
    expect(cloud.pushes.every((batch) => batch.length <= UPLOAD_BATCH)).toBe(true)
    expect(cloud.attempts.size).toBe(UPLOAD_BATCH)
    expect(a.sync.status().pending).toBe(total - UPLOAD_BATCH)

    await a.sync.syncNow()
    expect(cloud.attempts.size).toBe(total)
    expect(a.sync.status().pending).toBe(0)
  })

  it('waits as long as a rate-limited server asks before retrying', async () => {
    const cloud = fakeCloud()
    const delays: number[] = []
    const limited: Remote = {
      ...cloud.remote(),
      push: async () => {
        throw new RemoteError('rate_limited', 600_000)
      },
    }
    const sync = createSync({
      store: memoryStore(),
      outbox: memoryOutbox([attempt('a1')]),
      isOnline: () => true,
      onOnline: () => () => {},
      schedule: (_fn, ms) => {
        delays.push(ms)
        return () => {}
      },
    })
    await sync.connect(limited)
    expect(sync.status().phase).toBe('error')
    expect(delays).toEqual([600_000])
    expect(sync.status().pending).toBe(1)
  })

  it('survives a reload: a new engine over the same outbox still uploads it', async () => {
    const outbox = memoryOutbox()
    const cloud = fakeCloud()
    const before = createSync({ store: memoryStore(), outbox, isOnline: () => false })
    await before.submitAttempt(attempt('a1'))

    const after = createSync({ store: memoryStore(), outbox, isOnline: () => true })
    await after.connect(cloud.remote())

    expect([...cloud.attempts.keys()]).toEqual(['a1'])
  })

  it('drops an attempt the server refused instead of retrying it forever', async () => {
    const cloud = fakeCloud()
    const remote = cloud.remote()
    const refusing: Remote = {
      ...remote,
      push: async (attempts) => ({
        accepted: [],
        rejected: attempts.map((a) => ({ id: a.id, reason: 'too_fast' as const })),
      }),
    }
    const a = device()
    await a.sync.submitAttempt(attempt('fast'))
    await a.sync.connect(refusing)
    expect(a.sync.status().pending).toBe(0)
    expect(a.sync.status().lastRejections).toEqual([{ id: 'fast', reason: 'too_fast' }])
  })

  it('keeps an attempt whose exercise the server does not know yet, rather than losing it', async () => {
    // An older server knows fewer exercise families. Its refusal says "not yet", not "never".
    const cloud = fakeCloud()
    const unaware: Remote = {
      ...cloud.remote(),
      push: async (attempts) => ({
        accepted: [],
        rejected: attempts.map((a) => ({ id: a.id, reason: 'unknown_scale' as const })),
      }),
    }
    const a = device()
    await a.sync.submitAttempt(attempt('words'))
    await a.sync.connect(unaware)
    expect(a.sync.status().pending).toBe(1)
  })

  it('still unions attempts when the settings half of a sync fails', async () => {
    const cloud = fakeCloud()
    cloud.attempts.set('c1', attempt('c1'))
    const broken: Remote = {
      ...cloud.remote(),
      settings: async () => {
        throw new Error('column profiles.settings does not exist')
      },
    }
    const a = device()
    await a.sync.connect(broken)
    expect(await localIds(a.store)).toEqual(['c1'])
    expect(a.onLocalChanged).toHaveBeenCalled()
  })

  it('never touches a remote while disconnected: training stays local', async () => {
    const a = device()
    await a.sync.submitAttempt(attempt('a1'))
    expect(await localIds(a.store)).toEqual(['a1'])
    expect(a.sync.status()).toMatchObject({ connected: false, pending: 1 })
    await expect(a.sync.flush()).resolves.toMatchObject({ accepted: [], pending: 1 })
  })

  it('keeps free practice local: a daily or own-text attempt is stored but never queued', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.sync.submitAttempt({ ...attempt('daily'), scaleId: 'yq.daily' })
    await a.sync.submitAttempt({ ...attempt('own'), scaleId: 'yq.owntext' })
    expect(await localIds(a.store)).toEqual(['daily', 'own'])
    expect(await a.outbox.all()).toEqual([])
    expect(a.sync.status().pending).toBe(0)
    await a.sync.connect(cloud.remote())
    expect(cloud.pushes).toEqual([])
  })

  it('drops free practice an older build queued, so sync never stays pending on it', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.outbox.put({ ...attempt('old-daily', 1_000), scaleId: 'yq.daily' })
    await a.outbox.put(attempt('a1', 2_000))
    await a.sync.connect(cloud.remote())
    expect([...cloud.attempts.keys()]).toEqual(['a1'])
    expect(await a.outbox.all()).toEqual([])
    expect(a.sync.status().pending).toBe(0)
  })

  it('does not count queued free practice as pending, even signed out', async () => {
    const a = device({ online: () => false })
    await a.outbox.put({ ...attempt('old-daily'), scaleId: 'qwerty.daily' })
    expect(await a.sync.wipeLocalIfSynced()).toBe('wiped')
    expect(await a.outbox.all()).toEqual([])
  })
})

describe('sync — settings, last write wins', () => {
  const dark: Settings = { ...DEFAULT_SETTINGS, theme: 'dark' }
  const big: Settings = { ...DEFAULT_SETTINGS, textSizePx: 36 }

  it('takes the cloud copy when it is newer', async () => {
    const cloud = fakeCloud()
    cloud.settings = { settings: dark, updatedAt: 5_000 }
    const a = device()
    await a.store.saveSettings(big, 1_000)

    await a.sync.connect(cloud.remote())

    expect(await localSettings(a.store)).toEqual({ settings: dark, updatedAt: 5_000 })
    expect(a.onLocalChanged).toHaveBeenCalled()
  })

  it('pushes the local copy when it is newer', async () => {
    const cloud = fakeCloud()
    cloud.settings = { settings: dark, updatedAt: 1_000 }
    const a = device()
    await a.store.saveSettings(big, 5_000)

    await a.sync.connect(cloud.remote())

    expect(cloud.settings).toEqual({ settings: big, updatedAt: 5_000 })
    expect(await localSettings(a.store)).toEqual({ settings: big, updatedAt: 5_000 })
  })

  it('pushes a change made while connected', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.sync.connect(cloud.remote())
    await a.store.saveSettings(dark, 9_000)
    await a.sync.settingsChanged()
    expect(cloud.settings).toEqual({ settings: dark, updatedAt: 9_000 })
  })
})

describe('sync — nick', () => {
  it('reads and writes the profile nick', async () => {
    const cloud = fakeCloud()
    const a = device()
    expect(await a.sync.nick()).toBeNull()
    await a.sync.connect(cloud.remote())
    expect(await a.sync.nick()).toBe('typist-1234')
    expect(await a.sync.setNick('Швидкий')).toBe('Швидкий')
    expect(cloud.nick).toBe('Швидкий')
  })

  it('trims a nick and refuses one outside 2 to 32 characters without asking the server', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.sync.connect(cloud.remote())
    expect(await a.sync.setNick('  Ліра  ')).toBe('Ліра')
    await expect(a.sync.setNick(' x ')).rejects.toMatchObject({ code: 'invalid' })
    await expect(a.sync.setNick('x'.repeat(33))).rejects.toBeInstanceOf(NickError)
    expect(cloud.nick).toBe('Ліра')
  })

  it('says plainly when there is no account to write the nick to', async () => {
    const a = device()
    await expect(a.sync.setNick('Ліра')).rejects.toMatchObject({ code: 'signed-out' })
  })
})

describe('sync — wipe on sign-out', () => {
  it('refuses to wipe while attempts are unsynced', async () => {
    const a = device({ online: () => false })
    await a.sync.submitAttempt(attempt('a1'))
    expect(await a.sync.wipeLocalIfSynced()).toBe('pending')
    expect(await localIds(a.store)).toEqual(['a1'])
  })

  it('wipes the local copy once everything is in the cloud', async () => {
    const cloud = fakeCloud()
    const a = device()
    await a.sync.submitAttempt(attempt('a1'))
    await a.sync.connect(cloud.remote())
    expect(await a.sync.wipeLocalIfSynced()).toBe('wiped')
    await expect(a.store.load()).resolves.toBe('empty')
    expect(a.onLocalChanged).toHaveBeenCalled()
  })

  it('wipes the other local learner data with the copy, and only once it is wiped', async () => {
    const forgetDeviceData = vi.fn()
    const store = memoryStore()
    const outbox = memoryOutbox()
    const sync = createSync({ store, outbox, isOnline: () => false, forgetDeviceData })
    await sync.submitAttempt(attempt('a1'))
    expect(await sync.wipeLocalIfSynced()).toBe('pending')
    expect(forgetDeviceData).not.toHaveBeenCalled()
    await outbox.remove(['a1'])
    expect(await sync.wipeLocalIfSynced()).toBe('wiped')
    expect(forgetDeviceData).toHaveBeenCalledOnce()
  })
})

describe('sync — forget after delete', () => {
  it('drops the outbox and the local copy unconditionally, and detaches', async () => {
    const cloud = fakeCloud()
    const a = device({ online: () => false })
    await a.sync.connect(cloud.remote())
    await a.sync.submitAttempt(attempt('a1'))
    expect(a.sync.status().pending).toBe(1)
    await a.sync.forgetLocal()
    await expect(a.store.load()).resolves.toBe('empty')
    expect(await a.outbox.all()).toEqual([])
    expect(a.sync.status()).toMatchObject({ connected: false, phase: 'off', pending: 0 })
    expect(a.onLocalChanged).toHaveBeenCalled()
  })

  it('forgets the other local learner data too', async () => {
    const forgetDeviceData = vi.fn()
    const sync = createSync({
      store: memoryStore(),
      outbox: memoryOutbox(),
      isOnline: () => false,
      forgetDeviceData,
    })
    await sync.forgetLocal()
    expect(forgetDeviceData).toHaveBeenCalledOnce()
  })
})
