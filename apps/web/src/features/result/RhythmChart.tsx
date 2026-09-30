import type { AttemptSummary } from '@typing-race/domain'
import { Index } from '@typing-race/ui'
import { useId } from 'react'
import { m } from '../../paraglide/messages.js'
import { SLOW_INTERVAL_MS, transitionLabel } from './model.js'

/**
 * The rhythm chart: hand-written SVG, no chart library.
 *
 * It is drawn from the per-Transition mean intervals the attempt keeps forever, not from the
 * keystroke log. That is deliberate: the log is pruned after twenty attempts, and a chart that
 * vanished with it would make an old result look broken. The cost is that the x axis is ranked by
 * slowness rather than by time.
 *
 * Drawn the way a person would sketch it on squared paper: thin columns on a hairline grid, the
 * 400 ms line dashed across in red, and every transition slower than that line hatched, outlined
 * in red **and** carrying a wedge above it, so the distinction survives a colour-blind reader and
 * the low-vision theme. The same numbers are in the tables under "All figures", and the summary
 * sentence states the count.
 */

/** How many of the slowest transitions get an axis label; the rest are in the table below. */
const LABELLED_BARS = 6

const WIDTH = 880
const LEFT = 44
const PLOT_HEIGHT = 200
const LABEL_HEIGHT = 64
const TOP = 22
const HEIGHT = TOP + PLOT_HEIGHT + LABEL_HEIGHT
/** More bars than this stop being readable; the table carries the rest. */
const MAX_BARS = 24
/** A column is a stroke, not a block: this much of its slot, never wider than BAR_MAX. */
const BAR_SHARE = 0.34
const BAR_MAX = 18
const GRID_STEP_MS = 200

export function RhythmChart({ attempt }: { readonly attempt: AttemptSummary }) {
  const patternId = `slow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const all = Object.entries(attempt.metrics.meanIkiByTransition).sort((a, b) => b[1] - a[1])
  const bars = all.slice(0, MAX_BARS)
  const slow = all.filter(([, ms]) => ms > SLOW_INTERVAL_MS).length

  const ceiling = Math.max(SLOW_INTERVAL_MS * 1.5, ...bars.map(([, ms]) => ms)) * 1.08
  const y = (ms: number) => TOP + PLOT_HEIGHT - (ms / ceiling) * PLOT_HEIGHT
  const slot = (WIDTH - LEFT) / Math.max(bars.length, 1)
  const grid = Array.from(
    { length: Math.floor(ceiling / GRID_STEP_MS) },
    (_, i) => (i + 1) * GRID_STEP_MS,
  )

  const summary =
    slow === 0 ? m.result_chart_summary_none() : m.result_chart_summary({ slow, total: all.length })

  return (
    <section
      id="rhythm"
      data-section={m.result_chart_heading()}
      aria-labelledby="result-chart"
      className="result-sec"
    >
      <Index n={3} />
      <h2 id="result-chart" className="result-sec__title">
        {m.result_chart_heading()}
      </h2>
      <p className="result-sec__lede">{m.result_chart_intro()}</p>
      {bars.length === 0 ? (
        <p className="result-sec__lede">{m.result_chart_empty()}</p>
      ) : (
        <div className="rhythm">
          <svg
            role="img"
            aria-label={`${m.result_chart_title()}. ${summary}`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="rhythm__svg"
          >
            <defs>
              <pattern
                id={patternId}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="5" height="5" fill="var(--color-terracotta-tint)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="5"
                  stroke="var(--color-terracotta)"
                  strokeWidth="1.6"
                />
              </pattern>
            </defs>

            {/* The squared paper: a hairline every 200 ms, labelled at the left edge. */}
            {grid.map((ms) => (
              <g key={ms}>
                <line
                  x1={LEFT}
                  x2={WIDTH}
                  y1={y(ms)}
                  y2={y(ms)}
                  stroke="var(--color-hairline)"
                  strokeWidth="1"
                />
                <text
                  x={LEFT - 10}
                  y={y(ms) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--color-muted)"
                  className="rhythm__tick"
                >
                  {ms}
                </text>
              </g>
            ))}

            {bars.map(([key, ms], i) => {
              const isSlow = ms > SLOW_INTERVAL_MS
              const width = Math.min(BAR_MAX, Math.max(6, slot * BAR_SHARE))
              const cx = LEFT + i * slot + slot / 2
              const x = cx - width / 2
              return (
                <g key={key}>
                  <rect
                    className="result-bar"
                    style={{ ['--i' as string]: i }}
                    x={x}
                    y={y(ms)}
                    width={width}
                    height={TOP + PLOT_HEIGHT - y(ms)}
                    rx={width / 2}
                    fill={isSlow ? `url(#${patternId})` : 'var(--color-sage)'}
                    stroke={isSlow ? 'var(--color-terracotta)' : 'none'}
                    strokeWidth="1.5"
                  />
                  {isSlow ? (
                    <path
                      d={`M${cx - 5} ${y(ms) - 12} l10 0 l-5 7 z`}
                      fill="var(--color-terracotta)"
                    />
                  ) : null}
                  {/*
                    Labels only on the slowest few. Two dozen `a → b` labels across this width
                    overlap into an unreadable smear, and the chart's job is the *shape*: where
                    the slow ones are. The exact figure for every transition is in the table
                    below, which is also what makes the chart readable without relying on colour.
                  */}
                  {i < LABELLED_BARS ? (
                    <text
                      x={cx + 4}
                      y={TOP + PLOT_HEIGHT + 18}
                      textAnchor="end"
                      fontSize="13"
                      fontWeight="500"
                      fill="var(--color-ink)"
                      className="rhythm__label"
                      transform={`rotate(-32 ${cx + 4} ${TOP + PLOT_HEIGHT + 18})`}
                    >
                      {transitionLabel(key)}
                    </text>
                  ) : null}
                </g>
              )
            })}

            <line
              x1={LEFT}
              x2={WIDTH}
              y1={y(SLOW_INTERVAL_MS)}
              y2={y(SLOW_INTERVAL_MS)}
              stroke="var(--color-terracotta)"
              strokeDasharray="6 5"
              strokeWidth="1.5"
            />
            <text
              x={WIDTH}
              y={y(SLOW_INTERVAL_MS) - 8}
              textAnchor="end"
              fontSize="12"
              fontWeight="600"
              fill="var(--color-terracotta-ink)"
              className="rhythm__tick"
            >
              {m.result_chart_limit()}
            </text>
            <line
              x1={LEFT}
              x2={WIDTH}
              y1={TOP + PLOT_HEIGHT}
              y2={TOP + PLOT_HEIGHT}
              stroke="var(--color-ink)"
              strokeWidth="1"
            />
          </svg>
          <div className="rhythm__foot">
            <p className="rhythm__summary" data-testid="chart-summary">
              {summary}
            </p>
            <p className="rhythm__legend">
              <span aria-hidden="true" className="rhythm__swatch" />
              {m.result_chart_slow()}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
