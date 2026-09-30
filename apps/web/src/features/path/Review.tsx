import { Link } from '@tanstack/react-router'
import { fingerOf, MIN_TRANSITION_SAMPLES, WEAK_CONFIDENCE_CEILING } from '@typing-race/curriculum'
import type { Layout, Progress, Scale } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { CONFIDENCE_MIN_SAMPLES } from '@typing-race/metrics'
import { buttonClass, Index } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { displayChar } from './model.js'

/**
 * A way to practise the learner's weak keys and Transitions specifically.
 *
 * Separate from the Next Action, and deliberately so. The Next Action names **one** thing and is
 * the product's answer to "what now"; this is the answer to a different question, "what am I
 * actually bad at", which a learner is entitled to ask and to browse. Collapsing the two would
 * either give the coach a list or leave the learner with no way to see their own weaknesses.
 *
 * **Nothing under-observed is named.** An element with fewer than five observations has no
 * confidence value at all, and a Transition below `MIN_TRANSITION_SAMPLES` is never named to a
 * learner. Telling someone their weakest transition on the strength of two keystrokes is not
 * feedback, it is noise wearing feedback's clothes.
 */

interface WeakElement {
  readonly key: string
  readonly label: string
  readonly confidence: number
  readonly kind: 'key' | 'transition'
  /** A scale focused on this element, when one is startable. */
  readonly scaleId: string | undefined
}

/** How many to show. Enough to be useful, few enough that the list is not a verdict. */
const SHOWN = 6

function weakest(progress: Progress, catalogue: readonly Scale[]): WeakElement[] {
  const found: WeakElement[] = []

  for (const [char, confidence] of Object.entries(progress.keyConfidence)) {
    // `undefined` means "not measured yet", which is not the same as "weak" and must never be
    // presented as one.
    if (confidence === undefined || confidence >= WEAK_CONFIDENCE_CEILING) continue
    found.push({
      key: char,
      label: displayChar(char),
      confidence,
      kind: 'key',
      scaleId: catalogue.find((s) => s.focus.kind === 'key' && s.focus.value === char)?.id,
    })
  }

  for (const [key, confidence] of Object.entries(progress.transitionConfidence)) {
    if (confidence === undefined || confidence >= WEAK_CONFIDENCE_CEILING) continue
    const pair = parseTransitionKey(key)
    if (!pair) continue
    found.push({
      key,
      label: `${displayChar(pair.from)} → ${displayChar(pair.to)}`,
      confidence,
      kind: 'transition',
      scaleId: catalogue.find((s) => s.focus.kind === 'transition' && s.focus.value === key)?.id,
    })
  }

  return found.sort((a, b) => a.confidence - b.confidence).slice(0, SHOWN)
}

export interface ReviewProps {
  readonly progress: Progress
  readonly layout: Layout
  readonly catalogue: readonly Scale[]
}

export function Review({ progress, layout, catalogue }: ReviewProps) {
  const weak = weakest(progress, catalogue)

  return (
    <section
      id="weak"
      data-section={m.path_review_title()}
      aria-labelledby="path-review"
      className="path-sec"
    >
      <Index n={5} />
      <h2 id="path-review" className="path-sec__title">
        {m.path_review_title()}
      </h2>
      <p className="path-sec__lede">{m.path_review_intro()}</p>

      {weak.length === 0 ? (
        // Not an empty state to apologise for. Below five observations there is genuinely nothing
        // to say, and saying it plainly is better than inventing a weakness.
        <p className="path-sec__lede">
          {m.path_review_not_enough({ samples: String(CONFIDENCE_MIN_SAMPLES) })}
        </p>
      ) : (
        <ul className="weak">
          {weak.map((element) => {
            const finger = element.kind === 'key' ? fingerOf(layout, element.key) : undefined
            return (
              <li key={element.key}>
                <span className="weak__top">
                  <span className="weak__glyph">{element.label}</span>
                  {/* The number is shown, not just the ranking: a learner comparing two weak
                      elements deserves to see how far apart they are. */}
                  <span className="num weak__pct">{Math.round(element.confidence * 100)}%</span>
                </span>
                <span className="weak__meta">
                  {element.kind === 'key' ? m.path_review_key() : m.path_review_transition()}
                  {finger !== undefined &&
                    `, ${m.path_review_finger({ finger: finger.finger, hand: finger.hand })}`}
                </span>
                {element.scaleId ? (
                  <Link
                    to="/exercise/$scaleId"
                    params={{ scaleId: element.scaleId }}
                    search={{ mode: 'practice' }}
                    className={`${buttonClass('secondary', 'sm')} self-start`}
                  >
                    {m.path_review_practise()}
                  </Link>
                ) : (
                  // A weak Transition often has no drill of its own yet. Saying so is better than
                  // a button that goes nowhere.
                  <span className="weak__meta">{m.path_review_no_drill()}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="note mt-6">
        {m.path_review_threshold({ samples: String(MIN_TRANSITION_SAMPLES) })}
      </p>
    </section>
  )
}
