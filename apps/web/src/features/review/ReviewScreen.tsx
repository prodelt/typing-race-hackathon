import { Link } from '@tanstack/react-router'
import {
  REVIEW_DRILL_SPOTS,
  REVIEW_WINDOW,
  rankWeakSpots,
  reviewDrillId,
  stage2Open,
  type WeakSpot,
} from '@typing-race/curriculum'
import type { Progress } from '@typing-race/domain'
import { buttonClass, cx } from '@typing-race/ui'
import { type CSSProperties, useMemo } from 'react'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { numbers, reason, spotLabel, spotSpoken } from './format.js'
import { HeatMap } from './HeatMap.js'
import { RhythmTrend } from './RhythmTrend.js'
import './review.css'

/**
 * Review (Повторення): the learner's weakest keys and moves, each with the two numbers that make
 * it weak, one button that drills the worst of them together, and two pictures of the recent
 * attempts — the keyboard as an error map and the rhythm over time.
 *
 * Laid out like the Academy: a red panel carries the title, the one action and the figures; below
 * it the spots read as a numbered list, weakest first. Everything is a fold over the stored
 * attempts, recomputed on read.
 */

function order(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

export function ReviewScreen() {
  const { layout, progress } = useDerived()

  if (progress === null) {
    return (
      <article className="review">
        <h1 className="review-plain-title">{m.review_title()}</h1>
        <p role="status" className="review-note">
          {m.review_needs_level()}
        </p>
      </article>
    )
  }
  return <Review progress={progress} layout={layout} />
}

function Review({
  progress,
  layout,
}: {
  readonly progress: Progress
  readonly layout: ReturnType<typeof useDerived>['layout']
}) {
  const spots = useMemo(() => rankWeakSpots(progress, layout), [progress, layout])
  const drilled = spots.slice(0, REVIEW_DRILL_SPOTS)
  const drillId = reviewDrillId(
    layout,
    drilled.map((spot) => spot.element),
  )
  const words = stage2Open(layout, progress.unlockedSet)
  const recent = progress.history.slice(-REVIEW_WINDOW)

  return (
    <article className="review">
      <section className="review-panel" aria-labelledby="review-title">
        <div className="review-panel__body">
          <div>
            <h1 id="review-title" className="review-panel__title">
              {m.review_title()}
              <span className="review-dot" aria-hidden="true" />
            </h1>
            <p className="review-panel__lead">{m.review_lead()}</p>
            {drillId === undefined ? null : (
              <>
                <Link
                  to="/exercise/$scaleId"
                  params={{ scaleId: drillId }}
                  search={{ mode: 'practice' }}
                  className={cx(buttonClass('secondary', 'lg'), 'review-panel__cta')}
                  data-testid="review-start"
                >
                  {m.review_start()}
                </Link>
                <p className="review-panel__mode">
                  {words ? m.review_mode_words() : m.review_mode_moves()}
                </p>
              </>
            )}
          </div>

          <dl className="review-facts">
            <div>
              <dt>{m.review_fact_spots()}</dt>
              <dd data-testid="review-spot-count">{spots.length}</dd>
            </div>
            <div>
              <dt>{m.review_fact_window()}</dt>
              <dd>{recent.length}</dd>
            </div>
            <div>
              <dt>{m.review_fact_drill()}</dt>
              <dd>{drilled.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {spots.length === 0 ? (
        <Empty fresh={progress.history.length === 0} />
      ) : (
        <section className="review-spots" aria-labelledby="review-spots-title">
          <h2 id="review-spots-title" className="review-section-title">
            {m.review_list_heading()}
          </h2>
          <ol className="review-spots__list" data-testid="review-spots">
            {spots.map((spot, i) => (
              <SpotRow key={spot.element} spot={spot} n={i + 1} inDrill={i < drilled.length} />
            ))}
          </ol>
        </section>
      )}

      <div className="review-pictures">
        <HeatMap layout={layout} history={recent} />
        <RhythmTrend history={progress.history} />
      </div>
    </article>
  )
}

/** How far a spot is from fine, for the thin rule under it: the score, capped. */
function severity(spot: WeakSpot): number {
  return Math.min(1, spot.score / 2.5)
}

function SpotRow({
  spot,
  n,
  inDrill,
}: {
  readonly spot: WeakSpot
  readonly n: number
  readonly inDrill: boolean
}) {
  return (
    <li
      className="review-spot"
      style={order(n)}
      data-element={spot.element}
      data-in-drill={inDrill || undefined}
    >
      <span className="review-spot__n">[{String(n).padStart(2, '0')}]</span>
      <div className="review-spot__main">
        <p className="review-spot__label">
          <span aria-hidden="true">{spotLabel(spot.element)}</span>
          <span className="sr-only">{spotSpoken(spot.element)}</span>
        </p>
        <p className="review-spot__kind">
          {spot.kind === 'key' ? m.review_kind_key() : m.review_kind_transition()}
          <span aria-hidden="true"> · </span>
          {reason(spot)}
        </p>
      </div>
      <div className="review-spot__figures">
        <p className="review-spot__numbers" data-testid="review-spot-numbers">
          {numbers(spot)}
        </p>
        <p className="review-spot__seen">{m.review_seen({ count: spot.count })}</p>
        <div className="review-spot__rule" aria-hidden="true">
          <span style={{ '--p': severity(spot) } as CSSProperties} />
        </div>
      </div>
      <div className="review-spot__tag">
        {inDrill ? <span className="review-stamp">{m.review_in_drill()}</span> : null}
      </div>
    </li>
  )
}

function Empty({ fresh }: { readonly fresh: boolean }) {
  return (
    <section className="review-empty" data-testid="review-empty">
      <h2 className="review-empty__title">{m.review_empty_title()}</h2>
      <p className="review-empty__body">
        {fresh ? m.review_empty_fresh() : m.review_empty_clean()}
      </p>
      <Link to={fresh ? '/map' : '/'} className={buttonClass('primary', 'md')}>
        {fresh ? m.review_empty_path() : m.review_empty_today()}
      </Link>
    </section>
  )
}
