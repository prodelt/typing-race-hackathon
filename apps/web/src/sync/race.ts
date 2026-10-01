import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { KeystrokeEventLog, Language } from '@typing-race/domain'
import { startSync } from './index.js'

/**
 * The race side of the `sync` seam: every Supabase call a race makes, and nothing else.
 *
 * This module is imported only by the lazily loaded race feature, so `@supabase/supabase-js` never
 * reaches the initial bundle and training never waits on, or breaks because of, the backend.
 *
 * Identity is an anonymous Supabase user with a chosen display name. The session lives in
 * `localStorage`, because groups and leaderboards need the same learner tomorrow: a group owner who
 * closed the tab must still own the group, and "my row" must still be theirs. Two racers on one
 * machine therefore need two browser profiles (or a private window), not two tabs.
 *
 * A browser that carries the `typing-race:test-account` flag (the e2e fixtures set it) signs up as
 * a test account: it races normally and never appears on a board real learners see.
 */

export type RoomState = 'gathering' | 'countdown' | 'running' | 'finished'
export type SeatRole = 'racer' | 'spectator'

export interface Participant {
  readonly userId: string
  readonly nickname: string
  readonly role: SeatRole
  readonly joinedAt: string
}

export interface RaceResult {
  readonly userId: string
  readonly nickname: string
  readonly spm: number
  readonly accuracy: number
  readonly score: number
  readonly validated: boolean
  readonly reason: string | null
  readonly finishedAt: string
}

export interface RoomSnapshot {
  readonly id: string
  readonly state: RoomState
  readonly visibility: 'quick' | 'private'
  readonly joinCode: string | null
  readonly language: Language
  readonly hostId: string | null
  readonly createdAt: string
  readonly startsAt: string | null
  readonly deadline: string | null
  readonly text: string | null
  readonly me: string
  readonly participants: readonly Participant[]
  readonly results: readonly RaceResult[]
  /** Server clock minus this browser's clock, in ms, measured on this read. */
  readonly offsetMs: number
}

export interface FinishReply {
  readonly validated: boolean
  readonly result: { readonly spm: number; readonly accuracy: number; readonly score: number }
  readonly reason?: string
}

/** What a racer tells the room twice a second. Display only: nothing is decided from it. */
export interface ProgressMessage {
  readonly userId: string
  /** Characters typed correctly so far. */
  readonly cursor: number
  readonly total: number
  readonly spm: number
}

export interface RoomConnection {
  sendProgress(message: ProgressMessage): void
  close(): void
}

export interface Identity {
  readonly userId: string
  readonly nickname: string
}

/**
 * The learner's Race Rating as the server computed it (`rate_race`, migration `race_rating`).
 * `guest`: no race identity in this browser yet. `unrated`: an identity, but no rated race yet.
 * `unavailable`: the server could not say (offline, or the rating is not deployed there).
 */
export type RaceStanding =
  | { readonly kind: 'guest' }
  | { readonly kind: 'unrated' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'rated'
      readonly rating: number
      readonly races: number
      /** The change from the last rated race, and which room it was. */
      readonly lastDelta: number
      readonly lastRoomId: string | null
    }

export interface RaceBackend {
  identity(): Promise<Identity | null>
  /** This learner's Race Rating, read under RLS (own row only). Never throws. */
  standing(): Promise<RaceStanding>
  signIn(nickname: string): Promise<Identity>
  rename(nickname: string): Promise<Identity>
  rememberedName(): string
  quickMatch(language: Language): Promise<string>
  createPrivateRoom(language: Language): Promise<{ roomId: string; code: string }>
  joinByCode(code: string): Promise<string>
  snapshot(roomId: string): Promise<RoomSnapshot>
  /** The start time once the race has one; `null` while the room is still gathering. */
  requestStart(roomId: string): Promise<string | null>
  becomeSpectator(roomId: string): Promise<void>
  finish(roomId: string, log: KeystrokeEventLog, elapsedMs: number): Promise<FinishReply>
  connect(
    roomId: string,
    handlers: { onProgress(message: ProgressMessage): void; onChange(): void },
  ): Promise<RoomConnection>
}

const NAME_KEY = 'typing-race:race-name'
/** Quick matches are matched on one difficulty; the seeded texts are all at this one. */
const QUICK_DIFFICULTY = 2

