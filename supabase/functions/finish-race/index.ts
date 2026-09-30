import { createClient } from 'jsr:@supabase/supabase-js@2'
import { layouts } from '@typing-race/curriculum'
import type { KeystrokeEventLog, LayoutId } from '@typing-race/domain'
import { computeMetrics } from '@typing-race/metrics'
import { json, preflight } from '../_shared/cors.ts'

/**
 * `finish-race` — the only place a race result becomes a result (ADR-0006).
 *
 * Training attempts get plausibility checks; **race finishes get replayed**. The asymmetry is
 * deliberate and it is about consequences: an inflated personal number costs one learner a little
 * self-knowledge, while an unearned place on a leaderboard costs everyone else the point of
 * having one. Replay is expensive, so it is spent where it buys something.
 *
 * The replay is the same code the browser ran — `computeMetrics` from `packages/metrics`,
 * imported unchanged (ADR-0007) — run against the **room's** text rather than the text the client
 * says it typed. A log that cannot produce the room's text is not a slow race; it is a different
 * race.
 */

/** Ticket 14: speed weighted by accuracy, with a floor. Fast and dirty must not beat clean. */
const ACCURACY_FLOOR = 0.9

export function scoreOf(spm: number, accuracy: number): number {
  if (accuracy < ACCURACY_FLOOR) return 0
  // Squared, so the gap between 92% and 99% matters more than the gap between 60% and 67% would
  // if it were linear — and the curriculum's whole claim is that accuracy comes first.
  return Math.round(spm * accuracy * accuracy * 100) / 100
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'missing authorization' }, 401)

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )
  const { data: auth } = await asCaller.auth.getUser()
  if (!auth?.user) return json({ error: 'not signed in' }, 401)

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let body: { roomId?: string; attemptId?: string; log?: KeystrokeEventLog; elapsedMs?: number }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body is not JSON' }, 400)
  }

  const { roomId, attemptId, log, elapsedMs } = body
  if (!roomId || !log || typeof elapsedMs !== 'number') {
    return json({ error: 'roomId, log and elapsedMs are required' }, 400)
  }

  // The room's own text and language. Not the client's copy of them: that is the point.
  const { data: room } = await service
    .from('race_rooms')
    .select('id, language, starts_at, race_texts ( body )')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) return json({ error: 'no such room' }, 404)
  if (!room.starts_at) return json({ error: 'race has not started' }, 409)

  const text = (room.race_texts as unknown as { body: string } | null)?.body
  if (!text) return json({ error: 'room has no text' }, 500)

  const layoutId: LayoutId = room.language === 'uk' ? 'yq' : 'qwerty'
  const metrics = computeMetrics({ log, text, layout: layouts[layoutId], elapsedMs })

  const typed = log.char.filter((_, i) => log.kind[i] === 'char').join('')
  const validated = typed.length >= [...text].length
  const reason = validated ? null : 'text_mismatch'
  const score = validated ? scoreOf(metrics.spm, metrics.accuracy) : 0

  const { error } = await service.from('race_results').upsert(
    {
      room_id: roomId,
      user_id: auth.user.id,
      attempt_id: attemptId ?? null,
      spm: metrics.spm,
      accuracy: metrics.accuracy,
      score,
      validated,
      rejection_reason: reason,
    },
    { onConflict: 'room_id,user_id' },
  )
  if (error) return json({ error: error.message }, 500)

  return json({
    result: { spm: metrics.spm, accuracy: metrics.accuracy, score },
    validated,
    ...(reason ? { reason } : {}),
  })
})
