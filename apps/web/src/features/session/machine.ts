import type { AttemptSummary } from '@typing-race/domain'
import type { SessionPlan } from './compose.js'

/**
 * T135. The session state machine, as a pure reducer plus one pure function of position.
 *
 * The machine stores almost nothing: the plan, the ids of attempts that existed when the session
 * began, and how many between-blocks screens the learner has already passed. *Where the learner is*
 * is never stored; it is counted from the attempt history, which is what FR-078 needs. An attempt
 * already recorded can never be lost by the session, because the session does not hold it, and
 * abandoning only forgets the plan.
 */

export type SessionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'running'
      readonly plan: SessionPlan
      /** Attempts that predate this session; they never count toward its blocks. */
      readonly baseline: readonly string[]
      /** How many completed blocks the learner has already moved past. */
      readonly acknowledged: number
    }
  | { readonly status: 'finished'; readonly recorded: number }

export type SessionAction =
  | { readonly type: 'start'; readonly plan: SessionPlan; readonly baseline: readonly string[] }
  | { readonly type: 'acknowledge'; readonly completedBlocks: number }
  | { readonly type: 'finish'; readonly recorded: number }
  | { readonly type: 'abandon' }
  | { readonly type: 'reset' }

export const idleSession: SessionState = { status: 'idle' }

export function reduceSession(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'start':
      return { status: 'running', plan: action.plan, baseline: action.baseline, acknowledged: 0 }
    case 'acknowledge':
      if (state.status !== 'running') return state
      return { ...state, acknowledged: Math.max(state.acknowledged, action.completedBlocks) }
    case 'finish':
      return state.status === 'running' ? { status: 'finished', recorded: action.recorded } : state
    // Abandoning forgets the plan and nothing else (FR-078): attempts live in the app store.
    case 'abandon':
    case 'reset':
      return idleSession
    default: {
      const unhandled: never = action
      return unhandled
    }
  }
}

export type SessionPosition =
  | {
      readonly kind: 'block'
      readonly blockIndex: number
      readonly doneInBlock: number
      readonly reps: number
    }
  | { readonly kind: 'between'; readonly finishedIndex: number; readonly nextIndex: number }
  | { readonly kind: 'realText' }

/** Attempts recorded since the session began, on a scale the session planned. */
export function sessionAttempts(
  state: Extract<SessionState, { status: 'running' }>,
  attempts: readonly AttemptSummary[],
): readonly AttemptSummary[] {
  const planned = new Set(state.plan.blocks.map((block) => block.scaleId))
  const before = new Set(state.baseline)
  return attempts.filter((attempt) => !before.has(attempt.id) && planned.has(attempt.scaleId))
}

type Running = Extract<SessionState, { status: 'running' }>

/** How many attempts the session has, how many blocks they complete, and how many they consume. */
function tally(state: Running, attempts: readonly AttemptSummary[]) {
  const done = sessionAttempts(state, attempts).length
  let consumed = 0
  let completed = 0
  for (const block of state.plan.blocks) {
    if (done < consumed + block.reps) break
    consumed += block.reps
    completed += 1
  }
  return { done, consumed, completed }
}

/** Number of fully completed blocks, used to acknowledge a between-blocks screen. */
export function completedBlocks(state: Running, attempts: readonly AttemptSummary[]): number {
  return tally(state, attempts).completed
}

/**
 * The between-blocks screen shows after warm-up and after the target skill: twice in a full run.
 * After consolidation the real-text screen takes over, and that is not a between-blocks screen.
 */
export function positionOf(state: Running, attempts: readonly AttemptSummary[]): SessionPosition {
  const { done, consumed, completed } = tally(state, attempts)

  if (completed >= state.plan.blocks.length) return { kind: 'realText' }
  if (completed >= 1 && state.acknowledged < completed) {
    return { kind: 'between', finishedIndex: completed - 1, nextIndex: completed }
  }
  return {
    kind: 'block',
    blockIndex: completed,
    doneInBlock: done - consumed,
    reps: state.plan.blocks[completed]?.reps ?? 1,
  }
}
