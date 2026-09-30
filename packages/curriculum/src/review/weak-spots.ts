import type {
  AttemptSummary,
  ElementStats,
  Layout,
  Progress,
  TransitionKey,
} from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { SHIFT_TOKEN } from '../layout'
import { MIN_TRANSITION_SAMPLES, WEAK_CONFIDENCE_CEILING } from '../progress/weak-transitions'
import { isTypable } from '../stage2/select'

/**
 * Weak spots: the keys and Transitions a learner should repeat, each with the two numbers that
 * make it weak — how often it is missed and how long the finger takes to reach it.
 *
 * Read from the aggregates of the most recent attempts (the part of an attempt kept forever), and
 * from the long-run Confidence, so a key that was weak last month and is fine now drops out, and a
 * key that has just started slipping shows up before its Confidence has caught up.
 */

/** How many of the most recent attempts the numbers are taken over. */
export const REVIEW_WINDOW = 20
/** A key or Transition missed at least this often is weak, whatever its speed. */
export const ERROR_RATE_FLOOR = 0.06
/** A key or Transition reached this slowly or slower is weak, whatever its accuracy. */
export const SLOW_IKI_MS = 400
/**
 * How much one unit of error rate outweighs one unit of slowness (interval / {@link SLOW_IKI_MS}).
 * Missing a key one time in ten (0.4) ranks level with being 40% of the way to a slow reach:
 * accuracy leads, as it does everywhere else in the product.
 */
export const ERROR_WEIGHT = 4
/** How many weak spots a list names. */
export const WEAK_SPOT_LIMIT = 8

export interface SpotStats {
  /** Observations: every time the text awaited this key or move. */
  readonly count: number
  readonly misses: number
  /** `misses / count`, in [0, 1]. */
  readonly errorRate: number
  /** Mean interval over timed hits, or `null` when none were timed. */
  readonly meanIkiMs: number | null
}

export interface WeakSpot extends SpotStats {
  readonly kind: 'key' | 'transition'
  /** The character, or the Transition key `a>b`. */
  readonly element: string
  /** One character for a key, `[from, to]` for a Transition. */
  readonly chars: readonly string[]
  /** Long-run Confidence, when measured. */
  readonly confidence: number | undefined
  /** What the ranking sorts on; higher is weaker. */
  readonly score: number
}

const EMPTY: ElementStats = { count: 0, misses: 0, sumIki: 0, sumIkiSq: 0 }

function add(a: ElementStats, b: ElementStats): ElementStats {
  return {
    count: a.count + b.count,
    misses: a.misses + b.misses,
    sumIki: a.sumIki + b.sumIki,
    sumIkiSq: a.sumIkiSq + b.sumIkiSq,
  }
}

/** Summed aggregates of a set of attempts, keys and Transitions apart. */
export function sumAggregates(attempts: readonly AttemptSummary[]): {
  keys: Map<string, ElementStats>
  transitions: Map<string, ElementStats>
} {
  const keys = new Map<string, ElementStats>()
  const transitions = new Map<string, ElementStats>()
  for (const attempt of attempts) {
    for (const [char, stats] of Object.entries(attempt.aggregates.keys)) {
      keys.set(char, add(keys.get(char) ?? EMPTY, stats))
    }
    for (const [key, stats] of Object.entries(attempt.aggregates.transitions)) {
      transitions.set(key, add(transitions.get(key) ?? EMPTY, stats))
    }
  }
  return { keys, transitions }
}

/** Error rate and mean interval from summed counters. Timing comes from hits only. */
export function statsOf(stats: ElementStats | undefined): SpotStats {
  const s = stats ?? EMPTY
  const hits = s.count - s.misses
  return {
    count: s.count,
    misses: s.misses,
    errorRate: s.count === 0 ? 0 : s.misses / s.count,
    meanIkiMs: hits > 0 && s.sumIki > 0 ? s.sumIki / hits : null,
  }
}

/**
 * The ranking score: error rate weighted by {@link ERROR_WEIGHT} plus slowness. Strictly increasing
 * in both, so at equal speed the more error-prone element always ranks first, and at equal error
 * rate the slower one does. An element with no timed hit at all is treated as slow.
 */
export function spotScore(stats: SpotStats): number {
  const slowness = stats.meanIkiMs === null ? 1 : stats.meanIkiMs / SLOW_IKI_MS
  return ERROR_WEIGHT * stats.errorRate + slowness
}

