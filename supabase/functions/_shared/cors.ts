/**
 * The browser is the only caller, so every function needs these. Kept in one place because a
 * missing `Access-Control-Allow-Headers` fails as an opaque network error with no server log,
 * which is an afternoon nobody should spend twice.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

export function preflight(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
