import { existsSync, readFileSync } from 'node:fs'
import type { BrowserContext, Page, Route } from '@playwright/test'
import { MOTION_OFF_SETTINGS } from './fixtures.js'

/**
 * An in-memory Supabase behind `page.route`, for the Account specs.
 *
 * Google cannot be driven from a test, and these specs must never reach a live project, so every
 * request to the configured Supabase URL — Auth, PostgREST and the Edge Functions — is answered
 * here. The URL must still be a `*.supabase.co` address, because the enforcing CSP is checked
 * before a route is consulted; `https://typing-race-e2e.supabase.co` works and resolves nowhere.
 *
 * It models only what the Account flow touches: the PKCE authorize/token round trip,
 * `linkIdentity` (including the 422 `identity_already_exists` of a second device), the profile
 * nick, the attempts union, `submit-attempt`, `delete-account` and sign-out.
 */

export function supabaseUrl(): string | null {
  const fromProcess = process.env['VITE_SUPABASE_URL']
  if (fromProcess) return fromProcess.replace(/\/$/, '')
  if (!existsSync('.env.local')) return null
  const match = readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL=(\S+)/m)
  return match?.[1]?.replace(/\/$/, '') ?? null
}

export interface FakeUser {
  id: string
  email: string | null
  anonymous: boolean
  nickname: string
}

export interface FakeSupabase {
  readonly users: Map<string, FakeUser>
  /** Attempt ids per user, as `submit-attempt` stored them. */
  readonly attempts: Map<string, Set<string>>
  /** The Google account that already exists elsewhere; linking it answers 422. */
  googleOwner: string | null
  /** Make `submit-attempt` fail, as a dropped connection would. */
  submitDown: boolean
  /** Users whose uploads fail while everyone else's go through. */
  readonly refuseFrom: Set<string>
  /** Nicks another learner already has. */
  readonly takenNicks: Set<string>
  readonly deleted: string[]
  readonly logouts: number[]
  /** Requests nothing here answers: a spec asserts this stays empty. */
  readonly unexpected: string[]
  /** A stored session for `user`, in the shape the app keeps under `typing-race:race-auth`. */
  session(user: FakeUser): Record<string, unknown>
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': '*',
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function userJson(user: FakeUser) {
  const providers = user.anonymous ? [] : ['google']
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email ?? '',
    is_anonymous: user.anonymous,
    app_metadata: { provider: user.anonymous ? 'anonymous' : 'google', providers },
    user_metadata: {},
    identities: providers.map((provider) => ({
      id: `${user.id}-${provider}`,
      user_id: user.id,
      provider,
      identity_id: `${user.id}-${provider}`,
      identity_data: {},
    })),
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  }
}

