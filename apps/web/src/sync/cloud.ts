import type { SupabaseClient } from '@supabase/supabase-js'
import type { Attempt, Settings } from '@typing-race/domain'
import { appSync, type Rejection, type Remote, type StampedSettings } from './index.js'
import { supabaseClient } from './race.js'

/**
 * The Supabase side of sync: the `Remote` adapter and `startSync`.
 *
 * Loaded lazily (`import('./sync/cloud.js')`), so a learner who never signs in never downloads the
 * Supabase client. `startSync` only ever *uses* a session that already exists: it never signs
 * anyone in, so no anonymous user is created by sync (lazy identity, ADR-0006).
 */

export type StartResult = 'syncing' | 'no-backend' | 'no-session'

let unsubscribeAuth: (() => void) | null = null

/**
 * Connects the app's sync engine to the signed-in account, if there is one. Safe to call at boot
 * and again after sign-in; a second call re-reads the session and resyncs.
 */
export async function startSync(): Promise<StartResult> {
  const client = await supabaseClient()
  if (client === null) return 'no-backend'
  const { data } = await client.auth.getSession()
  const user = data.session?.user
  if (!user) return 'no-session'

  unsubscribeAuth?.()
  const { data: listener } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') appSync().disconnect()
  })
  unsubscribeAuth = () => listener.subscription.unsubscribe()

  await appSync().connect(supabaseRemote(client, user.id))
  return 'syncing'
}

/** Page size of a pull; PostgREST caps a response at 1000 rows by default. */
const PAGE = 1000

interface AttemptRow {
  id: string
  scale_id: string
  layout_id: Attempt['layoutId']
  language: Attempt['language']
  mode: Attempt['mode']
  seed: number | string
  started_at: string
  completed_at: string
  elapsed_ms: number
  metrics: Attempt['metrics']
  aggregates: Attempt['aggregates']
}

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async push(attempts) {
      // An attempt without its log cannot be recomputed by the server, so it would be refused on
      // every flush; it is refused here once instead.
      const withLog = attempts.filter((a) => a.log !== null)
      const refused: Rejection[] = attempts
        .filter((a) => a.log === null)
        .map((a) => ({ id: a.id, reason: 'log_malformed' }))
      if (withLog.length === 0) return { accepted: [], rejected: refused }

      const { data, error } = await client.functions.invoke<{
        accepted: string[]
        rejected: Rejection[]
      }>('submit-attempt', {
        body: {
          attempts: withLog.map(({ log, metrics: _m, aggregates: _a, ...attempt }) => ({
            attempt,
            log,
          })),
        },
      })
      if (error || !data) throw new Error(error?.message ?? 'submit-attempt returned nothing')
      return { accepted: data.accepted, rejected: [...data.rejected, ...refused] }
    },

    async pull() {
      const attempts: Attempt[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('attempts')
          .select(
            'id, scale_id, layout_id, language, mode, seed, started_at, completed_at, elapsed_ms, metrics, aggregates',
          )
          .eq('user_id', userId)
          .order('completed_at', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as AttemptRow[]
        for (const row of rows) attempts.push(fromRow(row))
        if (rows.length < PAGE) return attempts
      }
    },

    async settings() {
      const { data, error } = await client
        .from('profiles')
        .select('settings, settings_updated_at')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data?.settings || !data.settings_updated_at) return null
      return {
        settings: data.settings as Settings,
        updatedAt: Date.parse(data.settings_updated_at as string),
      }
    },

    async saveSettings({ settings, updatedAt }: StampedSettings) {
      const stamp = new Date(updatedAt).toISOString()
      // Last write wins on the server too: a stale device cannot overwrite a newer copy even if it
      // read the profile before the other device wrote it.
      const { error } = await client
        .from('profiles')
        .update({ settings, settings_updated_at: stamp })
        .eq('id', userId)
        .or(`settings_updated_at.is.null,settings_updated_at.lt."${stamp}"`)
      if (error) throw new Error(error.message)
    },

    async nick() {
      const { data, error } = await client
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data?.nickname as string | undefined) ?? ''
    },

    async setNick(nick) {
      const { data, error } = await client
        .from('profiles')
        .update({ nickname: nick })
        .eq('id', userId)
        .select('nickname')
        .single()
      if (error) throw new Error(error.message)
      return data.nickname as string
    },
  }
}

function fromRow(row: AttemptRow): Attempt {
  return {
    id: row.id,
    scaleId: row.scale_id,
    layoutId: row.layout_id,
    language: row.language,
    mode: row.mode,
    // The server keeps no text, and the local store drops it anyway; it is never derived from.
    text: '',
    seed: Number(row.seed),
    startedAt: Date.parse(row.started_at),
    completedAt: Date.parse(row.completed_at),
    elapsedMs: row.elapsed_ms,
    metrics: row.metrics,
    aggregates: row.aggregates,
    log: null,
  }
}