function isWeak(stats: SpotStats, confidence: number | undefined): boolean {
  return (
    stats.errorRate >= ERROR_RATE_FLOOR ||
    (stats.meanIkiMs ?? SLOW_IKI_MS) >= SLOW_IKI_MS ||
    (confidence !== undefined && confidence < WEAK_CONFIDENCE_CEILING)
  )
}

/** A character a drill could hold: typable now, and not the space bar or the Shift token. */
function drillable(layout: Layout, open: ReadonlySet<string>, char: string): boolean {
  return char !== ' ' && char !== SHIFT_TOKEN && isTypable(layout, open, char)
}

/**
 * The learner's weak spots, weakest first. Only elements measured at least
 * {@link MIN_TRANSITION_SAMPLES} times in the window are judged, and only ones made of characters
 * the learner can type now: a drill is offered for every spot named, and a drill never holds a
 * locked character. A Transition into or out of the space bar is kept (the move from a word's
 * last letter to the space is a real one); a key that is the space bar is not.
 */
export function rankWeakSpots(
  progress: Progress,
  layout: Layout,
  limit = WEAK_SPOT_LIMIT,
): WeakSpot[] {
  const open = new Set(progress.unlockedSet)
  const recent = progress.history.slice(-REVIEW_WINDOW)
  const { keys, transitions } = sumAggregates(recent)
  const spots: WeakSpot[] = []

  for (const [char, raw] of keys) {
    if (raw.count < MIN_TRANSITION_SAMPLES || !drillable(layout, open, char)) continue
    const stats = statsOf(raw)
    const confidence = progress.keyConfidence[char]
    if (!isWeak(stats, confidence)) continue
    spots.push({
      kind: 'key',
      element: char,
      chars: [char],
      confidence,
      ...stats,
      score: spotScore(stats),
    })
  }

  for (const [key, raw] of transitions) {
    if (raw.count < MIN_TRANSITION_SAMPLES) continue
    const pair = parseTransitionKey(key)
    if (pair === undefined || pair.from === pair.to) continue
    const ends = [pair.from, pair.to]
    if (ends.every((c) => c === ' ')) continue
    if (!ends.every((c) => c === ' ' || drillable(layout, open, c))) continue
    const stats = statsOf(raw)
    const confidence = progress.transitionConfidence[key as TransitionKey]
    if (!isWeak(stats, confidence)) continue
    spots.push({
      kind: 'transition',
      element: key,
      chars: ends,
      confidence,
      ...stats,
      score: spotScore(stats),
    })
  }

  return spots
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A move says more than a key: the key is usually weak *because* of a move into it.
        (a.kind === b.kind ? 0 : a.kind === 'transition' ? -1 : 1) ||
        (a.element < b.element ? -1 : a.element > b.element ? 1 : 0),
    )
    .slice(0, limit)
}

export type SpotVerdict = 'better' | 'worse' | 'same'

/** An error-rate change smaller than this, in absolute terms, is noise. */
export const ERROR_RATE_EPSILON = 0.02
/** A speed change smaller than this fraction of the earlier interval is noise. */
export const IKI_EPSILON = 0.05

/**
 * Whether one weak spot improved from `before` (the window before a drill) to `after` (the drill
 * itself). Accuracy decides first; speed decides only when accuracy did not move. A drill that
 * never reached the spot says nothing about it, which is `same`, not `better`.
 */
export function compareSpot(before: SpotStats, after: SpotStats): SpotVerdict {
  if (after.count === 0 || before.count === 0) return 'same'
  const errorDelta = after.errorRate - before.errorRate
  if (errorDelta <= -ERROR_RATE_EPSILON) return 'better'
  if (errorDelta >= ERROR_RATE_EPSILON) return 'worse'
  if (before.meanIkiMs === null || after.meanIkiMs === null) return 'same'
  const speedDelta = (after.meanIkiMs - before.meanIkiMs) / before.meanIkiMs
  if (speedDelta <= -IKI_EPSILON) return 'better'
  if (speedDelta >= IKI_EPSILON) return 'worse'
  return 'same'
}

/** Stats of one element (a character or a Transition key) over a set of attempts. */
export function elementStats(attempts: readonly AttemptSummary[], element: string): SpotStats {
  const { keys, transitions } = sumAggregates(attempts)
  return statsOf(parseTransitionKey(element) ? transitions.get(element) : keys.get(element))
}
