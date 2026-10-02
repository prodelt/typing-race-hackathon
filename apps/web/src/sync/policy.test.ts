import { describe, expect, it } from 'vitest'
import {
  batches,
  FIRST_RETRY_MS,
  MAX_RETRY_MS,
  missingFrom,
  resolveSettings,
  retryDelay,
  settleUpload,
} from './policy.js'

/** The pure rules under the sync engine: no store, no network, no clock. */

describe('retryDelay — the backoff schedule', () => {
  it('doubles from the first retry', () => {
    expect([0, 1, 2, 3].map((failures) => retryDelay(failures))).toEqual([
      FIRST_RETRY_MS,
      FIRST_RETRY_MS * 2,
      FIRST_RETRY_MS * 4,
      FIRST_RETRY_MS * 8,
    ])
  })

  it('never waits longer than the cap, however long the outage', () => {
    expect(retryDelay(30)).toBe(MAX_RETRY_MS)
    expect(retryDelay(1_000)).toBe(MAX_RETRY_MS)
  })

  it('waits at least as long as the server asked (a rate limit)', () => {
    expect(retryDelay(0, 600_000)).toBe(600_000)
    // A short Retry-After never shortens the schedule.
    expect(retryDelay(3, 1_000)).toBe(FIRST_RETRY_MS * 8)
  })
})

describe('missingFrom — the union of attempts', () => {
  const ids = (...list: string[]) => list.map((id) => ({ id }))

  it('keeps only the cloud attempts the device does not have', () => {
    expect(missingFrom(ids('a', 'b'), ids('b', 'c', 'd'))).toEqual(ids('c', 'd'))
  })

  it('is empty when the device already has everything', () => {
    expect(missingFrom(ids('a', 'b'), ids('b', 'a'))).toEqual([])
  })

  it('counts an attempt the cloud lists twice once', () => {
    expect(missingFrom([], ids('c', 'c'))).toEqual(ids('c'))
  })
})

describe('resolveSettings — last write wins by updatedAt', () => {
  const local = { settings: 'local', updatedAt: 200 }
  const cloud = { settings: 'cloud', updatedAt: 100 }

  it('pushes the local copy when it is newer', () => {
    expect(resolveSettings(local, cloud)).toBe('push')
  })

  it('takes the cloud copy when it is newer', () => {
    expect(resolveSettings({ ...local, updatedAt: 50 }, cloud)).toBe('take')
  })

  it('does nothing on a tie', () => {
    expect(resolveSettings({ ...local, updatedAt: 100 }, cloud)).toBe('keep')
  })

  it('pushes a stamped local copy to an account that has none', () => {
    expect(resolveSettings(local, null)).toBe('push')
  })

  it('never pushes settings that were never changed (no stamp)', () => {
    expect(resolveSettings({ ...local, updatedAt: 0 }, null)).toBe('keep')
  })

  it('takes the cloud copy onto a device that has none', () => {
    expect(resolveSettings(null, cloud)).toBe('take')
  })
})

describe('batches', () => {
  it('splits a long outbox into requests of at most the given size', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('is no requests at all for an empty outbox', () => {
    expect(batches([], 50)).toEqual([])
  })
})

describe('settleUpload — what leaves the outbox after a reply', () => {
  it('removes accepted attempts', () => {
    expect(settleUpload({ accepted: ['a', 'b'], rejected: [] })).toEqual(['a', 'b'])
  })

  it('removes refused attempts: the server would refuse them forever', () => {
    expect(settleUpload({ accepted: ['a'], rejected: [{ id: 'b', reason: 'too_fast' }] })).toEqual([
      'a',
      'b',
    ])
  })

  it('keeps an attempt whose exercise the server does not know yet (an older deploy)', () => {
    expect(
      settleUpload({ accepted: [], rejected: [{ id: 'b', reason: 'unknown_scale' }] }),
    ).toEqual([])
  })
})
