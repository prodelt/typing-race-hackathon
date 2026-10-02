import {
  catalogue as catalogues,
  deriveProgress,
  fingerOf,
  focusDrillFor,
  layouts,
  nextAction,
  scaleById,
  templateKeys,
} from '@typing-race/curriculum'
import {
  type AttemptSummary,
  type FingerAssignment,
  type Layout,
  LOG_RETENTION_COUNT,
  type NextAction,
  parseTransitionKey,
  type Scale,
  type StartingLevelChoice,
} from '@typing-race/domain'
import { confidenceOf, foldConfidence } from '@typing-race/metrics'
import { m } from '../../paraglide/messages.js'
import { fingerLabel } from '../exercise/labels.js'
import { type Reward, rewardFor } from './reward.js'

/**
 * The pure half of the result screen: everything it shows that is not a raw metric is decided
 * here, from the stored attempt list alone, so the components stay a plain rendering of a value
 * and the rules are testable without a DOM.
 */

/** Intervals above this are drawn in the error colour — FR-026, acceptance scenario 9. */
export const SLOW_INTERVAL_MS = 400

/** `curriculum` takes the confidence fold as a port; this is the one place `metrics` supplies it. */
const confidencePort = { fold: foldConfidence, of: confidenceOf }

export interface Unlock {
  /** The one character that joined the unlocked set on this attempt — FR-041. */
  readonly key: string
  /** The hand and finger that type the key, or `undefined` when the layout has no such key. */
  readonly finger: FingerAssignment | undefined
  /** Scales that this key made startable, in catalogue order. */
  readonly opens: readonly Scale[]
  /** What the card's button starts. */
  readonly firstDrill: Scale | undefined
  /** The unlocked set right after this attempt: what Stage 2 may now draw words from. */
  readonly unlockedAfter: readonly string[]
}

export interface ResultModel {
  readonly attempt: AttemptSummary
  readonly layout: Layout
  readonly scales: readonly Scale[]
  /** The best earlier result on the same exercise, or `null` the first time — FR-027. */
  readonly previousBest: AttemptSummary | null
  readonly unlock: Unlock | null
  /** Exactly one, by the coach's own return type — FR-031. */
  readonly next: NextAction
  /** The keystroke log of this attempt has aged out of the retention window — FR-081. */
  readonly logPruned: boolean
  /** What the top of the screen celebrates. */
  readonly reward: Reward
}

export interface ModelInput {
  readonly attempts: readonly AttemptSummary[]
  readonly attemptId: string | undefined
  readonly startingLevelChoice: StartingLevelChoice | null
}

/**
 * `null` when there is nothing honest to show: an unknown attempt id, or no starting level yet
 * (progress cannot be derived without answering FR-048, and inventing a default would pick a
 * boundary on the learner's behalf).
 */
export function buildResultModel(input: ModelInput): ResultModel | null {
  const { attempts, attemptId, startingLevelChoice } = input
  const index = attempts.findIndex((candidate) => candidate.id === attemptId)
  const attempt = attempts[index]
  if (attempt === undefined || startingLevelChoice === null) return null

  const layout = layouts[attempt.layoutId]
  const scales = catalogues[attempt.layoutId]

  // Progress is a fold over the history (FR-050), so "as of this attempt" is the fold over the
  // attempts up to and including it. That is what makes this screen right for an old result too,
  // not just the newest one.
  const foldTo = (count: number) =>
    deriveProgress({
      attempts: attempts.slice(0, count),
      layout,
      catalogue: scales,
      startingLevelChoice,
      confidence: confidencePort,
    })
  const before = foldTo(index)
  const after = foldTo(index + 1)

  const next = nextAction({
    progress: after,
    lastAttempt: attempt,
    layout,
    catalogue: scales,
    focusDrill: focusDrillFor(layout, after.unlockedSet),
  })

  return {
    attempt,
    layout,
    scales,
    previousBest: previousBest(attempts.slice(0, index), attempt),
    unlock: unlockOn(attempt, before.unlockedSet, after.unlockedSet, layout, scales, next),
    next,
    logPruned: attempts.length - 1 - index >= LOG_RETENTION_COUNT,
    reward: rewardFor({ earlier: attempts.slice(0, index), attempt, after, layout }),
  }
}

/**
 * The best earlier result on this exercise, by accuracy and then speed. Accuracy leads because
 * speed never gates progress and a faster but sloppier run is not a better one.
 */
function previousBest(
  earlier: readonly AttemptSummary[],
  attempt: AttemptSummary,
): AttemptSummary | null {
  let best: AttemptSummary | null = null
  for (const candidate of earlier) {
    if (candidate.scaleId !== attempt.scaleId || candidate.layoutId !== attempt.layoutId) continue
    if (
      best === null ||
      candidate.metrics.accuracy > best.metrics.accuracy ||
      (candidate.metrics.accuracy === best.metrics.accuracy &&
        candidate.metrics.spm > best.metrics.spm)
    ) {
      best = candidate
    }
  }
  return best
}

