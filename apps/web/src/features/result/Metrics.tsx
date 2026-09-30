import type { AttemptSummary } from '@typing-race/domain'
import { Card } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { duration, number } from './format.js'
import { displayChar, transitionLabel } from './model.js'

/**
 * T099. Every metric the requirements list, read from the stored `AttemptMetrics` and never
 * recomputed here (FR-023, FR-025, FR-026). The figures are identical to the tiles above on
 * purpose: the tiles are the glance, this is the record.
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <dt className="font-ui text-ink">
        {label}
        {hint === undefined ? null : <span className="ml-2 text-sm text-muted">{hint}</span>}
      </dt>
      <dd className="font-mono text-ink">{children}</dd>
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
      <h3 className="font-ui text-base font-semibold">{heading}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 font-ui text-sm text-muted">{m.result_iki_empty()}</p>
      ) : (
        <table className="mt-2 w-full font-mono text-sm">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="py-1 font-medium">
                {column}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {m.result_col_ms()}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ms]) => (
              <tr key={label} className="border-t border-hairline">
                <th scope="row" className="py-1 text-left font-normal">
                  {label}
                </th>
                <td className="py-1 text-right">{m.result_ms({ ms: number(ms) })}</td>
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
    <Card aria-labelledby="result-metrics" role="region" className="p-5">
      <h2 id="result-metrics" className="font-ui text-lg font-bold">
        {m.result_metrics_heading()}
      </h2>
      <dl className="mt-2 divide-y divide-hairline">
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
      <p className="mt-2 font-ui text-sm text-muted">{m.result_metric_accuracy_note()}</p>
      {/* A smooth figure must not hide what it left out, so the exclusion is stated even at zero. */}
      <p className="mt-2 font-ui text-sm text-ink" data-testid="breaks-excluded">
        {rhythmConsistency.breaksExcluded > 0
          ? m.result_metric_breaks({ count: rhythmConsistency.breaksExcluded })
          : m.result_metric_breaks_none()}
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
    </Card>
  )
}