export class RaceError extends Error {
  constructor(
    readonly code: 'no_room' | 'name_taken' | 'network' | 'server',
    message: string,
  ) {
    super(message)
  }
}

function safeStorage(kind: 'local' | 'session'): Storage | undefined {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage
  } catch {
    return undefined
  }
}

function fail(error: { message: string } | null, fallback = 'server'): never {
  const message = error?.message ?? 'unknown error'
  if (/no room with that code/i.test(message)) throw new RaceError('no_room', message)
  if (/duplicate key|profiles_nickname_key/i.test(message))
    throw new RaceError('name_taken', message)
  if (/fetch|network/i.test(message)) throw new RaceError('network', message)
  throw new RaceError(fallback === 'network' ? 'network' : 'server', message)
}

function configured(): { url: string; key: string } | null {
  const url = import.meta.env['VITE_SUPABASE_URL']
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY']
  if (typeof url !== 'string' || url === '' || typeof key !== 'string' || key === '') return null
  return { url, key }
}

/** Reachable within a few seconds, or treated as down: the lobby must not hang on a spinner. */
async function reachable(url: string, key: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(12_000),
    })
    return response.ok
  } catch {
    return false
  }
}

let pending: Promise<SupabaseClient | null> | null = null
let client: SupabaseClient | null = null

/**
 * The one Supabase client of the page, shared by races, groups and boards, or `null` when the
 * backend is not configured or cannot be reached. One client, because two would each run their
 * own session refresh against the same stored session.
 */
