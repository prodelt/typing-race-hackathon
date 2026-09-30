import type { AttemptSummary } from '@typing-race/domain'
import { Index } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { number, signed } from './format.js'

/**
 * This attempt against the learner's best earlier one on the same exercise. The first attempt has
 * nothing to compare with and says so, rather than showing a zero difference that would read as
 * "no change".
 */
export function Comparison({
  attempt,
  previous,
}: {
  readonly attempt: AttemptSummary
  readonly previous: AttemptSummary | null
}) {
  return (
    <section
      id="comparison"
      data-section={m.result_comparison_heading()}
      aria-labelledby="result-comparison"
      className="result-sec"
    >
      <Index n={2} />
      <h2 id="result-comparison" className="result-sec__title">
        {m.result_comparison_heading()}
      </h2>
      {previous === null ? (
        <p className="result-sec__lede">{m.result_compare_none()}</p>
      ) : (
        <div className="compare">
          <p className="compare__delta">
            {m.result_compare_delta({
              spmDelta: signed(attempt.metrics.spm - previous.metrics.spm, 1),
              accuracyDelta: signed(
                (attempt.metrics.accuracy - previous.metrics.accuracy) * 100,
                1,
              ),
            })}
          </p>
          <p className="result-sec__lede">
            {m.result_compare_previous({
              spm: number(previous.metrics.spm, 1),
              accuracy: number(previous.metrics.accuracy * 100, 1),
            })}
          </p>
        </div>
      )}
    </section>
  )
}
