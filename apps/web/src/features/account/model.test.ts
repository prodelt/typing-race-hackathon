import { describe, expect, it } from 'vitest'
import type { SyncStatus } from '../../sync/index.js'
import {
  accountKind,
  classifyAuthError,
  cleanAuthUrl,
  deleteStep,
  initialOf,
  parseAuthReturn,
  type SignOutState,
  signInMethod,
  signOutStep,
  syncWord,
} from './model'

const ORIGIN = 'https://typing-race.example'

describe('parseAuthReturn', () => {
  it('reads an authorization code from the query', () => {
    expect(parseAuthReturn(`${ORIGIN}/?code=abc-123`)).toEqual({ kind: 'code', code: 'abc-123' })
  })

  it('reads an error from the query, the 422 of a second device included', () => {
    const href = `${ORIGIN}/?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user`
    expect(parseAuthReturn(href)).toEqual({
      kind: 'error',
      error: 'server_error',
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    })
  })

  it('reads an error from the fragment', () => {
    const href = `${ORIGIN}/#error=access_denied&error_description=The+user+denied`
    expect(parseAuthReturn(href)).toMatchObject({ kind: 'error', error: 'access_denied' })
  })

  it('prefers an error over a code', () => {
    expect(parseAuthReturn(`${ORIGIN}/?code=x&error=server_error`).kind).toBe('error')
  })

  it('ignores an ordinary address', () => {
    expect(parseAuthReturn(`${ORIGIN}/exercise/qwerty.run.anchors?mode=practice`)).toEqual({
      kind: 'none',
    })
    expect(parseAuthReturn(`${ORIGIN}/about#licences`)).toEqual({ kind: 'none' })
    expect(parseAuthReturn(`${ORIGIN}/?code=`)).toEqual({ kind: 'none' })
  })
})

describe('cleanAuthUrl', () => {
  it('drops every auth parameter and keeps the rest', () => {
    expect(cleanAuthUrl(`${ORIGIN}/races?code=abc&tab=quick&state=s`, null)).toBe(
      '/races?tab=quick',
    )
  })

  it('drops tokens from the fragment', () => {
    expect(cleanAuthUrl(`${ORIGIN}/#access_token=t&refresh_token=r&expires_in=3600`, null)).toBe(
      '/',
    )
    expect(cleanAuthUrl(`${ORIGIN}/?error=x&error_code=y&error_description=z`, null)).toBe('/')
  })

  it('returns to the remembered in-app path', () => {
    expect(cleanAuthUrl(`${ORIGIN}/?code=abc`, '/profile')).toBe('/profile')
    expect(cleanAuthUrl(`${ORIGIN}/?code=abc`, '/races?tab=quick')).toBe('/races?tab=quick')
  })

  it('never returns to another origin', () => {
    expect(cleanAuthUrl(`${ORIGIN}/?code=abc`, '//evil.example/x')).toBe('/')
    expect(cleanAuthUrl(`${ORIGIN}/?code=abc`, 'https://evil.example/x')).toBe('/')
  })
})

describe('classifyAuthError', () => {
  const error = (over: { error?: string; code?: string; description?: string }) => ({
    kind: 'error' as const,
    error: over.error ?? null,
    code: over.code ?? null,
    description: over.description ?? null,
  })

  it('recognises the second-device 422', () => {
    expect(classifyAuthError(error({ code: 'identity_already_exists' }))).toBe('identity-taken')
    expect(
      classifyAuthError(error({ description: 'Identity is already linked to another user' })),
    ).toBe('identity-taken')
  })

  it('treats a declined consent as a cancel, not a failure', () => {
    expect(classifyAuthError(error({ error: 'access_denied' }))).toBe('cancelled')
  })

  it('calls everything else a failure', () => {
    expect(classifyAuthError(error({ error: 'server_error', code: 'unexpected_failure' }))).toBe(
      'failed',
    )
  })
})

describe('signInMethod', () => {
  it('signs in directly when nobody is signed in: no anonymous user is made to be linked', () => {
    expect(signInMethod({ hasSession: false, isAnonymous: false })).toBe('oauth')
  })

  it('links Google to an existing guest, keeping its id', () => {
    expect(signInMethod({ hasSession: true, isAnonymous: true })).toBe('link')
  })

  it('does nothing for an account that is already signed in', () => {
    expect(signInMethod({ hasSession: true, isAnonymous: false })).toBe('already')
  })
})

