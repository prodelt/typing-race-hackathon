import { setRaceStanding } from '../../app/state/raceStanding.js'
import { forgetLocalData, startSync, stopSync } from '../../sync/index.js'
import { forgetRaceName, raceBackend, rememberRaceName, supabaseClient } from '../../sync/race.js'
import {
  type AccountKind,
  type AuthReturn,
  accountKind,
  classifyAuthError,
  RETURN_TO_KEY,
  signInMethod,
} from './model.js'
import { type AccountNotice, SESSION_KEY, setAccount } from './state.js'

/**
 * Every Supabase Auth call of the Account: Google sign-in (PKCE), the return from Google,
 * sign-out and "delete my data". Loaded lazily by `state.ts`, never at boot.
 *
 * Identity follows ADR-0006: Google is *linked* to an existing guest (`linkIdentity`, the user id
 * and race history stay), and a browser with no guest signs in directly — no anonymous user is ever
 * created just to be linked. When the Google identity already belongs to another user (a second
 * device), Supabase refuses the link with 422 `identity_already_exists`; the learner is asked, and
 * then signed into that account, where the sync engine uploads this browser's outbox.
 */

function sessionStore(): Storage | undefined {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

export type BeginResult = 'redirecting' | 'no-backend' | 'failed' | 'already'

export async function beginGoogleSignIn(mode: 'auto' | 'fresh'): Promise<BeginResult> {
  const client = await supabaseClient()
  if (client === null) return 'no-backend'

  const { data } = await client.auth.getSession()
  const user = data.session?.user ?? null
  const kind = accountKind(user)
  const method =
    mode === 'fresh'
      ? 'oauth'
      : signInMethod({ hasSession: user !== null, isAnonymous: kind === 'anonymous' })
  if (method === 'already') {
    await refreshAccount()
    return 'already'
  }

  try {
    sessionStore()?.setItem(
      RETURN_TO_KEY,
      `${globalThis.location.pathname}${globalThis.location.search}`,
    )
  } catch {
    // Without it the learner simply lands on Home.
  }
  // The origin itself: that is the address the project allows as a redirect.
  const redirectTo = `${globalThis.location.origin}/`
  const { error } =
    method === 'link'
      ? await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } })
      : await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  return error ? 'failed' : 'redirecting'
}

/** Exchanges the code or explains the error. The URL was already cleaned by `main.tsx`. */
export async function completeAuthReturn(outcome: AuthReturn): Promise<AccountNotice | null> {
  if (outcome.kind === 'none') return null
  if (outcome.kind === 'error') {
    const failure = classifyAuthError(outcome)
    if (failure === 'cancelled') return null
    return failure
  }
  const client = await supabaseClient()
  if (client === null) return 'no-backend'
  const { error } = await client.auth.exchangeCodeForSession(outcome.code)
  if (error) return 'failed'
  await refreshAccount()
  // Signed in means syncing (ADR-0006): the outbox uploads, the cloud history unions in.
  void startSync()
  return 'signed-in'
}

/** Reads who is signed in and their public nick; keeps the race lobby's default name equal to it. */
export async function refreshAccount(): Promise<void> {
  const client = await supabaseClient()
  if (client === null) return
  const { data } = await client.auth.getSession()
  const user = data.session?.user ?? null
  const kind: AccountKind = accountKind(user)
  if (kind === 'guest') {
    setAccount({ kind, nick: null, email: null })
    return
  }
  let nick: string | null = null
  try {
    nick = (await (await raceBackend())?.identity())?.nickname || null
  } catch {
    // The nick is shown when it can be read; the account works without it.
  }
  if (nick !== null) rememberRaceName(nick)
  setAccount({ kind, nick, email: kind === 'google' ? (user?.email ?? null) : null })
}

/** Records a nick saved through the sync engine, so the bar and the race lobby agree. */
export function nickSaved(nick: string, kind: AccountKind, email: string | null): void {
  rememberRaceName(nick)
  setAccount({ kind, nick, email })
}

function dropStoredSession(): void {
  try {
    globalThis.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored.
  }
}

/**
 * The second half of sign-out, once `wipeLocalIfSynced()` said `'wiped'`: ends this browser's
 * session (only this one — other devices stay signed in) and forgets the name and the rating.
 *
 * `accountGone`: the server already deleted the user and every session with it, so its logout
 * would only answer 403 (a red line in the console). The stored session goes first; sign-out then
 * finds no token to send and just clears this browser, still telling its listeners.
 */
export async function endSession(options: { readonly accountGone?: boolean } = {}): Promise<void> {
  stopSync()
  forgetRaceName()
  setRaceStanding({ kind: 'guest' })
  const client = await supabaseClient()
  try {
    if (options.accountGone === true) dropStoredSession()
    if (client !== null) await client.auth.signOut({ scope: 'local' })
  } finally {
    // Unreachable backend or not, the session must not survive on a shared computer.
    dropStoredSession()
    setAccount({ kind: 'guest', nick: null, email: null })
  }
}

/**
 * "Delete my data": the `delete-account` function removes the user server-side, then the local
 * copy and the outbox go and the session ends. Nothing local is touched unless the server
 * confirmed the deletion.
 *
 * A guest's training never left this browser, so `keepLocal` ends only the server profile (nick,
 * Race results, group memberships) and leaves the learner's progress where it is.
 */
export async function deleteAccount(
  options: { readonly keepLocal?: boolean } = {},
): Promise<'deleted' | 'failed' | 'no-backend'> {
  const client = await supabaseClient()
  if (client === null) return 'no-backend'
  const { data, error } = await client.functions.invoke<{ deleted?: boolean }>('delete-account', {
    method: 'POST',
  })
  if (error || data?.deleted !== true) return 'failed'
  if (options.keepLocal !== true) await forgetLocalData()
  await endSession({ accountGone: true })
  return 'deleted'
}
