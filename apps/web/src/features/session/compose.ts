import { realTextId, scaleById, WEAK_CONFIDENCE_CEILING } from '@typing-race/curriculum'
import type {
  AttemptMode,
  AttemptSummary,
  FocusElement,
  Layout,
  NextAction,
  Progress,
  Scale,
} from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { currentSpm, type SessionSize, sizeSession } from './sizing.js'

/**
 * Block composition: warm-up, one target skill, consolidation, then real text (requirements §4.1).
 *
 * The three exercise blocks are Scales. The fourth is not planned here beyond its id: its text is
 * the Academy's sentences or real words from open keys, which need the course and the word bank,
 * so `RealTextBlock` builds it when the learner reaches it (`realTextBlock` in curriculum).
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
  /** The id the real-text attempt is recorded under; one attempt closes the block. */
  readonly realTextId: string
  readonly expectedMinutes: number
}

export interface ComposeArgs {
  readonly layout: Layout
  readonly catalogue: readonly Scale[]
  readonly progress: Progress
  readonly nextAction: NextAction
  readonly attempts: readonly AttemptSummary[]
}

/**
 * The scale for the warm-up: one startable scale focused on a key of the weakest Transition.
 *
 * The key scale rather than the Transition drill, because the Transition drill is usually the
 * target skill already (the Next Action names the weakest Transition first), and warming up on
 * the exact exercise that follows would make the two blocks one. A Transition measured below five
 * observations is `undefined` upstream and skipped.
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
  const { layout, catalogue, progress, nextAction, attempts } = args
  const unlocked = new Set(progress.unlockedSet)
  const startable = catalogue.filter((scale) => scale.requires.every((char) => unlocked.has(char)))

  // `scaleById` resolves a Transition drill the coach built as well as an authored Scale; a Stage 2
  // word drill is not a Scale, and the session then trains the first startable one instead.
  const named = scaleById(layout, nextAction.startsScaleId)
  const target = named?.requires.every((char) => unlocked.has(char)) === true ? named : startable[0]
  if (target === undefined) return null

  const weak = warmUpScale(progress, startable)
  const warmUp = weak ?? target
  const size = sizeSession({ spm: currentSpm(attempts), scaleSize: target.size })
  const [warmUpReps, targetReps, consolidationReps] = size.reps

  return {
    size,
    expectedMinutes: size.expectedMinutes,
    realTextId: realTextId(layout),
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
