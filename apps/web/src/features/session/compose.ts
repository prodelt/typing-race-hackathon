import { WEAK_CONFIDENCE_CEILING } from '@typing-race/curriculum'
import type {
  AttemptMode,
  AttemptSummary,
  FocusElement,
  NextAction,
  Progress,
  Scale,
} from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { currentSpm, type SessionSize, sizeSession } from './sizing.js'

/**
 * T136. Block composition.
 *
 * Three exercise blocks are composed here; the fourth, real text, is deliberately not: F1 has no
 * dictionary, and FR-076 forbids filling its place with pseudo-words.
 */

export type BlockKind = 'warmUp' | 'target' | 'consolidation'

export interface Block {
  readonly kind: BlockKind
  readonly scaleId: string
  /** Practice shows the keyboard guide; test hides it and counts toward mastery (FR-039). */
  readonly mode: AttemptMode
  readonly reps: number
  readonly focus: FocusElement
  /** The warm-up fell back to the target skill because no weak Transition was available. */
  readonly fallback: boolean
}

export interface SessionPlan {
  readonly blocks: readonly [Block, Block, Block]
  readonly expectedMinutes: number
}

export interface ComposeArgs {
  readonly catalogue: readonly Scale[]
  readonly progress: Progress
  readonly nextAction: NextAction
  readonly attempts: readonly AttemptSummary[]
}

/**
 * The scale for the warm-up: one startable scale focused on a key of the weakest Transition.
 *
 * F1's catalogue has no Scale focused on a Transition, so the closest honest reading of "built
 * around the weakest Transitions" is a scale on one of that Transition's two keys. Weakest first;
 * a Transition measured below five observations is `undefined` upstream (research R4) and skipped.
 */
function warmUpScale(progress: Progress, startable: readonly Scale[]): Scale | undefined {
  const weak = Object.entries(progress.transitionConfidence)
    .flatMap(([key, confidence]) =>
      confidence !== undefined && confidence < WEAK_CONFIDENCE_CEILING ? [{ key, confidence }] : [],
    )
    // The key breaks ties so the same history always composes the same warm-up.
    .sort((a, b) => a.confidence - b.confidence || (a.key < b.key ? -1 : 1))

  for (const { key } of weak) {
    const pair = parseTransitionKey(key)
    if (pair === undefined) continue
    const match = startable.find(
      (scale) =>
        scale.focus.kind === 'key' &&
        (scale.focus.value === pair.to || scale.focus.value === pair.from),
    )
    if (match !== undefined) return match
  }
  return undefined
}

export function composeSession(args: ComposeArgs): (SessionPlan & { size: SessionSize }) | null {
  const { catalogue, progress, nextAction, attempts } = args
  const unlocked = new Set(progress.unlockedSet)
  const startable = catalogue.filter((scale) => scale.requires.every((char) => unlocked.has(char)))

  const target = catalogue.find((scale) => scale.id === nextAction.startsScaleId) ?? startable[0]
  if (target === undefined) return null

  const weak = warmUpScale(progress, startable)
  const warmUp = weak ?? target
  const size = sizeSession({ spm: currentSpm(attempts), scaleSize: target.size })
  const [warmUpReps, targetReps, consolidationReps] = size.reps

  return {
    size,
    expectedMinutes: size.expectedMinutes,
    blocks: [
      {
        kind: 'warmUp',
        scaleId: warmUp.id,
        mode: 'practice',
        reps: warmUpReps,
        focus: warmUp.focus,
        fallback: weak === undefined,
      },
      {
        kind: 'target',
        scaleId: target.id,
        mode: 'practice',
        reps: targetReps,
        focus: target.focus,
        fallback: false,
      },
      {
        kind: 'consolidation',
        scaleId: target.id,
        mode: 'test',
        reps: consolidationReps,
        focus: target.focus,
        fallback: false,
      },
    ],
  }
}
