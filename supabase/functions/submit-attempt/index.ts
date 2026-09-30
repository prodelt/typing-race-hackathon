import { createClient } from 'jsr:@supabase/supabase-js@2'
import { catalogue, deriveProgress, layouts } from '@typing-race/curriculum'
import {
  computeAggregates,
  computeMetrics,
  confidenceOf,
  foldConfidence,
} from '@typing-race/metrics'
import type {
  Attempt,
  AttemptSummary,
  KeystrokeEventLog,
  Language,
  LayoutId,
} from '@typing-race/domain'
import { json, preflight } from '../_shared/cors.ts'

// The three workspace packages are mapped in `../deno.json` and resolved with `sloppy-imports`,
// because their own internal imports are extensionless — that is what `allowImportingTsExtensions:
// false` in `tsconfig.base.json` requires of the browser build, and Deno would otherwise refuse
// them. The alternative, rewriting every import in two packages to satisfy one runtime, would put
// the tail firmly in charge of the dog.

/**
 * `submit-attempt` — the only way an attempt enters the database (ticket 21, ADR-0007).
 *
 * **It recomputes.** The client sends the keystroke log and the metadata; every number on the
 * stored attempt is derived here by importing `packages/metrics` and `packages/curriculum`
 * **unchanged** — the same code the browser ran. That import is only possible because both
 * packages are free of browser and Node APIs, which `tsconfig.base.json` enforces at compile
 * time rather than by convention. A client-supplied SPM is a claim, not a measurement, and a
 * leaderboard built on claims is built on nothing.
 *
 * **It is batched**, because the outbox flushes everything at once after a spell offline, and
 * **idempotent**, because `attempts.id` is a client-generated UUID and the insert is
 * `on conflict do nothing`. A retry after a dropped response is free.
 *
 * **It rejects with a typed reason** rather than a boolean, so the interface can tell the learner
 * what happened instead of showing a shrug.
 */

type RejectionReason =
  | 'text_mismatch'
  | 'unknown_scale'
  | 'implausible_interval'
  | 'too_fast'
  | 'log_malformed'
  | 'future_timestamp'

interface Submission {
  readonly attempt: Omit<Attempt, 'metrics' | 'aggregates'>
  readonly log: KeystrokeEventLog
  readonly dataVersion?: string
}

interface Rejection {
  readonly id: string
  readonly reason: RejectionReason
}

/**
 * Plausibility, not replay. ADR-0006 narrows server-side replay to **race finishes**; a training
 * attempt gets these checks and nothing heavier, because the cost of a false accusation against a
 * learner practising alone is far higher than the cost of an inflated personal number.
 */
const MIN_PLAUSIBLE_IKI_MS = 12
const MAX_PLAUSIBLE_SPM = 1200

