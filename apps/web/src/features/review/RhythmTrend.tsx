import type { AttemptSummary } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'

/**
 * The rhythm over recent attempts: for each one, the mean interval between presses (the red line)
 * and its spread, one standard deviation either side (the band). A narrowing band is a steadier
 * hand; a falling line is a faster one. Under it, each attempt's rhythm consistency as a short bar.
 *
 * Drawn from the per-key aggregates every attempt keeps forever (count, sum and sum of squares of
 * intervals), not from the keystroke log, which is pruned after twenty attempts: an old attempt
 * keeps its place on the chart.
 */

const SHOWN = 24
const WIDTH = 460
const LEFT = 44
const RIGHT = 16
const TOP = 30
const PLOT = 150
const STRIP_GAP = 26
const STRIP = 30
const HEIGHT = TOP + PLOT + STRIP_GAP + STRIP + 8

export interface RhythmPoint {
  readonly n: number
  readonly meanMs: number
  readonly sdMs: number
  readonly rhythm: number
}

/** Mean and spread of the intervals of one attempt, from its key aggregates; `null` if too few. */
export function rhythmOf(attempt: AttemptSummary): Omit<RhythmPoint, 'n'> | null {
  let hits = 0
  let sum = 0
  let sumSq = 0
  for (const stats of Object.values(attempt.aggregates.keys)) {
    hits += stats.count - stats.misses
    sum += stats.sumIki
    sumSq += stats.sumIkiSq
  }
  if (hits < 2 || sum <= 0) return null
  const mean = sum / hits
  const variance = Math.max(0, sumSq / hits - mean * mean)
  return {
    meanMs: mean,
    sdMs: Math.sqrt(variance),
    rhythm: attempt.metrics.rhythmConsistency.value,
  }
}

function niceCeiling(value: number): number {
  const step = value > 800 ? 200 : 100
  return Math.max(step * 2, Math.ceil(value / step) * step)
}

export function RhythmTrend({ history }: { readonly history: readonly AttemptSummary[] }) {
  const recent = history.slice(-SHOWN)
  const points: RhythmPoint[] = []
  recent.forEach((attempt, i) => {
    const r = rhythmOf(attempt)
    if (r !== null) points.push({ n: history.length - recent.length + i + 1, ...r })
  })

  if (points.length === 0) {
    return (
      <section className="review-card review-rhythm" aria-labelledby="review-rhythm-title">
        <h2 id="review-rhythm-title" className="review-card__title">
          {m.review_rhythm_heading()}
        </h2>
        <p className="review-card__intro">{m.review_rhythm_empty()}</p>
      </section>
    )
  }

  const ceiling = niceCeiling(Math.max(...points.map((p) => p.meanMs + p.sdMs)) * 1.05)
  const ticks = [0, ceiling / 2, ceiling]
  const span = WIDTH - LEFT - RIGHT
  const x = (i: number) =>
    LEFT + (points.length === 1 ? span / 2 : (i / (points.length - 1)) * span)
  const y = (value: number) => TOP + PLOT - (Math.min(value, ceiling) / ceiling) * PLOT

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.meanMs)}`).join(' ')
  const upper = points.map((p, i) => `${x(i)},${y(p.meanMs + p.sdMs)}`)
  const lower = points.map((p, i) => `${x(i)},${y(Math.max(0, p.meanMs - p.sdMs))}`).reverse()
  const band = `M${upper.join(' L')} L${lower.join(' L')} Z`

  const mean = points.reduce((s, p) => s + p.meanMs, 0) / points.length
  const rhythm = points.reduce((s, p) => s + p.rhythm, 0) / points.length
  const summary = m.review_rhythm_summary({
    count: points.length,
    ms: Math.round(mean),
    rhythm: Math.round(rhythm),
  })
  const last = points[points.length - 1] as RhythmPoint
  const lastX = x(points.length - 1)
  const barWidth = Math.max(3, Math.min(14, (span / Math.max(points.length, 1)) * 0.5))
  const stripTop = TOP + PLOT + STRIP_GAP

  return (
    <section className="review-card review-rhythm" aria-labelledby="review-rhythm-title">
      <h2 id="review-rhythm-title" className="review-card__title">
        {m.review_rhythm_heading()}
      </h2>
      <p className="review-card__intro">{m.review_rhythm_intro()}</p>

      <svg
        role="img"
        aria-label={`${m.review_rhythm_heading()}. ${summary}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="review-rhythm__svg"
        data-testid="review-rhythm"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-hairline)"
              strokeWidth="1"
            />
            <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end" className="review-rhythm__tick">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={LEFT - 8} y={TOP - 16} textAnchor="end" className="review-rhythm__tick">
          {m.review_rhythm_axis()}
        </text>

        <path d={band} className="review-rhythm__band" />
        <path d={line} pathLength={1} className="review-rhythm__line" />
        {points.map((p, i) => (
          <circle
            key={p.n}
            cx={x(i)}
            cy={y(p.meanMs)}
            r={i === points.length - 1 ? 5.5 : 3}
            className={i === points.length - 1 ? 'review-rhythm__dot--last' : 'review-rhythm__dot'}
          >
            <title>
              {m.review_rhythm_attempt({
                n: p.n,
                ms: Math.round(p.meanMs),
                sd: Math.round(p.sdMs),
                rhythm: Math.round(p.rhythm),
              })}
            </title>
          </circle>
        ))}
        <text
          x={Math.min(lastX, WIDTH - RIGHT)}
          y={y(last.meanMs) - 12}
          textAnchor={points.length > 1 ? 'end' : 'middle'}
          className="review-rhythm__callout"
        >
          {`${Math.round(last.meanMs)} ${m.review_rhythm_axis()}`}
        </text>

        <text
          x={LEFT - 8}
          y={stripTop + STRIP - 4}
          textAnchor="end"
          className="review-rhythm__tick"
        >
          %
        </text>
        <line
          x1={LEFT}
          x2={WIDTH - RIGHT}
          y1={stripTop + STRIP}
          y2={stripTop + STRIP}
          stroke="var(--color-hairline-strong)"
          strokeWidth="1"
        />
        {points.map((p, i) => {
          const h = Math.max(1, (p.rhythm / 100) * STRIP)
          return (
            <rect
              key={p.n}
              x={x(i) - barWidth / 2}
              y={stripTop + STRIP - h}
              width={barWidth}
              height={h}
              rx={1.5}
              className="review-rhythm__bar"
            />
          )
        })}
        <text x={WIDTH - RIGHT} y={stripTop - 6} textAnchor="end" className="review-rhythm__tick">
          {m.review_rhythm_consistency()}
        </text>
      </svg>
      <p className="review-card__summary">{summary}</p>
    </section>
  )
}