/**
 * The Key Unlock card is shown from **store data**, not from a rule of its own: a key is newly
 * unlocked exactly when it is in the unlocked set after this attempt and was not before. That
 * keeps the Mastery Rule in one place (`deriveProgress`) and makes the card impossible to show
 * for a key the learner already had (FR-041).
 */
function unlockOn(
  attempt: AttemptSummary,
  before: readonly string[],
  after: readonly string[],
  layout: Layout,
  scales: readonly Scale[],
  next: NextAction,
): Unlock | null {
  if (attempt.mode !== 'test') return null
  const had = new Set(before)
  const fresh = after.filter((char) => !had.has(char))
  const key = fresh[0]
  if (key === undefined) return null

  const nowOpen = new Set(after)
  const opens = scales.filter(
    (scale) =>
      scale.requires.includes(key) &&
      scale.requires.every((char) => nowOpen.has(char)) &&
      !scale.requires.every((char) => had.has(char)),
  )
  const firstDrill = opens[0] ?? scaleById(layout, next.startsScaleId)
  return { key, finger: fingerOfChar(layout, key), opens, firstDrill, unlockedAfter: after }
}

export function fingerOfChar(layout: Layout, char: string): FingerAssignment | undefined {
  return fingerOf(layout, char)
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/**
 * A character as the learner reads it: the apostrophe is stored as U+0027 and shown as U+2019, and
 * a space is named, because an empty cell in a table looks like a bug.
 */
export function displayChar(char: string): string {
  if (char === ' ') return m.result_key_space()
  if (char === "'") return '’'
  return char
}

/** "лівий мізинець": the hand is part of the name, so two fingers of one name are not confusable. */
export function fingerName(finger: FingerAssignment | undefined): string {
  return finger === undefined ? m.result_finger_unknown() : fingerLabel(finger)
}

export function transitionLabel(key: string): string {
  const pair = parseTransitionKey(key)
  return pair === undefined ? key : `${displayChar(pair.from)} → ${displayChar(pair.to)}`
}

export function scaleName(scale: Scale): string {
  const types: Record<Scale['type'], () => string> = {
    run: m.result_scale_run,
    mirror: m.result_scale_mirror,
    alternate: m.result_scale_alternate,
    fingerIsolation: m.result_scale_fingerIsolation,
    vertical: m.result_scale_vertical,
    fingerSpan: m.result_scale_fingerSpan,
    modifiers: m.result_scale_modifiers,
    tempo: m.result_scale_tempo,
  }
  const focus =
    scale.focus.kind === 'key' ? displayChar(scale.focus.value) : transitionLabel(scale.focus.value)
  return m.result_scale_name({ type: types[scale.type](), focus })
}

/** Rounds a tempo to the nearest 5 SPM so the named speed reads as a target, not a measurement. */
function namedTempo(spm: number): number {
  return Math.max(5, Math.round((spm * 0.8) / 5) * 5)
}

/**
 * The coach returns a template key plus values, never a sentence (FR-034); this turns it into the
 * learner's language. The four rules map to four messages, and `nextKey` has a second template
 * for the case where every key is already unlocked.
 *
 * Two facts the coach does not carry are added from the stored attempt and the layout, because
 * the acceptance scenarios ask for them by name: the named speed in the lower-tempo case (80% of
 * the speed just typed) and the two fingers of a weak Transition.
 */
export function coachSentence(model: ResultModel): string {
  const { next, attempt, layout } = model
  const values = next.values
  const text = (name: string): string => String(values[name] ?? '')

  switch (next.template) {
    case templateKeys.lowerTempo:
      return m.result_coach_lowerTempo({
        accuracy: text('accuracy'),
        floor: text('floor'),
        spm: namedTempo(attempt.metrics.spm),
      })
    case templateKeys.weakTransition: {
      const from = text('from')
      const to = text('to')
      const fromFinger = fingerName(fingerOfChar(layout, from))
      const toFinger = fingerName(fingerOfChar(layout, to))
      const shown = { from: displayChar(from), to: displayChar(to), confidence: text('confidence') }
      // One finger on both keys would read "left index and left index".
      if (fromFinger === toFinger)
        return m.result_coach_weakTransitionOneFinger({ ...shown, finger: fromFinger })
      return m.result_coach_weakTransition({ ...shown, fromFinger, toFinger })
    }
    case templateKeys.evenRhythm:
      return m.result_coach_evenRhythm({ rhythm: text('rhythm') })
    case templateKeys.nextKey: {
      const key = text('key')
      return m.result_coach_nextKey({
        key: displayChar(key),
        finger: fingerName(fingerOfChar(layout, key)),
      })
    }
    default: {
      const scale = scaleById(layout, next.startsScaleId)
      return m.result_coach_nextScale({
        scale: scale === undefined ? text('scale') : scaleName(scale),
      })
    }
  }
}
