/**
 * The pure rules of sync (ADR-0006), apart from the engine that sequences them. No store, no
 * network, no clock: every decision the engine makes about retries, merging, settings and the
 * outbox is one of these functions, so each is tested on its own.
 */

/** The first retry after a failed sync; each further failure doubles it. */
export const FIRST_RETRY_MS = 2_000
/** However long the outage, a device tries again at least this often. */
export const MAX_RETRY_MS = 5 * 60_000

/**
 * How long to wait after the `failures`-th consecutive failure (0 for the first). Exponential and
 * capped, and never shorter than what the server asked for: a rate-limited `submit-attempt`
 * answers 429 with `Retry-After`, and retrying sooner would only spend the next window too.
 */
export function retryDelay(failures: number, retryAfterMs = 0): number {
  const exponent = Math.min(Math.max(failures, 0), 30)
  const backoff = Math.min(FIRST_RETRY_MS * 2 ** exponent, MAX_RETRY_MS)
  return Math.max(backoff, retryAfterMs)
}

/**
 * The union of attempts, from the device's side: the cloud attempts it does not have yet.
 * Attempts are immutable with client UUIDs (ADR-0004), so an id the device knows is the same
 * attempt and is never overwritten.
 */
export function missingFrom<T extends { readonly id: string }>(
  local: readonly { readonly id: string }[],
  cloud: readonly T[],
): T[] {
  const known = new Set(local.map((attempt) => attempt.id))
  const missing: T[] = []
  for (const attempt of cloud) {
    if (known.has(attempt.id)) continue
    known.add(attempt.id)
    missing.push(attempt)
  }
  return missing
}

export interface Stamped<T> {
  readonly settings: T
  /** Epoch ms of the write; 0 means never written. */
  readonly updatedAt: number
}

/**
 * Settings, last write wins by `updatedAt`. `take`: apply the cloud copy locally. `push`: send the
 * local copy up. `keep`: nothing to do. An unstamped local copy is the defaults nobody chose, so it
 * never overwrites an account's settings.
 */
export function resolveSettings<T>(
  local: Stamped<T> | null,
  cloud: Stamped<T> | null,
): 'take' | 'push' | 'keep' {
  const localStamp = local?.updatedAt ?? 0
  const cloudStamp = cloud?.updatedAt ?? 0
  if (cloud !== null && cloudStamp > localStamp) return 'take'
  if (local !== null && localStamp > cloudStamp) return 'push'
  return 'keep'
}

/** Splits the outbox into requests: `submit-attempt` recomputes every attempt within one call. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface UploadReply {
  readonly accepted: readonly string[]
  readonly rejected: readonly { readonly id: string; readonly reason: string }[]
}

/**
 * The ids that leave the outbox after a reply. Accepted ones are in the cloud. Refused ones leave
 * too, because the server would refuse them forever — except an exercise it does not know yet (an
 * older deploy), which stays and is re-sent, since dropping it would lose it from the account.
 */
export function settleUpload(reply: UploadReply): string[] {
  return [
    ...reply.accepted,
    ...reply.rejected.filter((r) => r.reason !== 'unknown_scale').map((r) => r.id),
  ]
}