function checkPlausibility(
  submission: Submission,
  text: string,
): RejectionReason | null {
  const { log, attempt } = submission

  const lengths = [log.dt.length, log.kind.length, log.char.length, log.correct.length]
  if (new Set(lengths).size !== 1) return 'log_malformed'
  if (log.dt.some((delta) => delta < 0)) return 'log_malformed'

  if (attempt.completedAt > Date.now() + 60_000) return 'future_timestamp'

  const typed = log.char.filter((_, i) => log.kind[i] === 'char').join('')
  // The log has to be able to *produce* the text. Not equality — a corrected error leaves extra
  // characters in the log, which is the whole point of counting it (FR-024).
  if (typed.length < [...text].length) return 'text_mismatch'

  // A human hand cannot reliably beat this; a script trivially can. Only consecutive correct
  // keystrokes count, so a burst inside a composition event does not look like cheating.
  const fast = log.dt.filter((delta, i) => i > 0 && log.kind[i] === 'char' && delta < MIN_PLAUSIBLE_IKI_MS)
  if (fast.length > log.dt.length / 4) return 'implausible_interval'

  const characters = log.kind.filter((kind) => kind === 'char').length
  const spm = attempt.elapsedMs > 0 ? (characters / attempt.elapsedMs) * 60_000 : 0
  if (spm > MAX_PLAUSIBLE_SPM) return 'too_fast'

  return null
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'missing authorization' }, 401)

  // Two clients on purpose. The anon client carries the caller's JWT and is used only to find out
  // *who they are*; the service client does the writing. Using the service role to answer "who is
  // this" would make every request an administrator.
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
  )

  let body: { attempts?: Submission[] }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body is not JSON' }, 400)
  }

  const submissions = body.attempts ?? []
  if (submissions.length === 0) return json({ accepted: [], rejected: [], progress: null })

  const accepted: string[] = []
  const rejected: Rejection[] = []
  const rows: Record<string, unknown>[] = []
  const logRows: Record<string, unknown>[] = []

  for (const submission of submissions) {
    const { attempt, log } = submission
    const layout = layouts[attempt.layoutId as LayoutId]
    const scale = catalogue[attempt.layoutId as LayoutId]?.find((s) => s.id === attempt.scaleId)
    if (!layout || !scale) {
      rejected.push({ id: attempt.id, reason: 'unknown_scale' })
      continue
    }

    const reason = checkPlausibility(submission, attempt.text)
    if (reason) {
      rejected.push({ id: attempt.id, reason })
      continue
    }

    // The recompute. Nothing the client sent about performance survives this line.
    const metrics = computeMetrics({
      log,
      text: attempt.text,
      layout,
      elapsedMs: attempt.elapsedMs,
    })
    const aggregates = computeAggregates({ log, text: attempt.text, layout })

    rows.push({
      id: attempt.id,
      user_id: userId,
      scale_id: attempt.scaleId,
      layout_id: attempt.layoutId,
      language: attempt.language,
      mode: attempt.mode,
      seed: attempt.seed,
      started_at: new Date(attempt.startedAt).toISOString(),
      completed_at: new Date(attempt.completedAt).toISOString(),
      elapsed_ms: attempt.elapsedMs,
      metrics,
      aggregates,
      data_version: submission.dataVersion ?? null,
    })
    logRows.push({
      attempt_id: attempt.id,
      user_id: userId,
      format_version: log.formatVersion,
      payload: log,
    })
    accepted.push(attempt.id)
  }

  if (rows.length > 0) {
    // Idempotent by client-generated id: a retried flush is a no-op rather than a duplicate.
    const { error } = await service.from('attempts').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) return json({ error: error.message }, 500)
    await service
      .from('keystroke_logs')
      .upsert(logRows, { onConflict: 'attempt_id', ignoreDuplicates: true })
  }

  // Progress is re-derived from the learner's **whole** history rather than advanced from the
  // attempts just accepted. That is what makes an outbox draining a week of offline work in an
  // arbitrary order land on the same answer as if it had arrived live (FR-050, ADR-0005).
  const language = (submissions[0]?.attempt.language ?? 'uk') as Language
  const layoutId = (submissions[0]?.attempt.layoutId ?? 'yq') as LayoutId

  const { data: history } = await service
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .order('completed_at', { ascending: true })

  const summaries: AttemptSummary[] = (history ?? []).map((row) => ({
    id: row.id,
    scaleId: row.scale_id,
    layoutId: row.layout_id,
    language: row.language,
    mode: row.mode,
    seed: Number(row.seed),
    startedAt: Date.parse(row.started_at),
    completedAt: Date.parse(row.completed_at),
    elapsedMs: row.elapsed_ms,
    metrics: row.metrics,
    aggregates: row.aggregates,
  }))

  const { data: stored } = await service
    .from('progress')
    .select('snapshot')
    .eq('user_id', userId)
    .eq('language', language)
    .maybeSingle()

  const progress = deriveProgress({
    attempts: summaries,
    layout: layouts[layoutId],
    catalogue: catalogue[layoutId],
    startingLevelChoice: stored?.snapshot?.startingLevelChoice ?? 'neverTouchTyped',
    confidence: { fold: foldConfidence, of: confidenceOf },
  })

  await service.from('progress').upsert(
    {
      user_id: userId,
      language,
      derived_version: progress.derivedVersion,
      snapshot: progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,language' },
  )

  await service.rpc('prune_keystroke_logs', { keep_per_user: 20 })

  return json({ accepted, rejected, progress })
})
