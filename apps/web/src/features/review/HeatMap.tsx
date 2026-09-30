import { type SpotStats, statsOf, sumAggregates } from '@typing-race/curriculum'
import type { AttemptSummary, ElementStats, Key, Layout } from '@typing-race/domain'
import { type CSSProperties, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { glyph, pct } from './format.js'

/**
 * The error map: the learner's own keyboard, every key filled by how badly it goes — the share of
 * misses, or the mean interval to reach it — over the recent attempts. Hand-drawn SVG.
 *
 * One hue, the brand red, mixed into the paper by severity, so the map reads at a glance and the
 * three themes apply unchanged. A key never typed is drawn hollow rather than pale, so "unseen"
 * cannot be mistaken for "fine". The numbers are on the keys too, and the sentence under the map
 * names the worst keys, so nothing depends on telling two reds apart.
 */

type Metric = 'errors' | 'tempo'

const UNIT = 50
const KEY = 44
const ROWS = ['digit', 'top', 'home', 'bottom'] as const
/** The stagger of a physical keyboard, in key widths. */
const INDENT = { digit: 0, top: 0.5, home: 0.75, bottom: 1.25 } as const
/** The error rate that fills a key completely; worse than this is as bad as it gets. */
const ERROR_CEILING = 0.25
/** Intervals mapped onto the scale: this fast is paper, this slow is full red. */
const FAST_MS = 150
const SLOW_MS = 600
/** How many keys the sentence under the map names. */
const NAMED = 3
/** Fewer presses than this and a key is drawn, but not judged. */
const MIN_PRESSES = 5

function severity(metric: Metric, stats: SpotStats): number {
  if (metric === 'errors') return Math.min(1, stats.errorRate / ERROR_CEILING)
  if (stats.meanIkiMs === null) return stats.count > 0 ? 1 : 0
  return Math.min(1, Math.max(0, (stats.meanIkiMs - FAST_MS) / (SLOW_MS - FAST_MS)))
}

function fillOf(t: number): string {
  return `color-mix(in oklab, var(--color-accent) ${Math.round(t * 100)}%, var(--color-paper-raised))`
}

/** A key's stats, its plain and shifted characters together: a capital is the same reach. */
function keyStats(keys: Map<string, ElementStats>, key: Key): SpotStats {
  const chars = [key.plain, key.shifted].filter((c): c is string => c !== null && c !== '')
  const summed = chars.reduce<ElementStats>(
    (acc, char) => {
      const s = keys.get(char)
      return s === undefined
        ? acc
        : {
            count: acc.count + s.count,
            misses: acc.misses + s.misses,
            sumIki: acc.sumIki + s.sumIki,
            sumIkiSq: acc.sumIkiSq + s.sumIkiSq,
          }
    },
    { count: 0, misses: 0, sumIki: 0, sumIkiSq: 0 },
  )
  return statsOf(summed)
}

interface Placed {
  readonly key: Key
  readonly x: number
  readonly y: number
  readonly w: number
  readonly stats: SpotStats
}

function place(layout: Layout, keys: Map<string, ElementStats>): Placed[] {
  const placed: Placed[] = []
  ROWS.forEach((row, r) => {
    const inRow = layout.keys.filter(
      (key) => key.row === row && key.kind !== 'modifier' && key.kind !== 'space',
    )
    inRow.forEach((key, i) => {
      placed.push({
        key,
        x: (INDENT[row] + i) * UNIT,
        y: r * UNIT,
        w: KEY,
        stats: keyStats(keys, key),
      })
    })
  })
  const space = layout.keys.find((key) => key.kind === 'space')
  if (space !== undefined) {
    placed.push({
      key: space,
      x: 3.5 * UNIT,
      y: ROWS.length * UNIT,
      w: 6 * UNIT - (UNIT - KEY),
      stats: keyStats(keys, space),
    })
  }
  return placed
}

function keyValue(metric: Metric, stats: SpotStats): string {
  if (metric === 'errors') return `${pct(stats.errorRate)}%`
  return stats.meanIkiMs === null ? '·' : String(Math.round(stats.meanIkiMs))
}

export function HeatMap({
  layout,
  history,
}: {
  readonly layout: Layout
  readonly history: readonly AttemptSummary[]
}) {
  const [metric, setMetric] = useState<Metric>('errors')
  const { keys } = sumAggregates(history)
  const placed = place(layout, keys)
  const width = Math.max(...placed.map((p) => p.x + p.w))
  const height = (ROWS.length + 1) * UNIT - (UNIT - KEY)

  const judged = placed.filter((p) => p.stats.count >= MIN_PRESSES && p.key.kind !== 'space')
  const worst = judged
    .map((p) => ({ p, t: severity(metric, p.stats) }))
    .filter(({ t }) => t > 0.2)
    .sort((a, b) => b.t - a.t)
    .slice(0, NAMED)
    .map(({ p }) => glyph(p.key.plain))
  const summary =
    worst.length === 0
      ? m.review_map_summary_none()
      : metric === 'errors'
        ? m.review_map_summary_errors({ keys: worst.join(', ') })
        : m.review_map_summary_tempo({ keys: worst.join(', ') })

  return (
    <section className="review-card review-map" aria-labelledby="review-map-title">
      <header className="review-card__head">
        <h2 id="review-map-title" className="review-card__title">
          {m.review_map_heading()}
        </h2>
        {/* biome-ignore lint/a11y/useSemanticElements: a pair of toggle buttons, as in the shell's language switch */}
        <div role="group" aria-label={m.review_map_heading()} className="review-toggle">
          {(['errors', 'tempo'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={metric === value}
              className="review-toggle__option"
              onClick={() => setMetric(value)}
            >
              {value === 'errors' ? m.review_map_errors() : m.review_map_tempo()}
            </button>
          ))}
        </div>
      </header>
      <p className="review-card__intro">{m.review_map_intro()}</p>

      <svg
        role="img"
        aria-label={`${m.review_map_heading()}. ${summary}`}
        viewBox={`-2 -2 ${width + 4} ${height + 4}`}
        className="review-map__svg"
        data-testid="review-heatmap"
        data-metric={metric}
      >
        {placed.map((p, i) => {
          const seen = p.stats.count > 0
          const t = seen ? severity(metric, p.stats) : 0
          const label = p.key.kind === 'space' ? m.review_space() : glyph(p.key.plain)
          const title = seen
            ? m.review_map_key({
                key: label,
                errors: pct(p.stats.errorRate),
                ms: p.stats.meanIkiMs === null ? '·' : Math.round(p.stats.meanIkiMs),
                count: p.stats.count,
              })
            : m.review_map_key_unseen({ key: label })
          const ink = t > 0.55 ? 'var(--color-on-accent)' : 'var(--color-ink)'
          return (
            <g
              key={p.key.code}
              className="review-map__key"
              style={{ '--i': i } as CSSProperties}
              data-code={p.key.code}
              data-severity={t.toFixed(2)}
            >
              <title>{title}</title>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={KEY}
                rx={9}
                fill={seen ? fillOf(t) : 'transparent'}
                stroke={seen ? 'var(--color-hairline)' : 'var(--color-hairline-strong)'}
                strokeDasharray={seen ? undefined : '3 3'}
              />
              {p.key.kind !== 'space' && (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + 21}
                  textAnchor="middle"
                  className="review-map__glyph"
                  fill={seen ? ink : 'var(--color-muted)'}
                >
                  {glyph(p.key.plain).toUpperCase()}
                </text>
              )}
              {/* A clean key carries no number on the error map: "0%" on every key is noise. */}
              {seen && !(metric === 'errors' && p.stats.misses === 0) && (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + 36}
                  textAnchor="middle"
                  className="review-map__value"
                  fill={ink}
                >
                  {keyValue(metric, p.stats)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="review-legend" aria-hidden="true">
        <span className="review-legend__label">
          {metric === 'errors' ? m.review_map_legend_errors() : m.review_map_legend_tempo()}
        </span>
        <span className="review-legend__scale">
          <span>{metric === 'errors' ? '0%' : `${FAST_MS}`}</span>
          <span className="review-legend__bar" />
          <span>
            {metric === 'errors'
              ? `${pct(ERROR_CEILING)}%+`
              : `${SLOW_MS}+ ${m.review_rhythm_axis()}`}
          </span>
        </span>
        <span className="review-legend__unseen">
          <span className="review-legend__hollow" />
          {m.review_map_unseen()}
        </span>
      </div>
      <p className="review-card__summary" data-testid="review-heatmap-summary">
        {summary}
      </p>
    </section>
  )
}