export async function fakeSupabase(target: Page | BrowserContext): Promise<FakeSupabase> {
  const base = supabaseUrl()
  if (base === null) throw new Error('the build has no VITE_SUPABASE_URL to stand in for')

  const tokens = new Map<string, string>()
  const codes = new Map<string, string>()
  let serial = 0

  const issue = (user: FakeUser) => {
    serial += 1
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const access = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
      sub: user.id,
      role: 'authenticated',
      aud: 'authenticated',
      exp: expiresAt,
      is_anonymous: user.anonymous,
      session_id: `s${serial}`,
    })}.fake`
    tokens.set(access, user.id)
    return {
      access_token: access,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: `refresh-${user.id}-${serial}`,
      user: userJson(user),
    }
  }

  const fake: FakeSupabase = {
    users: new Map(),
    attempts: new Map(),
    googleOwner: null,
    submitDown: false,
    refuseFrom: new Set(),
    takenNicks: new Set(),
    deleted: [],
    logouts: [],
    unexpected: [],
    session: (user) => issue(user),
  }

  const caller = (route: Route): FakeUser | null => {
    const header = route.request().headers()['authorization'] ?? ''
    const id = tokens.get(header.replace(/^Bearer /, ''))
    return id === undefined ? null : (fake.users.get(id) ?? null)
  }

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: body === undefined ? '' : JSON.stringify(body),
    })

  const googleUser = (): FakeUser => {
    const existing = [...fake.users.values()].find((user) => !user.anonymous)
    if (existing) return existing
    const created: FakeUser = {
      id: '00000000-0000-4000-8000-0000000000aa',
      email: 'olesia.k@example.com',
      anonymous: false,
      nickname: 'typist-0a0a0a0a',
    }
    fake.users.set(created.id, created)
    return created
  }

  await target.route(`${base}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    // ---- Auth ------------------------------------------------------------------------------
    if (path === '/auth/v1/health') return json(route, 200, { name: 'GoTrue' })

    if (path === '/auth/v1/authorize') {
      // Google's consent, approved at once: back to the app with a code.
      const user = googleUser()
      const code = `code-${++serial}`
      codes.set(code, user.id)
      const back = new URL(url.searchParams.get('redirect_to') ?? '/')
      back.searchParams.set('code', code)
      return route.fulfill({ status: 302, headers: { location: back.toString() } })
    }

    if (path === '/auth/v1/user/identities/authorize') {
      const user = caller(route)
      if (user === null) return json(route, 401, { message: 'no session' })
      const back = new URL(url.searchParams.get('redirect_to') ?? '/')
      if (fake.googleOwner !== null) {
        back.searchParams.set('error', 'server_error')
        back.searchParams.set('error_code', 'identity_already_exists')
        back.searchParams.set('error_description', 'Identity is already linked to another user')
        return json(route, 200, { url: back.toString() })
      }
      // Linked: the guest keeps its id and becomes a Google account.
      user.anonymous = false
      user.email = 'olesia.k@example.com'
      const code = `code-${++serial}`
      codes.set(code, user.id)
      back.searchParams.set('code', code)
      return json(route, 200, { url: back.toString() })
    }

    if (path === '/auth/v1/token') {
      const body = request.postDataJSON() as { auth_code?: string; refresh_token?: string }
      const grant = url.searchParams.get('grant_type')
      if (grant === 'pkce') {
        const id = codes.get(body.auth_code ?? '')
        codes.delete(body.auth_code ?? '')
        const user = id === undefined ? undefined : fake.users.get(id)
        if (user === undefined) return json(route, 400, { error_code: 'bad_code_verifier' })
        return json(route, 200, issue(user))
      }
      if (grant === 'refresh_token') {
        const id = /^refresh-(.+)-\d+$/.exec(body.refresh_token ?? '')?.[1]
        const user = id === undefined ? undefined : fake.users.get(id)
        if (user === undefined) return json(route, 400, { error_code: 'refresh_token_not_found' })
        return json(route, 200, issue(user))
      }
    }

    if (path === '/auth/v1/user') {
      const user = caller(route)
      return user === null
        ? json(route, 401, { message: 'no session' })
        : json(route, 200, userJson(user))
    }

    if (path === '/auth/v1/logout') {
      fake.logouts.push(Date.now())
      return route.fulfill({ status: 204, headers: CORS })
    }

    // ---- PostgREST -------------------------------------------------------------------------
    if (path === '/rest/v1/profiles') {
      const user = caller(route)
      if (user === null) return json(route, 401, { message: 'JWT required' })
      const single = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (method === 'GET') {
        const row = { nickname: user.nickname, settings: null, settings_updated_at: null }
        return json(route, 200, single ? row : [row])
      }
      if (method === 'PATCH') {
        const patch = request.postDataJSON() as { nickname?: string }
        if (patch.nickname !== undefined) {
          if (fake.takenNicks.has(patch.nickname.toLowerCase())) {
            return json(route, 409, {
              code: '23505',
              message: 'duplicate key value violates unique constraint "profiles_nickname_key"',
            })
          }
          user.nickname = patch.nickname
        }
        const row = { nickname: user.nickname }
        return json(route, 200, single ? row : [row])
      }
    }

    if (path === '/rest/v1/attempts' && method === 'GET') {
      // The union downloads nothing new here; what matters is what went up.
      return json(route, 200, [])
    }

    if (path === '/rest/v1/race_ratings' && method === 'GET') return json(route, 200, [])

    // ---- Edge Functions --------------------------------------------------------------------
    if (path === '/functions/v1/submit-attempt') {
      const user = caller(route)
      if (user === null) return json(route, 401, { error: 'not signed in' })
      if (fake.submitDown || fake.refuseFrom.has(user.id)) {
        return json(route, 503, { error: 'unavailable' })
      }
      const body = request.postDataJSON() as { attempts: { attempt: { id: string } }[] }
      const ids = body.attempts.map((entry) => entry.attempt.id)
      const mine = fake.attempts.get(user.id) ?? new Set()
      // `on conflict (id) do nothing`, as the real table: an id another user already sent is
      // accepted and changes nothing — it stays with whoever sent it first.
      const owned = new Set([...fake.attempts.values()].flatMap((set) => [...set]))
      for (const id of ids) if (!owned.has(id)) mine.add(id)
      fake.attempts.set(user.id, mine)
      return json(route, 200, { accepted: ids, rejected: [] })
    }

    if (path === '/functions/v1/delete-account') {
      const user = caller(route)
      if (user === null) return json(route, 401, { error: 'not signed in' })
      fake.deleted.push(user.id)
      fake.users.delete(user.id)
      fake.attempts.delete(user.id)
      return json(route, 200, { deleted: true })
    }

    fake.unexpected.push(`${method} ${path}${url.search}`)
    return json(route, 404, { message: 'not modelled by the fake' })
  })

  return fake
}

