import type { AttemptSummary } from '@typing-race/domain'
import { Index } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { duration, number } from './format.js'
import { displayChar, transitionLabel } from './model.js'

/**
 * Every metric the requirements list, read from the stored `AttemptMetrics` and never recomputed
 * here. The figures are identical to the hero above on purpose: the hero is the glance, this is
 * the record.
 */

function Row({
  label,
  hint,
  children,
}: {
  readonly label: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <div className="figs__row">
      <dt>
        {label}
        {hint === undefined ? null : <span className="figs__hint">{hint}</span>}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

type IntervalRow = readonly [label: string, ms: number]

/** A table of mean intervals, slowest first, so the worst element is where the eye lands. */
function IntervalTable({
  heading,
  column,
  rows,
}: {
  readonly heading: string
  readonly column: string
  readonly rows: readonly IntervalRow[]
}) {
  return (
    <div>
      <h3 className="label">{heading}</h3>
      {rows.length === 0 ? (
        <p className="note mt-2">{m.result_iki_empty()}</p>
      ) : (
        <table className="iki">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr>
              <th scope="col">{column}</th>
              <th scope="col" className="iki__ms">
                {m.result_col_ms()}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ms]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="iki__ms">{m.result_ms({ ms: number(ms) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const slowestFirst = (a: IntervalRow, b: IntervalRow) => b[1] - a[1]

export function Metrics({ attempt }: { readonly attempt: AttemptSummary }) {
  const { metrics } = attempt
  const { rhythmConsistency } = metrics

  const keyRows: IntervalRow[] = Object.entries(metrics.meanIkiByKey)
    .map(([key, ms]): IntervalRow => [displayChar(key), ms])
    .sort(slowestFirst)
  const transitionRows: IntervalRow[] = Object.entries(metrics.meanIkiByTransition)
    .map(([key, ms]): IntervalRow => [transitionLabel(key), ms])
    .sort(slowestFirst)

  return (
    <section
      id="figures"
      data-section={m.result_metrics_heading()}
      aria-labelledby="result-metrics"
      className="result-sec"
    >
      <Index n={4} />
      <h2 id="result-metrics" className="result-sec__title">
        {m.result_metrics_heading()}
      </h2>
      <div className="figs">
        <div>
          <dl className="figs__list">
            <Row label={m.result_tile_spm()} hint={m.result_tile_spm_hint()}>
              {number(metrics.spm, 1)}
            </Row>
            <Row label={m.result_metric_wpm()} hint={m.result_metric_wpm_hint()}>
              {number(metrics.wpm, 1)}
            </Row>
            <Row label={m.result_tile_accuracy()}>{number(metrics.accuracy * 100, 1)} %</Row>
            <Row label={m.result_tile_errors()}>{number(metrics.errorCount)}</Row>
            <Row label={m.result_tile_time()}>{duration(attempt.elapsedMs)}</Row>
            <Row label={m.result_metric_rhythm()} hint={m.result_metric_rhythm_hint()}>
              {number(rhythmConsistency.value, 1)}
            </Row>
          </dl>
          <p className="note mt-4">{m.result_metric_accuracy_note()}</p>
          {/* A smooth figure must not hide what it left out, so the exclusion is stated even at
              zero. */}
          <p className="note mt-2" data-testid="breaks-excluded">
            {rhythmConsistency.breaksExcluded > 0
              ? m.result_metric_breaks({ count: rhythmConsistency.breaksExcluded })
              : m.result_metric_breaks_none()}
          </p>
        </div>
        <IntervalTable
          heading={m.result_iki_key_heading()}
          column={m.result_col_key()}
          rows={keyRows}
        />
        <IntervalTable
          heading={m.result_iki_transition_heading()}
          column={m.result_col_transition()}
          rows={transitionRows}
        />
      </div>
    </section>
  )
}
