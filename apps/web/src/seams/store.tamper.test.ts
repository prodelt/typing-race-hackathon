import 'fake-indexeddb/auto'

import { STORE_VERSION } from '@typing-race/domain'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  emptyEnvelope,
  indexedDbStore,
  isReadableAttempt,
  readableSettings,
} from './store.js'

/**
 * What the store hands the app when the stored envelope holds attempts the app did not write: an
 * older build's, a half-written one, or one edited by hand. The app must start, and must keep the
 * attempts that are fine.
 */

const good = {
  id: 'a1',
  scaleId: 'yq.run.anchors',
  layoutId: 'yq',
  language: 'uk',
  mode: 'test',
  seed: 1,
  startedAt: 1,
  completedAt: 2,
  elapsedMs: 1,
  metrics: { spm: 100, accuracy: 0.97 },
  aggregates: { keys: {}, transitions: {} },
}

async function loadWith(attempts: unknown, rest: Record<string, unknown> = {}) {
  const databaseName = `tamper-${Math.random()}`
  const database = await openDB(databaseName, 1, {
    upgrade: (db) => {
      db.createObjectStore('envelope')
    },
  })
  await database.put(
    'envelope',
    { ...emptyEnvelope(1), storeVersion: STORE_VERSION, attempts, ...rest },
    'current',
  )
  database.close()
  return indexedDbStore({ databaseName }).load()
}

describe('a stored envelope the page did not write', () => {
  it('keeps a well-formed attempt', async () => {
    const loaded = await loadWith([good])
    expect(typeof loaded === 'object' && loaded.attempts).toHaveLength(1)
  })

  it.each([
    ['a bare id and scale', { id: 'a', scaleId: 'x' }],
    ['no metrics', { ...good, metrics: undefined }],
    ['metrics that are null', { ...good, metrics: null }],
    ['an id that is a number', { ...good, id: 1 }],
    ['an id a megabyte long', { ...good, id: 'x'.repeat(1_000_000) }],
    ['a scale id a megabyte long', { ...good, scaleId: 'x'.repeat(1_000_000) }],
    ['a layout that does not exist', { ...good, layoutId: '__proto__' }],
    ['a time that is not a number', { ...good, completedAt: 'tomorrow' }],
    ['aggregates that are not objects', { ...good, aggregates: [] }],
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
  ])('leaves out an attempt with %s, and keeps the good one beside it', async (_label, bad) => {
    const loaded = await loadWith([bad, good])
    expect(typeof loaded === 'object' && loaded.attempts.map((a) => a.id)).toEqual(['a1'])
  })

  it('reads attempts that are not a list as no attempts', async () => {
    for (const attempts of ['many', 7, { 0: good }, null]) {
      const loaded = await loadWith(attempts)
      expect(typeof loaded === 'object' && loaded.attempts).toEqual([])
    }
  })

  it('decides by shape, so an own __proto__ key is just a key', () => {
    const hostile = JSON.parse('{"id":"a","__proto__":{"polluted":"yes"}}')
    expect(isReadableAttempt(hostile)).toBe(false)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('puts every setting back in range', async () => {
    const loaded = await loadWith([], {
      settings: {
        theme: '<script>',
        motion: {},
        sound: 1,
        textSizePx: 1e9,
        errorMode: 'x',
        typingLanguage: 'xx',
        layoutId: '__proto__',
        interfaceLanguage: 'constructor',
      },
    })
    expect(typeof loaded === 'object' && loaded.settings).toEqual({
      ...DEFAULT_SETTINGS,
      textSizePx: 40,
    })
  })

  it('keeps settings that are fine, clamps the size, and survives settings that are not an object', () => {
    expect(readableSettings({ ...DEFAULT_SETTINGS, theme: 'dark', textSizePx: 30 })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      textSizePx: 30,
    })
    expect(readableSettings({ textSizePx: 3 }).textSizePx).toBe(24)
    for (const value of [null, 'x', 7, [], undefined]) {
      expect(readableSettings(value)).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('drops starting levels that are not levels, and records that are not records', async () => {
    const loaded = await loadWith([], {
      startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'expert', xx: 'knowsHomeRow' },
      progressByLanguage: 'x',
      logs: 7,
    })
    expect(typeof loaded === 'object' && loaded.startingLevelByLanguage).toEqual({
      uk: 'neverTouchTyped',
    })
    expect(typeof loaded === 'object' && loaded.progressByLanguage).toEqual({})
    expect(typeof loaded === 'object' && loaded.logs).toEqual({})
  })
})