/** Adds a user to the fake and returns it. */
export function addUser(fake: FakeSupabase, user: FakeUser): FakeUser {
  fake.users.set(user.id, user)
  return user
}

// ---- The learner the Account specs start from ----------------------------------------------

export const SESSION_KEY = 'typing-race:race-auth'
export const ATTEMPT_ID = '6b0f7a52-1d9e-4c11-9a51-0e0b7d6b9a01'

function attempt(id: string) {
  const now = Date.now()
  return {
    id,
    scaleId: 'qwerty.run.anchors',
    layoutId: 'qwerty',
    language: 'en',
    mode: 'practice',
    text: '',
    seed: 7,
    startedAt: now - 60_000,
    completedAt: now - 30_000,
    elapsedMs: 30_000,
    metrics: {
      spm: 140,
      wpm: 28,
      accuracy: 0.97,
      errorCount: 1,
      errorsByChar: {},
      rhythmConsistency: { value: 80, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
    log: {
      formatVersion: 1,
      dt: [0, 260],
      kind: ['char', 'char'],
      char: ['f', 'j'],
      correct: [true, true],
    },
  }
}

/**
 * A learner past the first run with one attempt, which is also queued in the outbox — the state a
 * guest is in after training without an account. Seeded once per tab: the OAuth round trip
 * reloads the page, and a re-seed would undo what sync did.
 */
export async function seedLearner(page: Page, options: { session?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ({ settings, queued, session, sessionKey }) => {
      if (sessionStorage.getItem('e2e:seeded') !== null) return
      sessionStorage.setItem('e2e:seeded', '1')
      localStorage.setItem('typing-race:test-account', '1')
      if (session !== null) localStorage.setItem(sessionKey, JSON.stringify(session))
      const envelope = indexedDB.open('typing-race', 1)
      envelope.onupgradeneeded = () => envelope.result.createObjectStore('envelope')
      envelope.onsuccess = () => {
        envelope.result
          .transaction('envelope', 'readwrite')
          .objectStore('envelope')
          .put(
            {
              storeVersion: 1,
              writtenAt: Date.now(),
              progressByLanguage: {},
              attempts: queued,
              logs: {},
              settings,
              startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
            },
            'current',
          )
      }
      const outbox = indexedDB.open('typing-race-outbox', 1)
      outbox.onupgradeneeded = () => outbox.result.createObjectStore('attempts', { keyPath: 'id' })
      outbox.onsuccess = () => {
        const store = outbox.result.transaction('attempts', 'readwrite').objectStore('attempts')
        for (const item of queued) store.put(item)
      }
    },
    {
      settings: { ...MOTION_OFF_SETTINGS, typingLanguage: 'en', layoutId: 'qwerty' },
      queued: [attempt(ATTEMPT_ID)],
      session: options.session ?? null,
      sessionKey: SESSION_KEY,
    },
  )
}
