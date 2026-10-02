import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { type SyncStatus, syncStatus } from '../../sync/index.js'
import type { AccountKind, AuthReturn } from './model.js'

/**
 * The Account as the status bar, the Profile and the Shell's dialogs see it.
 *
 * This module is in the initial bundle, so it never imports Supabase: every action below loads
 * `./auth.js` (and through it `@supabase/supabase-js`) only when it runs. A learner who never signs
 * in never downloads the client.
 *
 * The kind and the nick are cached per browser so the status bar does not flicker from «гість» to
 * the nick on every load. The Google email is held in memory only, and only the Profile's Account
 * section — which only the owner of this browser sees — ever shows it.
 */

/** What the learner is told after an OAuth return or an account action. */
export type AccountNotice =
  | 'identity-taken'
  | 'failed'
  | 'no-backend'
  | 'signed-in'
  | 'signed-out'
  | 'deleted'

export interface AccountState {
  /** `unknown` until the first read settles for a browser that has a session. */
  readonly kind: AccountKind | 'unknown'
  readonly nick: string | null
  /** The Google email: owner-only, never cached, never shown anywhere public. */
  readonly email: string | null
  /** Leaving for Google, or exchanging the code on the way back. */
  readonly busy: 'redirecting' | 'returning' | null
  readonly notice: AccountNotice | null
}

const CACHE_KEY = 'typing-race:account'
/** Where `sync/race.ts` keeps the Supabase session; its presence is all that is read eagerly. */
export const SESSION_KEY = 'typing-race:race-auth'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function hasStoredSession(): boolean {
  try {
    return storage()?.getItem(SESSION_KEY) != null
  } catch {
    return false
  }
}

function initial(): AccountState {
  const base = { email: null, busy: null, notice: null } as const
  if (!hasStoredSession()) return { ...base, kind: 'guest', nick: null }
  try {
    const raw = storage()?.getItem(CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw) as { kind?: unknown; nick?: unknown }
      if (cached.kind === 'google' || cached.kind === 'anonymous') {
        return {
          ...base,
          kind: cached.kind,
          nick: typeof cached.nick === 'string' ? cached.nick : null,
        }
      }
    }
  } catch {
    // A broken cache only costs the first frame.
  }
  return { ...base, kind: 'unknown', nick: null }
}

export const useAccount = create<AccountState>(() => initial())

/** Records who is signed in, and caches the public part (never the email). */
export function setAccount(next: {
  readonly kind: AccountKind
  readonly nick: string | null
  readonly email: string | null
}): void {
  useAccount.setState(next)
  try {
    if (next.kind === 'guest') storage()?.removeItem(CACHE_KEY)
    else storage()?.setItem(CACHE_KEY, JSON.stringify({ kind: next.kind, nick: next.nick }))
  } catch {
    // A full or blocked storage only costs the cache.
  }
}

export function setNotice(notice: AccountNotice | null): void {
  useAccount.setState({ notice })
}

const auth = () => import('./auth.js')

/**
 * «Увійти через Google». Links Google to this browser's guest when one exists (its id stays), or
 * signs in directly. `fresh` is the second-device path: sign into the account that already owns
 * this Google identity.
 */
export async function signInWithGoogle(mode: 'auto' | 'fresh' = 'auto'): Promise<void> {
  if (useAccount.getState().busy !== null) return
  useAccount.setState({ busy: 'redirecting', notice: null })
  try {
    const result = await (await auth()).beginGoogleSignIn(mode)
    // On `redirecting` the page is about to leave; the busy state stays until it does.
    if (result === 'redirecting') return
    useAccount.setState({
      busy: null,
      notice: result === 'no-backend' ? 'no-backend' : result === 'failed' ? 'failed' : null,
    })
  } catch {
    useAccount.setState({ busy: null, notice: 'failed' })
  }
}

/** The page opened with an OAuth return: finish it (`main.tsx` has already cleaned the URL). */
export async function completeAuthReturn(outcome: AuthReturn): Promise<void> {
  if (outcome.kind === 'none') return
  useAccount.setState({ busy: outcome.kind === 'code' ? 'returning' : null })
  try {
    const notice = await (await auth()).completeAuthReturn(outcome)
    useAccount.setState({ busy: null, notice })
  } catch {
    useAccount.setState({ busy: null, notice: 'failed' })
  }
}

/** Re-reads who is signed in. Never throws; offline keeps what is cached. */
export async function refreshAccount(): Promise<void> {
  if (!hasStoredSession()) {
    setAccount({ kind: 'guest', nick: null, email: null })
    return
  }
  try {
    await (await auth()).refreshAccount()
  } catch {
    // Offline or no backend: the cached kind stays on screen.
  }
}

/** The live sync status, or `null` before the engine exists (it always does once the app booted). */
export function useSyncStatus(): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  useEffect(() => {
    try {
      return syncStatus.subscribe(setStatus)
    } catch {
      return undefined
    }
  }, [])
  return status
}