export function supabaseClient(): Promise<SupabaseClient | null> {
  if (client !== null) return Promise.resolve(client)
  pending ??= (async () => {
    const env = configured()
    if (env === null || !(await reachable(env.url, env.key))) return null
    client ??= createClient(env.url, env.key, {
      auth: {
        storage: safeStorage('local'),
        storageKey: 'typing-race:race-auth',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    return client
  })()
  const current = pending
  // A failed probe is retried on the next visit rather than remembered for the whole page.
  void current.then((found) => {
    if (found === null && pending === current) pending = null
  })
  return current
}

let backend: RaceBackend | null = null

/** `null` when the backend is not configured or cannot be reached. */
export async function raceBackend(): Promise<RaceBackend | null> {
  const found = await supabaseClient()
  if (found === null) return null
  backend ??= createBackend(found)
  return backend
}

const TEST_ACCOUNT_KEY = 'typing-race:test-account'

function testAccount(): boolean {
  return safeStorage('local')?.getItem(TEST_ACCOUNT_KEY) === '1'
}

function createBackend(client: SupabaseClient): RaceBackend {
  const readProfile = async (userId: string): Promise<Identity> => {
    const { data, error } = await client
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle()
    if (error) fail(error)
    return { userId, nickname: (data?.nickname as string | undefined) ?? '' }
  }

  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.rpc(name, args)
    if (error) fail(error)
    return data as T
  }

  return {
    rememberedName() {
      return safeStorage('local')?.getItem(NAME_KEY) ?? ''
    },

    async identity() {
      const { data } = await client.auth.getSession()
      const user = data.session?.user
      return user ? readProfile(user.id) : null
    },

    async standing() {
      try {
        const { data: session } = await client.auth.getSession()
        const user = session.session?.user
        if (!user) return { kind: 'guest' }
        const { data, error } = await client
          .from('race_ratings')
          .select('rating, races, last_delta, last_room')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) return { kind: 'unavailable' }
        if (data === null || Number(data.races) === 0) return { kind: 'unrated' }
        return {
          kind: 'rated',
          rating: Number(data.rating),
          races: Number(data.races),
          lastDelta: Number(data.last_delta),
          lastRoomId: (data.last_room as string | null) ?? null,
        }
      } catch {
        return { kind: 'unavailable' }
      }
    },

    async signIn(nickname) {
      const { data, error } = await client.auth.signInAnonymously({
        options: { data: testAccount() ? { nickname, is_test: true } : { nickname } },
      })
      if (error || !data.user) fail(error, 'network')
      safeStorage('local')?.setItem(NAME_KEY, nickname)
      // A session exists from here on, so training syncs too (ADR-0006: signed in means syncing).
      void startSync()
      return readProfile(data.user.id)
    },

    async rename(nickname) {
      const { data } = await client.auth.getSession()
      const user = data.session?.user
      if (!user) return this.signIn(nickname)
      const { error } = await client.from('profiles').update({ nickname }).eq('id', user.id)
      if (error) fail(error)
      safeStorage('local')?.setItem(NAME_KEY, nickname)
      return readProfile(user.id)
    },

    async quickMatch(language) {
      const rows = await rpc<{ room_id: string }[]>('join_quick_match', {
        p_language: language,
        p_difficulty: QUICK_DIFFICULTY,
      })
      const room = rows[0]
      if (!room) throw new RaceError('server', 'no room returned')
      return room.room_id
    },

    async createPrivateRoom(language) {
      const rows = await rpc<{ room_id: string; join_code: string }[]>('create_private_room', {
        p_language: language,
      })
      const room = rows[0]
      if (!room) throw new RaceError('server', 'no room returned')
      return { roomId: room.room_id, code: room.join_code }
    },

    async joinByCode(code) {
      const rows = await rpc<{ room_id: string }[]>('join_by_code', { p_code: code })
      const room = rows[0]
      if (!room) throw new RaceError('no_room', 'no room returned')
      return room.room_id
    },

    async snapshot(roomId) {
      const sentAt = Date.now()
      const raw = await rpc<Omit<RoomSnapshot, 'offsetMs'> & { serverNow: string }>(
        'room_snapshot',
        { p_room: roomId },
      )
      const receivedAt = Date.now()
      const { serverNow, ...rest } = raw
      // The server read its clock somewhere in the round trip; the middle is the best guess.
      const offsetMs = Date.parse(serverNow) - (sentAt + receivedAt) / 2
      return {
        ...rest,
        participants: rest.participants ?? [],
        results: (rest.results ?? []).map((result) => ({
          ...result,
          spm: Number(result.spm),
          accuracy: Number(result.accuracy),
          score: Number(result.score),
        })),
        offsetMs,
      }
    },

    requestStart(roomId) {
      return rpc<string | null>('start_race', { p_room: roomId })
    },

    async becomeSpectator(roomId) {
      await rpc<null>('become_spectator', { p_room: roomId })
    },

    async finish(roomId, log, elapsedMs) {
      const { data, error } = await client.functions.invoke<FinishReply>('finish-race', {
        body: { roomId, log, elapsedMs },
      })
      if (error || !data) fail(error, 'network')
      return data
    },

    async connect(roomId, handlers) {
      await client.realtime.setAuth()
      const topic = `race:${roomId}`
      // Realtime hands back the same channel for the same topic, so two connections to one room
      // (React's development double-mount does exactly this) must share it; the last to close
      // removes it. Without the count, the first mount's late close tore down the second's channel.
      let shared = rooms.get(topic)
      if (shared === undefined) {
        const listeners = new Set<Handlers>()
        const channel: RealtimeChannel = client.channel(topic, {
          config: { private: true, broadcast: { self: false } },
        })
        const changed = () => {
          for (const listener of listeners) listener.onChange()
        }
        channel
          .on('broadcast', { event: 'progress' }, ({ payload }) => {
            for (const listener of listeners) listener.onProgress(payload as ProgressMessage)
          })
          .on('broadcast', { event: 'roster' }, changed)
          .on('broadcast', { event: 'state' }, changed)
          .on('broadcast', { event: 'result' }, changed)
          .subscribe()
        shared = { channel, listeners }
        rooms.set(topic, shared)
      }
      const { channel, listeners } = shared
      listeners.add(handlers)

      let closed = false
      return {
        sendProgress(message) {
          if (!closed) void channel.send({ type: 'broadcast', event: 'progress', payload: message })
        },
        close() {
          if (closed) return
          closed = true
          listeners.delete(handlers)
          if (listeners.size === 0) {
            rooms.delete(topic)
            void client.removeChannel(channel)
          }
        },
      }
    },
  }
}

type Handlers = Parameters<RaceBackend['connect']>[1]

/** One Realtime channel per room topic, shared by every open connection to it. */
const rooms = new Map<string, { channel: RealtimeChannel; listeners: Set<Handlers> }>()
