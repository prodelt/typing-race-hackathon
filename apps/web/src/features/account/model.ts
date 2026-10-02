import type { SyncStatus } from '../../sync/index.js'

/**
 * The Account's decisions, kept pure so they are tested without a browser or a backend: what an
 * OAuth return carries and what the URL looks like once it is cleaned, how Google sign-in should
 * start, what a failed return means for the learner, what the sync status says in words, and the
 * small state machines of sign-out and "delete my data".
 */

// ---- The OAuth return ----------------------------------------------------------------------

/** Where the learner was when they left for Google (sessionStorage), read back on the return. */
export const RETURN_TO_KEY = 'typing-race:auth-return-to'

/** Query and fragment parameters an OAuth return may carry. None may stay in the history. */
export const AUTH_PARAMS = [
  'code',
  'state',
  'error',
  'error_code',
  'error_description',
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'provider_token',
  'provider_refresh_token',
  'token_type',
] as const

export type AuthReturn =
  | { readonly kind: 'none' }
  | { readonly kind: 'code'; readonly code: string }
  | {
      readonly kind: 'error'
      readonly error: string | null
      readonly code: string | null
      readonly description: string | null
    }

function readParams(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search)
  // An implicit-flow or error return puts its parameters in the fragment instead.
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (hash.includes('=')) {
    for (const [key, value] of new URLSearchParams(hash)) {
      if (!merged.has(key)) merged.set(key, value)
    }
  }
  return merged
}

/** What the page was opened with: an authorization code, an error, or nothing to do with auth. */
export function parseAuthReturn(href: string): AuthReturn {
  const params = readParams(new URL(href))
  const error = params.get('error')
  const errorCode = params.get('error_code')
  const description = params.get('error_description')
  if (error !== null || errorCode !== null || description !== null) {
    return { kind: 'error', error, code: errorCode, description }
  }
  const code = params.get('code')
  if (code !== null && code !== '') return { kind: 'code', code }
  return { kind: 'none' }
}

/**
 * The address to replace the OAuth return with: the in-app path the learner left from, when it was
 * remembered and is a same-origin path, or else the current address without any auth parameter.
 */
export function cleanAuthUrl(href: string, returnTo: string | null): string {
  const url = new URL(href)
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    const back = new URL(returnTo, url.origin)
    if (back.origin === url.origin) return `${back.pathname}${back.search}${back.hash}`
  }
  for (const key of AUTH_PARAMS) url.searchParams.delete(key)
  let hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (hash.includes('=')) {
    const fragment = new URLSearchParams(hash)
    for (const key of AUTH_PARAMS) fragment.delete(key)
    hash = fragment.toString()
  }
  return `${url.pathname}${url.search}${hash === '' ? '' : `#${hash}`}`
}

/** What a failed return means for the learner. */
export type AuthFailure = 'identity-taken' | 'cancelled' | 'failed'

/**
 * `identity-taken` is the second-device case (ADR-0006): the Google account already belongs to
 * another user, so it cannot be linked to this browser's guest. Supabase answers 422 with
 * `identity_already_exists`, which reaches us on the redirect as `error_code`.
 */
export function classifyAuthError(failure: Extract<AuthReturn, { kind: 'error' }>): AuthFailure {
  if (failure.code === 'identity_already_exists') return 'identity-taken'
  if (/already (linked|registered|exists)/i.test(failure.description ?? '')) return 'identity-taken'
  if (failure.error === 'access_denied' || failure.code === 'access_denied') return 'cancelled'
  return 'failed'
}

// ---- Starting a sign-in --------------------------------------------------------------------

export interface SessionFacts {
  /** A Supabase session exists in this browser. */
  readonly hasSession: boolean
  /** That session's user has no identity other than the anonymous one. */
  readonly isAnonymous: boolean
}

/**
 * `link`: a guest exists (the first race made one), so Google is attached to it and its id, nick
 * and races stay. `oauth`: nobody is signed in, so Google signs in (or up) directly — no anonymous
 * user is ever made just to be linked. `already`: there is nothing to do.
 */
export function signInMethod(facts: SessionFacts): 'link' | 'oauth' | 'already' {
  if (!facts.hasSession) return 'oauth'
  return facts.isAnonymous ? 'link' : 'already'
}

// ---- Who is signed in ----------------------------------------------------------------------

export type AccountKind = 'guest' | 'anonymous' | 'google'

