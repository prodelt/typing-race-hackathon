import { Link } from '@tanstack/react-router'
import {
  fingerOf,
  MIN_TRANSITION_SAMPLES,
  scaleById,
  transitionScale,
  WEAK_CONFIDENCE_CEILING,
} from '@typing-race/curriculum'
import type { Layout, Progress, Scale } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { CONFIDENCE_MIN_SAMPLES } from '@typing-race/metrics'
import { Card, Chip } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { displayChar } from './model.js'

/**
 * T116, FR-047: a way to practise the learner's weak keys and Transitions specifically.
 *
 * Separate from the Next Action, and deliberately so. The Next Action names **one** thing and is
 * the product's answer to "what now" (FR-031); this is the answer to a different question — "what
 * am I actually bad at" — which a learner is entitled to ask and to browse. Collapsing the two
 * would either give the coach a list, which SC-010 forbids, or leave the learner with no way to
 * see their own weaknesses at all.
 *
 * **Nothing under-observed is named.** An element with fewer than five observations has no
 * confidence value at all (research R4), and a Transition below `MIN_TRANSITION_SAMPLES` is never
 * named to a learner (FR-035). Telling someone their weakest transition on the strength of two
 * keystrokes is not feedback, it is noise wearing feedback's clothes.
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

/**
 * The id of a drill the learner can start now, resolved through `scaleById` so a Transition drill
 * built on demand counts exactly like an authored Scale; `undefined` when it is not startable.
 */
function startable(layout: Layout, progress: Progress, id: string | undefined): string | undefined {
  const scale = id === undefined ? undefined : scaleById(layout, id)
  return scale?.requires.every((char) => progress.unlockedSet.includes(char)) ? scale.id : undefined
}

function weakest(progress: Progress, layout: Layout, catalogue: readonly Scale[]): WeakElement[] {
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
      scaleId: startable(
        layout,
        progress,
        catalogue.find((s) => s.focus.kind === 'key' && s.focus.value === char)?.id,
      ),
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
      scaleId: startable(
        layout,
        progress,
        catalogue.find((s) => s.focus.kind === 'transition' && s.focus.value === key)?.id ??
          transitionScale(layout, key)?.id,
      ),
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
  const weak = weakest(progress, layout, catalogue)

  return (
    <Card aria-labelledby="path-review" role="region" className="p-5">
      <h2 id="path-review" className="font-ui text-lg font-bold">
        {m.path_review_title()}
      </h2>
      <p className="mt-1 font-ui text-sm text-muted">{m.path_review_intro()}</p>

      {weak.length === 0 ? (
        // Not an empty state to apologise for. Below five observations there is genuinely nothing
        // to say, and saying it plainly is better than inventing a weakness (FR-035, research R4).
        <p className="mt-4 font-ui text-sm text-ink">
          {m.path_review_not_enough({ samples: String(CONFIDENCE_MIN_SAMPLES) })}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {weak.map((element) => {
            const finger = element.kind === 'key' ? fingerOf(layout, element.key) : undefined
            return (
              <li
                key={element.key}
                className="flex items-center gap-3 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline px-3 py-2"
              >
                <span className="font-mono text-base text-ink">{element.label}</span>
                <Chip tone="muted">
                  {element.kind === 'key' ? m.path_review_key() : m.path_review_transition()}
                </Chip>
                {finger && (
                  <span className="font-ui text-xs text-muted">
                    {m.path_review_finger({ finger: finger.finger, hand: finger.hand })}
                  </span>
                )}
                {/* The number is shown, not just the ranking: a learner comparing two weak
                    elements deserves to see how far apart they are. */}
                <span className="ml-auto font-mono text-xs text-muted">
                  {Math.round(element.confidence * 100)}%
                </span>
                {element.scaleId ? (
                  <Link
                    to="/exercise/$scaleId"
                    params={{ scaleId: element.scaleId }}
                    search={{ mode: 'practice' }}
                    className="inline-flex h-9 items-center rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline-strong bg-paper-raised px-3 font-ui text-sm font-semibold text-ink hover:bg-sage-tint"
                  >
                    {m.path_review_practise()}
                  </Link>
                ) : (
                  // F1's catalogue focuses every scale on a key, so a weak Transition often has no
                  // drill of its own yet. Saying so is better than a button that goes nowhere.
                  <span className="font-ui text-xs text-muted">{m.path_review_no_drill()}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 font-mono text-xs text-muted">
        {m.path_review_threshold({ samples: String(MIN_TRANSITION_SAMPLES) })}
      </p>
    </Card>
  )
}
