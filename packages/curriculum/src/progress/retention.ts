import type { AttemptSummary } from '@typing-race/domain'
import { byCompletion } from './order'

/** How many attempts keep their full keystroke log — FR-081. */
export const LOG_RETENTION_COUNT = 20

/**
 * The attempts whose keystroke logs are kept: the 20 most recent by completion time, across every
 * layout because the log store is one store. Everything not named here may be pruned, and
 * {@link deriveProgress} returns the same thing either way because it reads aggregates only
 * — FR-081, SC-019.
 */
export function retentionPlan(attempts: readonly AttemptSummary[]): {
  keepLogsFor: string[]
} {
  const recent = byCompletion(attempts).slice(-LOG_RETENTION_COUNT)
  return { keepLogsFor: recent.map((attempt) => attempt.id) }
}
