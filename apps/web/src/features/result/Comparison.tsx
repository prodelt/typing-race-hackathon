import type { AttemptSummary } from '@typing-race/domain'
import { Card } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { number, signed } from './format.js'

/**
 * T100. This attempt against the learner's best earlier one on the same exercise (FR-027). The
 * first attempt has nothing to compare with and says so, rather than showing a zero difference
 * that would read as "no change".
 */
export function Comparison({
  attempt,
  previous,
}: {
  readonly attempt: AttemptSummary
  readonly previous: AttemptSummary | null
}) {
  return (
    <Card aria-labelledby="result-comparison" role="region" className="p-5">
      <h2 id="result-comparison" className="font-ui text-lg font-bold">
        {m.result_comparison_heading()}
      </h2>
      {previous === null ? (
        <p className="mt-2 font-ui">{m.result_compare_none()}</p>
      ) : (
        <>
          <p className="mt-2 font-ui">
            {m.result_compare_previous({
              spm: number(previous.metrics.spm, 1),
              accuracy: number(previous.metrics.accuracy * 100, 1),
            })}
          </p>
          <p className="mt-1 font-ui">
            {m.result_compare_delta({
              spmDelta: signed(attempt.metrics.spm - previous.metrics.spm, 1),
              accuracyDelta: signed(
                (attempt.metrics.accuracy - previous.metrics.accuracy) * 100,
                1,
              ),
            })}
          </p>
        </>
      )}
    </Card>
  )
}
