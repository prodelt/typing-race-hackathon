import type {
  Attempt,
  AttemptAggregates,
  AttemptSummary,
  ConfidenceState,
  ImplausibleReason,
  Key,
  Language,
  Layout,
  Scale,
} from '@typing-race/domain'
import { transitionKey } from '@typing-race/domain'
import type { ConfidencePort } from './types'

/**
 * Synthetic fixtures for the curriculum tests. Deliberately tiny and independent of the shipped
 * layouts and catalogue, so these tests read in one screen and do not move when the real tables do.
 */

function key(code: string, plain: string, row: Key['row'], finger: Key['finger']): Key {
  const hand = plain === 'h' ? 'right' : 'left'
  return { code, row, hand, finger, plain, shifted: null, kind: 'letter' }
}

/**
 * Anchors `a s`, then unlock order `d f g h ;`. `f` and `g` share the left index finger so a
 * same-finger Transition exists. `h` is top-row, so the home-row run ends after `g`; `;` is not a
 * letter, so the last letter is `h`.
 */
export function makeLayout(language: Language = 'uk'): Layout {
  return {
    id: language === 'uk' ? 'yq' : 'qwerty',
    language,
    keys: [
      key('KeyA', 'a', 'home', 'pinky'),
      key('KeyS', 's', 'home', 'ring'),
      key('KeyD', 'd', 'home', 'middle'),
      key('KeyF', 'f', 'home', 'index'),
      key('KeyG', 'g', 'home', 'index'),
      key('KeyH', 'h', 'top', 'index'),
      {
        ...key('Semicolon', ';', 'home', 'pinky'),
        kind: 'punctuation',
        shifted: ':',
      },
      {
        ...key('Space', ' ', 'bottom', 'thumb'),
        hand: 'thumbs',
        kind: 'space',
      },
    ],
    homeAnchors: ['a', 's'],
    unlockOrder: ['d', 'f', 'g', 'h', ';'],
  }
}

export function makeScale(
  id: string,
  focus: Scale['focus'],
  requires: readonly string[],
  layoutId: Scale['layoutId'] = 'yq',
): Scale {
  return {
    id,
    layoutId,
    type: 'run',
    focus,
    fingers: [],
    size: 40,
    targetSpm: null,
    goal: `goal.${id}`,
    requires,
  }
}

/** One Scale per unlockable key except `;`, plus a Transition Scale for `f>g`. */
export function makeCatalogue(): Scale[] {
  return [
    makeScale('sc-d', { kind: 'key', value: 'd' }, []),
    makeScale('sc-f', { kind: 'key', value: 'f' }, ['d']),
    makeScale('sc-g', { kind: 'key', value: 'g' }, ['d', 'f']),
    makeScale('sc-h', { kind: 'key', value: 'h' }, ['d', 'f', 'g']),
    makeScale('sc-fg', { kind: 'transition', value: transitionKey('f', 'g') }, ['d', 'f', 'g']),
    makeScale('sc-gf', { kind: 'transition', value: transitionKey('g', 'f') }, ['d', 'f', 'g']),
  ]
}

export interface AttemptOptions {
  readonly id?: string
  readonly scaleId?: string
  readonly mode?: Attempt['mode']
  readonly accuracy?: number
  readonly spm?: number
  readonly rhythm?: number
  readonly completedAt?: number
  readonly layoutId?: Attempt['layoutId']
  readonly aggregates?: AttemptAggregates
  /** The verdict of an attempt that was not typed by hand. */
  readonly implausible?: ImplausibleReason
}

let counter = 0

/** A full Attempt, including a keystroke log, so tests can prove the log is never read. */
export function makeAttempt(options: AttemptOptions = {}): Attempt {
  counter += 1
  const completedAt = options.completedAt ?? counter * 1000
  return {
    id: options.id ?? `attempt-${counter}`,
    scaleId: options.scaleId ?? 'sc-d',
    layoutId: options.layoutId ?? 'yq',
    language: 'uk',
    mode: options.mode ?? 'test',
    text: 'dddd',
    seed: 1,
    startedAt: completedAt - 500,
    completedAt,
    elapsedMs: 500,
    metrics: {
      spm: options.spm ?? 100,
      wpm: (options.spm ?? 100) / 5,
      accuracy: options.accuracy ?? 1,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: options.rhythm ?? 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
      ...(options.implausible === undefined ? {} : { implausible: options.implausible }),
    },
    aggregates: options.aggregates ?? { keys: {}, transitions: {} },
    log: {
      formatVersion: 1,
      dt: [100],
      kind: ['char'],
      char: ['d'],
      correct: [true],
    },
  }
}

/** The shape the fold and the coach actually receive: no `log`, no `text`. */
export function toSummary(attempt: Attempt): AttemptSummary {
  const { log: _log, text: _text, ...summary } = attempt
  return summary
}

/** Aggregates observing one Transition `count` times. */
export function transitionAggregates(
  from: string,
  to: string,
  count: number,
  misses = 0,
): AttemptAggregates {
  return {
    keys: {},
    transitions: {
      [transitionKey(from, to)]: {
        count,
        misses,
        sumIki: count * 300,
        sumIkiSq: 0,
      },
    },
  }
}

/**
 * A stand-in for `metrics`' confidence fold, just faithful enough for these tests: a plain
 * hit-rate over all observations, `undefined` below five — the same contract (research R4), none
 * of the real weighting. The real fold has its own tests in `packages/metrics`.
 */
export const fakeConfidence: ConfidencePort = {
  fold(prior: ConfidenceState, aggregates: AttemptAggregates): ConfidenceState {
    const add = (
      into: Record<string, { wHits: number; wMisses: number; wSumIki: number; wSumIkiSq: number }>,
      from: AttemptAggregates['keys'],
    ) => {
      for (const [element, stats] of Object.entries(from)) {
        const before = into[element] ?? {
          wHits: 0,
          wMisses: 0,
          wSumIki: 0,
          wSumIkiSq: 0,
        }
        into[element] = {
          wHits: before.wHits + stats.count - stats.misses,
          wMisses: before.wMisses + stats.misses,
          wSumIki: before.wSumIki + stats.sumIki,
          wSumIkiSq: before.wSumIkiSq + stats.sumIkiSq,
        }
      }
    }
    const keys = { ...prior.keys }
    const transitions = { ...prior.transitions }
    add(keys, aggregates.keys)
    add(transitions, aggregates.transitions)
    return { keys, transitions }
  },
  of(state: ConfidenceState, element: string): number | undefined {
    const counters = state.keys[element] ?? state.transitions[element]
    if (!counters) return undefined
    const n = counters.wHits + counters.wMisses
    return n < 5 ? undefined : counters.wHits / n
  },
}
