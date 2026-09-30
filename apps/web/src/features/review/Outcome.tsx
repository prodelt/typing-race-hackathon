import { Link } from '@tanstack/react-router'
import {
  compareSpot,
  elementStats,
  layouts,
  parseReviewDrillId,
  REVIEW_WINDOW,
  type SpotStats,
  type SpotVerdict,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { buttonClass } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { ms, pct, spotLabel, spotSpoken } from './format.js'
import './review.css'

/**
 * On the result of a weak-spot drill: each spot the drill trained, its numbers before (the recent
 * attempts up to this one) and in the drill, and one word on whether it improved. Accuracy decides
 * first and speed second (`compareSpot`), the same order the whole product uses.
 */

const VERDICT: Record<SpotVerdict, () => string> = {
  better: m.review_outcome_better,
  worse: m.review_outcome_worse,
  same: m.review_outcome_same,
}

function figures(stats: SpotStats): string {
  return `${pct(stats.errorRate)}% · ${ms(stats.meanIkiMs)}`
}

export function ReviewOutcome({
  attempt,
  attempts,
}: {
  readonly attempt: AttemptSummary
  readonly attempts: readonly AttemptSummary[]
}) {
  const layout = layouts[attempt.layoutId]
  const elements = parseReviewDrillId(layout, attempt.scaleId)
  if (elements === undefined) return null

  const index = attempts.findIndex((a) => a.id === attempt.id)
  const before = attempts
    .slice(0, Math.max(index, 0))
    .filter((a) => a.layoutId === attempt.layoutId)
    .slice(-REVIEW_WINDOW)

  const rows = elements.map((element) => {
    const was = elementStats(before, element)
    const now = elementStats([attempt], element)
    return { element, was, now, verdict: now.count === 0 ? null : compareSpot(was, now) }
  })
  const better = rows.filter((row) => row.verdict === 'better').length

  return (
    <section
      className="review-outcome"
      aria-labelledby="review-outcome-title"
      data-testid="review-outcome"
    >
      <h2 id="review-outcome-title" className="review-outcome__title">
        {m.review_outcome_heading()}
      </h2>
      <p className="review-outcome__intro">{m.review_outcome_intro()}</p>
      <ol className="review-outcome__list">
        {rows.map((row) => (
          <li
            key={row.element}
            className="review-outcome__row"
            data-element={row.element}
            data-verdict={row.verdict ?? 'absent'}
          >
            <span className="review-outcome__label">
              <span aria-hidden="true">{spotLabel(row.element)}</span>
              <span className="sr-only">{spotSpoken(row.element)}</span>
            </span>
            <span className="review-outcome__change">
              <span className="review-outcome__was">{figures(row.was)}</span>
              <span aria-hidden="true" className="review-outcome__arrow">
                →
              </span>
              <span className="review-outcome__now">
                {row.now.count === 0 ? m.review_outcome_absent() : figures(row.now)}
              </span>
            </span>
            <span className="review-verdict" data-verdict={row.verdict ?? 'absent'}>
              {row.verdict === null ? m.review_outcome_absent() : VERDICT[row.verdict]()}
            </span>
          </li>
        ))}
      </ol>
      <div className="review-outcome__foot">
        <p className="review-outcome__summary">
          {m.review_outcome_summary({ better, total: rows.length })}
        </p>
        <Link to="/review" className={buttonClass('secondary', 'md')}>
          {m.review_outcome_again()}
        </Link>
      </div>
    </section>
  )
}
