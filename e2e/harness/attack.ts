import { existsSync, readFileSync } from 'node:fs'
import { type APIRequestContext, request, type TestInfo } from '@playwright/test'
import { supabaseUrl } from './fakeSupabase.js'

/**
 * Helpers for the server attack suite (`security-server.spec.ts`).
 *
 * The threat model is an anonymous internet user holding the public anon key (the repository is
 * public, so is the key). Every attack runs against a **local** stack the CI lane starts for the
 * job; `localStackConfigured()` refuses anything else, because these requests forge logs, hammer
 * rate limits and delete accounts.
 */

function envValue(name: string): string | null {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  if (!existsSync('.env.local')) return null
  const match = readFileSync('.env.local', 'utf8').match(new RegExp(`^${name}=(\\S+)`, 'm'))
  return match?.[1] ?? null
}

export const API = supabaseUrl()
export const ANON_KEY = envValue('VITE_SUPABASE_ANON_KEY')

/** `true` only for a stack on this machine: the suite is destructive by design. */
export function localStackConfigured(): boolean {
  if (API === null || ANON_KEY === null) return false
  const host = new URL(API).hostname
  return host === '127.0.0.1' || host === 'localhost'
}

export interface Session {
  readonly token: string
  readonly id: string
}

/** An unauthenticated client: it holds only the public anon key, as any visitor does. */
export function visitor(): Promise<APIRequestContext> {
  return request.newContext({
    ...(API === null ? {} : { baseURL: API }),
    extraHTTPHeaders: { apikey: ANON_KEY ?? '' },
  })
}

const asUser = (session: Session) => ({ Authorization: `Bearer ${session.token}` })

/** Flags every account the suite makes as a test account, so no board ever shows it. */
const TEST_FLAG = { is_test: true }

export async function signUpGuest(api: APIRequestContext): Promise<Session> {
  const response = await api.post('/auth/v1/signup', { data: { data: TEST_FLAG } })
  if (!response.ok()) throw new Error(`anonymous sign-up failed: ${response.status()}`)
  const body = (await response.json()) as { access_token: string; user: { id: string } }
  return { token: body.access_token, id: body.user.id }
}

export async function signUpEmail(api: APIRequestContext, nickname?: string): Promise<Session> {
  const response = await api.post('/auth/v1/signup', {
    data: {
      email: `attack-${crypto.randomUUID()}@example.com`,
      password: crypto.randomUUID(),
      data: { ...TEST_FLAG, ...(nickname === undefined ? {} : { nickname }) },
    },
  })
  if (!response.ok()) throw new Error(`email sign-up failed: ${response.status()}`)
  const body = (await response.json()) as { access_token: string; user: { id: string } }
  return { token: body.access_token, id: body.user.id }
}

export interface Reply {
  readonly status: number
  readonly body: unknown
  readonly headers: Record<string, string>
  readonly ms: number
}

async function reply(call: Promise<import('@playwright/test').APIResponse>): Promise<Reply> {
  const started = Date.now()
  const response = await call
  const text = await response.text()
  let body: unknown = text
  try {
    body = text === '' ? null : JSON.parse(text)
  } catch {
    // Not JSON: keep the text.
  }
  return {
    status: response.status(),
    body,
    headers: response.headers(),
    ms: Date.now() - started,
  }
}

export interface Caller {
  fn(name: string, data: unknown, options?: { raw?: string; token?: string | null }): Promise<Reply>
  rpc(name: string, args?: unknown): Promise<Reply>
  select(path: string): Promise<Reply>
  patch(path: string, data: unknown): Promise<Reply>
  insert(path: string, data: unknown): Promise<Reply>
  remove(path: string): Promise<Reply>
}

/** Calls as `session`, or as a bare visitor (the anon key and no user) when it is `null`. */
export function caller(api: APIRequestContext, session: Session | null): Caller {
  const headers = session === null ? {} : asUser(session)
  const returning = { ...headers, Prefer: 'return=representation' }
  return {
    fn: (name, data, options = {}) => {
      const token = options.token === undefined ? (session?.token ?? null) : options.token
      const auth = token === null ? {} : { Authorization: `Bearer ${token}` }
      return reply(
        api.post(`/functions/v1/${name}`, {
          // A raw body is sent as-is, as JSON that need not parse.
          headers:
            options.raw === undefined ? auth : { ...auth, 'Content-Type': 'application/json' },
          ...(options.raw === undefined ? { data } : { data: options.raw }),
        }),
      )
    },
    rpc: (name, args = {}) => reply(api.post(`/rest/v1/rpc/${name}`, { headers, data: args })),
    select: (path) => reply(api.get(`/rest/v1/${path}`, { headers })),
    patch: (path, data) => reply(api.patch(`/rest/v1/${path}`, { headers: returning, data })),
    insert: (path, data) => reply(api.post(`/rest/v1/${path}`, { headers: returning, data })),
    remove: (path) => reply(api.delete(`/rest/v1/${path}`, { headers: returning })),
  }
}

/** Rows of a PostgREST answer, or an empty list for an error body. */
export function rows(response: Reply): Record<string, unknown>[] {
  return Array.isArray(response.body) ? (response.body as Record<string, unknown>[]) : []
}

/**
 * Attaches one piece of evidence to the test report: what was sent, what came back, what was
 * expected. Never a token or an email; bodies are cut short.
 */
export async function evidence(
  info: TestInfo,
  entry: { attack: string; sent: string; expected: string; reply: Reply },
): Promise<void> {
  const text =
    typeof entry.reply.body === 'string' ? entry.reply.body : JSON.stringify(entry.reply.body)
  await info.attach(entry.attack, {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        attack: entry.attack,
        sent: entry.sent,
        expected: entry.expected,
        status: entry.reply.status,
        response: (text ?? '').slice(0, 400),
        ms: entry.reply.ms,
      },
      null,
      2,
    ),
  })
}
