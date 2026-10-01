import { createClient } from 'jsr:@supabase/supabase-js@2'
import { json, preflight } from '../_shared/cors.ts'

/**
 * `delete-account` — "Delete my data" (ADR-0006), for Google and guest users alike.
 *
 * The caller is read from their JWT, never from the body, so nobody can delete someone else.
 * Groups the caller owns pass to their oldest other member first (`hand_over_owned_groups`), or
 * go when nobody else is in them; then the auth user is hard-deleted and every table cascades.
 * Sessions are revoked by the delete; the client signs out locally and clears its caches.
 */
Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early
  if (request.method !== 'POST') return json({ error: 'use POST' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'missing authorization' }, 401)

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )
  const { data: auth, error: authError } = await asCaller.auth.getUser()
  if (authError || !auth.user) return json({ error: 'not signed in' }, 401)
  const userId = auth.user.id

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error: handOverError } = await service.rpc('hand_over_owned_groups', { p_user: userId })
  if (handOverError) return json({ error: handOverError.message }, 500)

  const { error: deleteError } = await service.auth.admin.deleteUser(userId)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ deleted: true })
})
