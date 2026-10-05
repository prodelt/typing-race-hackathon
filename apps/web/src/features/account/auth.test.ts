import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from './state.js'

/**
 * Sign-out after «Видалити мої дані». A real Supabase client, configured as the app configures it,
 * talks to a fake server through its `fetch`: nothing here reaches a live project.
 */

const requests: string[] = []
let client: SupabaseClient

vi.mock('../../sync/race.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../sync/race.js')>()),
  supabaseClient: () => Promise.resolve(client),
  raceBackend: () => Promise.resolve(null),
}))

vi.mock('../../sync/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../sync/index.js')>()),
  forgetLocalData: vi.fn(async () => {}),
  startSync: vi.fn(async () => 'no-session'),
  stopSync: vi.fn(),
}))

const { deleteAccount, endSession } = await import('./auth.js')

function base64url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** What the project answers: the function deletes the user, and with it every session it had. */
async function fakeServer(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  requests.push(`${init?.method ?? 'GET'} ${url.pathname}`)
  if (url.pathname === '/functions/v1/delete-account') {
    return Response.json({ deleted: true })
  }
  if (url.pathname === '/auth/v1/logout') {
    return Response.json(
      { code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' },
      { status: 403 },
    )
  }
  return Response.json({ message: 'not found' }, { status: 404 })
}

beforeEach(() => {
  requests.length = 0
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const user = {
    id: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {},
    created_at: '2026-10-01T00:00:00.000Z',
    is_anonymous: false,
  }
  const accessToken = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: 'user-1', role: 'authenticated', exp: expiresAt, session_id: 'session-1' }),
    'signature',
  ].join('.')
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: 'refresh-1',
      user,
    }),
  )
  client = createClient('http://supabase.test', 'anon-key', {
    auth: {
      storage: localStorage,
      storageKey: SESSION_KEY,
      persistSession: true,
      autoRefreshToken: false,
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
    global: { fetch: fakeServer },
  })
})

afterEach(() => {
  localStorage.clear()
})

describe('signing out after the account is deleted', () => {
  it('ends this browser’s session without asking the server, which no longer has one', async () => {
    const events: string[] = []
    client.auth.onAuthStateChange((event) => events.push(event))

    expect(await deleteAccount()).toBe('deleted')

    expect(requests).toContain('POST /functions/v1/delete-account')
    // The logout would answer 403 and leave a red line in the console.
    expect(requests.filter((request) => request.includes('/logout'))).toEqual([])
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect((await client.auth.getSession()).data.session).toBeNull()
    // Whoever listens (the sync engine) is still told the session ended.
    expect(events).toContain('SIGNED_OUT')
  })

  it('still ends the session on the server on an ordinary sign-out', async () => {
    await endSession()

    expect(requests).toContain('POST /auth/v1/logout')
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
