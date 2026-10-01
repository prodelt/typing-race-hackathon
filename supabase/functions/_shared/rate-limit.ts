import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

/** At most this many requests per user, per function, per window. Generous for a learner. */
export const REQUEST_LIMIT = 60
export const WINDOW_MINUTES = 10

/**
 * Records the request in the per-user window (`consume_request_quota`) and returns a 429 response
 * when it does not fit, or `null` to carry on. Fails open on a database error: a broken limiter
 * must not stop learners from saving their work.
 */
export async function overQuota(
  service: SupabaseClient,
  userId: string,
  bucket: string,
): Promise<Response | null> {
  const { data, error } = await service.rpc('consume_request_quota', {
    p_user: userId,
    p_bucket: bucket,
    p_limit: REQUEST_LIMIT,
    p_window: `${WINDOW_MINUTES} minutes`,
  })
  if (error) {
    console.error('rate limiter unavailable', error.message)
    return null
  }
  if (data === true) return null

  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      message: `Too many requests: at most ${REQUEST_LIMIT} per ${WINDOW_MINUTES} minutes. Try again in a few minutes.`,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(WINDOW_MINUTES * 60),
      },
    },
  )
}
