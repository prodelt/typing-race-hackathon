import { createClient } from 'jsr:@supabase/supabase-js@2'
import { layouts } from '@typing-race/curriculum'
import type { KeystrokeEventLog, LayoutId } from '@typing-race/domain'
import { computeMetrics } from '@typing-race/metrics'
import { json, preflight } from '../_shared/cors.ts'
import { overQuota } from '../_shared/rate-limit.ts'
import { replay, scoreOf } from '../_shared/race-replay.ts'

/**
 * `finish-race` — the only place a race finish becomes a Validated Result.
 *
 * Training attempts get plausibility checks; race finishes get **replayed**. The client's log is
 * read for what was typed and when, and nothing else: whether each keystroke was right is decided
 * here, against the room's own text, never taken from the `correct` flags the client sent. A log
 * that does not reach the end of the room's text is not a slow race; it is a different race.
 *
 * The metrics are the same `computeMetrics` the browser ran (bundled from `packages/metrics`), fed
 * the replayed log, so the number on the results screen is the number the server computed.
 */

/** Slack for the round trip and for a timer that started a frame early. */
const CLOCK_SLACK_MS = 2_000

/** A human does not sustain more than this; faster is a script. */
const MAX_PLAUSIBLE_SPM = 1_500

/**
 * Limits of one request. A race text is at most 400 characters (the `race_texts` check), so a log of
 * twenty thousand events is not a race; it is a request that only burns the function's time.
 */
const MAX_BODY_BYTES = 2_000_000
const MAX_LOG_EVENTS = 20_000
const MAX_ELAPSED_MS = 3_600_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const userId = auth.user.id

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const limited = await overQuota(service, userId, 'finish-race')
  if (limited) return limited

  // The body is read before its size is judged: answering from `Content-Length` alone leaves the
  // upload unread, and the runtime then holds the connection until the client gives up.
  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) return json({ error: 'body_too_large', max: MAX_BODY_BYTES }, 413)
  let body: { roomId?: unknown; log?: KeystrokeEventLog; elapsedMs?: unknown }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'body is not JSON' }, 400)
  }

  const { roomId, log, elapsedMs } = body ?? {}
  if (
    typeof roomId !== 'string' ||
    !UUID.test(roomId) ||
    !log ||
    !Array.isArray(log.dt) ||
    !Array.isArray(log.kind) ||
    !Array.isArray(log.char) ||
    log.dt.length > MAX_LOG_EVENTS ||
    log.kind.length > MAX_LOG_EVENTS ||
    log.char.length > MAX_LOG_EVENTS ||
    typeof elapsedMs !== 'number' ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0 ||
    elapsedMs > MAX_ELAPSED_MS
  ) {
    return json({ error: 'roomId, log and elapsedMs are required' }, 400)
  }

  const { data: seat } = await service
    .from('race_participants')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!seat) return json({ error: 'not in this room' }, 403)

  // A result is immutable: a retry, or a second submission, gets the first answer back.
  const { data: earlier } = await service
    .from('race_results')
    .select('spm, accuracy, score, validated, rejection_reason')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()
  if (earlier) {
    return json({
      result: {
        spm: Number(earlier.spm),
        accuracy: Number(earlier.accuracy),
        score: Number(earlier.score),
      },
      validated: earlier.validated,
      ...(earlier.rejection_reason ? { reason: earlier.rejection_reason } : {}),
    })
  }

  if (seat.role !== 'racer') return json({ error: 'spectators do not finish' }, 409)

  // The room's own text and language. Not the client's copy of them: that is the point.
  const { data: room } = await service
    .from('race_rooms')
    .select('id, language, state, starts_at, race_texts ( body )')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) return json({ error: 'no such room' }, 404)
  if (!room.starts_at) return json({ error: 'race has not started' }, 409)

  const text = (room.race_texts as unknown as { body: string } | null)?.body
  if (!text) return json({ error: 'room has no text' }, 500)

  const startedAt = Date.parse(room.starts_at)
  const sinceStart = Date.now() - startedAt
  const replayed = replay(log, text)
  const loggedMs = replayed.log.dt.reduce((sum, delta) => sum + delta, 0)

  const layoutId: LayoutId = room.language === 'uk' ? 'yq' : 'qwerty'
  const metrics = computeMetrics({ log: replayed.log, text, layout: layouts[layoutId], elapsedMs })

  let reason: string | null = null
  if (replayed.reached < Array.from(text).length) reason = 'text_mismatch'
  else if (sinceStart + CLOCK_SLACK_MS < elapsedMs) reason = 'future_timestamp'
  else if (loggedMs > elapsedMs + CLOCK_SLACK_MS) reason = 'log_malformed'
  else if (metrics.spm > MAX_PLAUSIBLE_SPM) reason = 'too_fast'

  const validated = reason === null
  const score = validated ? scoreOf(metrics.spm, metrics.accuracy) : 0
  // numeric(7, 2): a rejected, absurd speed is still stored, just clamped to fit.
  const spm = Math.min(99_999, Math.round(metrics.spm * 100) / 100)
  const accuracy = Math.round(metrics.accuracy * 10_000) / 10_000

  const { error } = await service.from('race_results').upsert(
    {
      room_id: roomId,
      user_id: userId,
      spm,
      accuracy,
      score,
      validated,
      rejection_reason: reason,
    },
    { onConflict: 'room_id,user_id', ignoreDuplicates: true },
  )
  if (error) return json({ error: error.message }, 500)

  await service.rpc('race_notify', {
    p_room: roomId,
    p_event: 'result',
    p_payload: { userId },
  })
  await service.rpc('settle_race', { p_room: roomId })

  return json({
    result: { spm, accuracy, score },
    validated,
    ...(reason ? { reason } : {}),
  })
})
