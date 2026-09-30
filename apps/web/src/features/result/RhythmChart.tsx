import type { AttemptSummary } from '@typing-race/domain'
import { Card } from '@typing-race/ui'
import { useId } from 'react'
import { m } from '../../paraglide/messages.js'
import { SLOW_INTERVAL_MS, transitionLabel } from './model.js'

/**
 * T101. The rhythm chart: hand-written SVG, no chart library (ticket 11).
 *
 * It is drawn from the per-Transition mean intervals the attempt keeps forever, not from the
 * keystroke log. That is deliberate: the log is pruned after twenty attempts (FR-081), and a chart
 * that vanished with it would make an old result look broken. The cost is that the x axis is
 * ranked by slowness rather than by time.
 *
 * A Transition slower than 400 ms is terracotta **and** hatched **and** carries a triangle
 * marker, so the distinction survives a colour-blind reader and the low-vision theme (scenario 9).
 * The same numbers are also in the tables under "All figures", and the summary sentence states
 * the count.
 */

/** How many of the slowest transitions get an axis label; the rest are in the table below. */
const LABELLED_BARS = 5

const WIDTH = 640
const PLOT_HEIGHT = 140
const LABEL_HEIGHT = 26
const TOP = 16
const HEIGHT = TOP + PLOT_HEIGHT + LABEL_HEIGHT
/** More bars than this stop being readable at phone width; the table carries the rest. */
const MAX_BARS = 20
const GAP = 6

export function RhythmChart({ attempt }: { readonly attempt: AttemptSummary }) {
  const patternId = `slow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const all = Object.entries(attempt.metrics.meanIkiByTransition).sort((a, b) => b[1] - a[1])
  const bars = all.slice(0, MAX_BARS)
  const slow = all.filter(([, ms]) => ms > SLOW_INTERVAL_MS).length

  const ceiling = Math.max(SLOW_INTERVAL_MS * 1.25, ...bars.map(([, ms]) => ms)) * 1.05
  const y = (ms: number) => TOP + PLOT_HEIGHT - (ms / ceiling) * PLOT_HEIGHT
  const slot = WIDTH / Math.max(bars.length, 1)

  const summary =
    slow === 0 ? m.result_chart_summary_none() : m.result_chart_summary({ slow, total: all.length })

  return (
    <Card aria-labelledby="result-chart" role="region" className="p-5">
      <h2 id="result-chart" className="font-ui text-lg font-bold">
        {m.result_chart_heading()}
      </h2>
      <p className="mt-1 font-ui text-sm text-muted">{m.result_chart_intro()}</p>
      {bars.length === 0 ? (
        <p className="mt-3 font-ui">{m.result_chart_empty()}</p>
      ) : (
        <>
          <svg
            role="img"
            aria-label={`${m.result_chart_title()}. ${summary}`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mt-3 h-auto w-full"
          >
            <defs>
              <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="var(--color-terracotta-tint)" />
                <path d="M-1 1 L1 -1 M0 6 L6 0 M5 7 L7 5" stroke="var(--color-terracotta)" />
              </pattern>
            </defs>
            <line
              x1="0"
              x2={WIDTH}
              y1={y(SLOW_INTERVAL_MS)}
              y2={y(SLOW_INTERVAL_MS)}
              stroke="var(--color-terracotta)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x={WIDTH - 2}
              y={y(SLOW_INTERVAL_MS) - 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-ink)"
              className="font-mono"
            >
              {m.result_chart_limit()}
            </text>
            {bars.map(([key, ms], i) => {
              const isSlow = ms > SLOW_INTERVAL_MS
              const x = i * slot + GAP / 2
              const width = slot - GAP
              return (
                <g key={key}>
                  <rect
                    className="result-bar"
                    style={{ ['--i' as string]: i }}
                    x={x}
                    y={y(ms)}
                    width={width}
                    height={TOP + PLOT_HEIGHT - y(ms)}
                    rx="3"
                    fill={isSlow ? `url(#${patternId})` : 'var(--color-sage)'}
                    stroke={isSlow ? 'var(--color-terracotta)' : 'none'}
                    strokeWidth="1.5"
                  />
                  {isSlow ? (
                    <path
                      d={`M${x + width / 2 - 5} ${y(ms) - 4} l5 -8 l5 8 z`}
                      fill="var(--color-terracotta)"
                    />
                  ) : null}
                  {/*
                    Labels only on the slowest few. Twenty `a → b` labels across this width overlap
                    into an unreadable smear, and the chart's job is the *shape* — where the slow
                    ones are. The exact figure for every transition is already in the table below,
                    which is also what makes the chart readable without relying on colour, so
                    crowding the axis buys nothing and costs legibility.
                  */}
                  {i < LABELLED_BARS ? (
                    <text
                      x={x + width / 2}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      fontSize="12"
                      fill="var(--color-ink)"
                      className="font-mono"
                    >
                      {transitionLabel(key)}
                    </text>
                  ) : null}
                </g>
              )
            })}
            <line
              x1="0"
              x2={WIDTH}
              y1={TOP + PLOT_HEIGHT}
              y2={TOP + PLOT_HEIGHT}
              stroke="var(--color-hairline-strong)"
            />
          </svg>
          <p className="mt-2 font-ui text-sm text-ink" data-testid="chart-summary">
            {summary}
          </p>
          <p className="mt-1 flex items-center gap-2 font-ui text-sm text-muted">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-5 rounded-sm border border-terracotta"
              style={{
                background:
                  'repeating-linear-gradient(135deg, var(--color-terracotta) 0 1px, var(--color-terracotta-tint) 1px 4px)',
              }}
            />
            {m.result_chart_slow()}
          </p>
        </>
      )}
    </Card>
  )
}