describe('accountKind', () => {
  it('tells a guest, an anonymous racer and a Google account apart', () => {
    expect(accountKind(null)).toBe('guest')
    expect(accountKind({ is_anonymous: true, identities: [] })).toBe('anonymous')
    expect(
      accountKind({ is_anonymous: false, identities: [{ provider: 'google' }], email: 'a@b.c' }),
    ).toBe('google')
    // A linked guest keeps its id; its user now carries the Google identity.
    expect(accountKind({ is_anonymous: true, app_metadata: { providers: ['google'] } })).toBe(
      'google',
    )
  })
})

describe('initialOf', () => {
  it('is the first letter, upper-cased, including Cyrillic', () => {
    expect(initialOf('олеся_к')).toBe('О')
    expect(initialOf('  typist')).toBe('T')
    expect(initialOf('')).toBe('?')
  })
})

describe('syncWord', () => {
  const status = (over: Partial<SyncStatus>): SyncStatus => ({
    connected: true,
    phase: 'idle',
    online: true,
    pending: 0,
    lastSyncAt: 1000,
    lastRejections: [],
    ...over,
  })

  it('says off without an account, and offline before anything else', () => {
    expect(syncWord(status({ connected: false, phase: 'off' }))).toEqual({ kind: 'off' })
    expect(syncWord(status({ online: false, pending: 2 }))).toEqual({
      kind: 'offline',
      pending: 2,
    })
  })

  it('reports syncing, errors and queued attempts', () => {
    expect(syncWord(status({ phase: 'syncing' }))).toEqual({ kind: 'syncing' })
    expect(syncWord(status({ phase: 'error', pending: 3 }))).toEqual({ kind: 'error', pending: 3 })
    expect(syncWord(status({ pending: 1 }))).toEqual({ kind: 'pending', pending: 1 })
  })

  it('is synced with the time of the last sync', () => {
    expect(syncWord(status({}))).toEqual({ kind: 'synced', at: 1000 })
  })
})

describe('signOutStep', () => {
  const run = (events: Parameters<typeof signOutStep>[1][]): SignOutState =>
    events.reduce(signOutStep, { step: 'idle' } as SignOutState)

  it('wipes, then signs out', () => {
    expect(run([{ type: 'start' }])).toEqual({ step: 'saving' })
    expect(run([{ type: 'start' }, { type: 'wipe', result: 'wiped' }])).toEqual({
      step: 'signing-out',
    })
    expect(
      run([{ type: 'start' }, { type: 'wipe', result: 'wiped' }, { type: 'signed-out' }]),
    ).toEqual({ step: 'done' })
  })

  it('stops at pending attempts, and may retry or stay signed in', () => {
    const pending = run([{ type: 'start' }, { type: 'wipe', result: 'pending' }])
    expect(pending).toEqual({ step: 'pending' })
    expect(signOutStep(pending, { type: 'retry' })).toEqual({ step: 'saving' })
    expect(signOutStep(pending, { type: 'cancel' })).toEqual({ step: 'idle' })
    // A pending state never signs out by itself.
    expect(signOutStep(pending, { type: 'signed-out' })).toEqual(pending)
  })

  it('reports a failure and lets the learner try again', () => {
    const failed = run([{ type: 'start' }, { type: 'error' }])
    expect(failed).toEqual({ step: 'failed' })
    expect(signOutStep(failed, { type: 'retry' })).toEqual({ step: 'saving' })
  })

  it('ignores a second start while one is running', () => {
    expect(run([{ type: 'start' }, { type: 'start' }])).toEqual({ step: 'saving' })
  })
})

describe('deleteStep', () => {
  it('asks first, deletes only on the confirm', () => {
    const asking = deleteStep({ step: 'idle' }, { type: 'ask' })
    expect(asking).toEqual({ step: 'asking' })
    // A stray confirm without the question is ignored.
    expect(deleteStep({ step: 'idle' }, { type: 'confirm' })).toEqual({ step: 'idle' })
    const deleting = deleteStep(asking, { type: 'confirm' })
    expect(deleting).toEqual({ step: 'deleting' })
    expect(deleteStep(deleting, { type: 'deleted' })).toEqual({ step: 'done' })
  })

  it('cannot be cancelled mid-request, and a failure can be retried or dropped', () => {
    const deleting = { step: 'deleting' } as const
    expect(deleteStep(deleting, { type: 'cancel' })).toEqual(deleting)
    const failed = deleteStep(deleting, { type: 'error' })
    expect(failed).toEqual({ step: 'failed' })
    expect(deleteStep(failed, { type: 'confirm' })).toEqual({ step: 'deleting' })
    expect(deleteStep(failed, { type: 'cancel' })).toEqual({ step: 'idle' })
  })
})
