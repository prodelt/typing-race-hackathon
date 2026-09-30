import type { SupabaseClient } from '@supabase/supabase-js'
import type { Language } from '@typing-race/domain'
import { type RaceBackend, raceBackend, supabaseClient } from './race.js'

/**
 * Groups and leaderboards: every Supabase call they make, and nothing else. Imported only by the
 * lazily loaded groups and leaderboards screens, so none of it reaches the initial bundle.
 *
 * Identity is the race identity (same anonymous learner, same display name), so a group owner who
 * raced yesterday is the same person on the board today.
 */

export type GroupRole = 'owner' | 'teacher' | 'member'

export interface GroupSummary {
  readonly id: string
  readonly name: string
  readonly role: GroupRole
  readonly members: number
}

export interface GroupMember {
  readonly userId: string
  readonly nickname: string
  readonly role: GroupRole
  readonly joinedAt: string
}

export interface GroupSnapshot {
  readonly id: string
  readonly name: string
  readonly joinCode: string
  readonly ownerId: string
  readonly createdAt: string
  readonly me: string
  readonly members: readonly GroupMember[]
}

export type BoardScope = 'all' | 'week' | 'group'

export interface BoardRow {
  readonly place: number
  readonly userId: string
  readonly nickname: string
  readonly spm: number
  readonly accuracy: number
  readonly score: number
  readonly races: number
  readonly finishedAt: string
}

export interface Board {
  readonly scope: BoardScope
  readonly language: Language
  readonly weekStart: string
  readonly me: string | null
  readonly rows: readonly BoardRow[]
}

export class GroupError extends Error {
  constructor(
    readonly code: 'no_group' | 'not_member' | 'not_owner' | 'invalid_name' | 'server',
    message: string,
  ) {
    super(message)
  }
}

function fail(error: { message: string }): never {
  const message = error.message
  if (/no group with that code/i.test(message)) throw new GroupError('no_group', message)
  if (/not in this group/i.test(message)) throw new GroupError('not_member', message)
  if (/only the owner/i.test(message)) throw new GroupError('not_owner', message)
  if (/group name must be/i.test(message)) throw new GroupError('invalid_name', message)
  throw new GroupError('server', message)
}

export interface GroupsBackend {
  /** The race identity: sign-in, rename and the remembered name live there. */
  readonly race: RaceBackend
  myGroups(): Promise<readonly GroupSummary[]>
  createGroup(name: string): Promise<{ groupId: string; code: string }>
  joinGroup(code: string): Promise<string>
  group(groupId: string): Promise<GroupSnapshot>
  removeMember(groupId: string, userId: string): Promise<void>
  regenerateCode(groupId: string): Promise<string>
  leave(groupId: string): Promise<void>
  board(scope: BoardScope, language: Language, groupId?: string): Promise<Board>
}

let backend: GroupsBackend | null = null

/** `null` when the backend is not configured or cannot be reached. */
export async function groupsBackend(): Promise<GroupsBackend | null> {
  const [client, race] = await Promise.all([supabaseClient(), raceBackend()])
  if (client === null || race === null) return null
  backend ??= createGroupsBackend(client, race)
  return backend
}

function createGroupsBackend(client: SupabaseClient, race: RaceBackend): GroupsBackend {
  const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await client.rpc(name, args)
    if (error) fail(error)
    return data as T
  }

  return {
    race,

    async myGroups() {
      // Nobody signed in has no groups; asking would only return an empty list slower.
      const { data } = await client.auth.getSession()
      if (!data.session) return []
      return (await rpc<GroupSummary[] | null>('my_groups')) ?? []
    },

    async createGroup(name) {
      const rows = await rpc<{ group_id: string; join_code: string }[]>('create_group', {
        p_name: name,
      })
      const row = rows[0]
      if (!row) throw new GroupError('server', 'no group returned')
      return { groupId: row.group_id, code: row.join_code }
    },

    joinGroup(code) {
      return rpc<string>('join_group', { p_code: code })
    },

    async group(groupId) {
      const raw = await rpc<GroupSnapshot>('group_snapshot', { p_group: groupId })
      return { ...raw, members: raw.members ?? [] }
    },

    async removeMember(groupId, userId) {
      await rpc<null>('remove_group_member', { p_group: groupId, p_user: userId })
    },

    regenerateCode(groupId) {
      return rpc<string>('regenerate_group_code', { p_group: groupId })
    },

    async leave(groupId) {
      await rpc<null>('leave_group', { p_group: groupId })
    },

    async board(scope, language, groupId) {
      const raw = await rpc<Board>('leaderboard', {
        p_scope: scope,
        p_language: language,
        p_group: groupId ?? null,
      })
      return {
        ...raw,
        rows: (raw.rows ?? []).map((row) => ({
          ...row,
          spm: Number(row.spm),
          accuracy: Number(row.accuracy),
          score: Number(row.score),
          races: Number(row.races),
          place: Number(row.place),
        })),
      }
    },
  }
}