/** The parts of a Supabase user the account cares about. */
export interface UserFacts {
  readonly is_anonymous?: boolean
  readonly email?: string | null
  readonly identities?: readonly { readonly provider: string }[] | null
  readonly app_metadata?: { readonly provider?: string; readonly providers?: readonly string[] }
}

export function accountKind(user: UserFacts | null | undefined): AccountKind {
  if (user === null || user === undefined) return 'guest'
  const providers = new Set([
    ...(user.identities ?? []).map((identity) => identity.provider),
    ...(user.app_metadata?.providers ?? []),
  ])
  if (providers.has('google')) return 'google'
  return user.is_anonymous === false && providers.size > 0 ? 'google' : 'anonymous'
}

/** The first letter of a nick, for the round avatar; never a picture from Google. */
export function initialOf(nick: string): string {
  const first = [...nick.trim()][0]
  return first === undefined ? '?' : first.toLocaleUpperCase('uk-UA')
}

// ---- Sync, in words -----------------------------------------------------------------------

export type SyncWord =
  | { readonly kind: 'off' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'offline'; readonly pending: number }
  | { readonly kind: 'error'; readonly pending: number }
  | { readonly kind: 'pending'; readonly pending: number }
  | { readonly kind: 'synced'; readonly at: number | null }

/** One state for the chip and the Account section, most urgent first. */
export function syncWord(status: SyncStatus): SyncWord {
  if (!status.connected) return { kind: 'off' }
  if (!status.online) return { kind: 'offline', pending: status.pending }
  if (status.phase === 'syncing') return { kind: 'syncing' }
  if (status.phase === 'error') return { kind: 'error', pending: status.pending }
  if (status.pending > 0) return { kind: 'pending', pending: status.pending }
  return { kind: 'synced', at: status.lastSyncAt }
}

// ---- Sign-out -----------------------------------------------------------------------------

/**
 * Sign-out (ADR-0006): the outbox is flushed and the local copy wiped only when nothing is left to
 * upload; then the session ends. With attempts still unsynced nothing is touched: the learner is
 * told, and may retry or stay signed in.
 */
export type SignOutState =
  | { readonly step: 'idle' }
  | { readonly step: 'saving' }
  | { readonly step: 'pending' }
  | { readonly step: 'signing-out' }
  | { readonly step: 'done' }
  | { readonly step: 'failed' }

export type SignOutEvent =
  | { readonly type: 'start' }
  | { readonly type: 'wipe'; readonly result: 'wiped' | 'pending' }
  | { readonly type: 'signed-out' }
  | { readonly type: 'error' }
  | { readonly type: 'retry' }
  | { readonly type: 'cancel' }

export function signOutStep(state: SignOutState, event: SignOutEvent): SignOutState {
  switch (event.type) {
    case 'start':
      return state.step === 'idle' || state.step === 'failed' ? { step: 'saving' } : state
    case 'retry':
      return state.step === 'pending' || state.step === 'failed' ? { step: 'saving' } : state
    case 'wipe':
      if (state.step !== 'saving') return state
      return event.result === 'wiped' ? { step: 'signing-out' } : { step: 'pending' }
    case 'signed-out':
      return state.step === 'signing-out' ? { step: 'done' } : state
    case 'error':
      return state.step === 'saving' || state.step === 'signing-out' ? { step: 'failed' } : state
    case 'cancel':
      return state.step === 'pending' || state.step === 'failed' ? { step: 'idle' } : state
  }
}

// ---- Delete my data ------------------------------------------------------------------------

/** Two deliberate steps — ask, then confirm — before anything is deleted. */
export type DeleteState =
  | { readonly step: 'idle' }
  | { readonly step: 'asking' }
  | { readonly step: 'deleting' }
  | { readonly step: 'done' }
  | { readonly step: 'failed' }

export type DeleteEvent =
  | { readonly type: 'ask' }
  | { readonly type: 'confirm' }
  | { readonly type: 'deleted' }
  | { readonly type: 'error' }
  | { readonly type: 'cancel' }

export function deleteStep(state: DeleteState, event: DeleteEvent): DeleteState {
  switch (event.type) {
    case 'ask':
      return state.step === 'idle' ? { step: 'asking' } : state
    case 'confirm':
      return state.step === 'asking' || state.step === 'failed' ? { step: 'deleting' } : state
    case 'deleted':
      return state.step === 'deleting' ? { step: 'done' } : state
    case 'error':
      return state.step === 'deleting' ? { step: 'failed' } : state
    case 'cancel':
      return state.step === 'deleting' ? state : { step: 'idle' }
  }
}
