import { m } from '../../paraglide/messages.js'
import type { MapNode, NodeState, Stage, StepNode } from './model.js'

/** Records rather than computed `m[...]` lookups, so a new group is a compile error here. */
const NAMES: Record<string, () => string> = {
  's1-home': m.map_g1_home,
  's1-top': m.map_g1_top,
  's1-bottom': m.map_g1_bottom,
  's1-shift': m.map_g1_shift,
  's1-symbols': m.map_g1_symbols,
  's2-ladder': m.map_g2_ladder,
  's2-keys': m.map_g2_keys,
  's2-sets': m.map_g2_sets,
  's3-keys': m.map_g3_keys,
  's3-syllables': m.map_g3_syllables,
  's3-phrases': m.map_g3_phrases,
  's3-text': m.map_g3_text,
}

const GOALS: Record<string, () => string> = {
  's1-home': m.map_goal_g1_home,
  's1-top': m.map_goal_g1_top,
  's1-bottom': m.map_goal_g1_bottom,
  's1-shift': m.map_goal_g1_shift,
  's1-symbols': m.map_goal_g1_symbols,
  's2-ladder': m.map_goal_g2_ladder,
  's2-keys': m.map_goal_g2_keys,
  's2-sets': m.map_goal_g2_sets,
  's3-keys': m.map_goal_g3_keys,
  's3-syllables': m.map_goal_g3_syllables,
  's3-phrases': m.map_goal_g3_phrases,
  's3-text': m.map_goal_g3_text,
}

export const STAGE_NAMES: Record<Stage, () => string> = {
  1: m.map_stage_1,
  2: m.map_stage_2,
  3: m.map_stage_3,
}

export function stepName(node: StepNode): string {
  return NAMES[node.id]?.() ?? node.id
}

export function stepGoal(node: StepNode): string {
  return GOALS[node.id]?.() ?? ''
}

export function nodeName(node: MapNode): string {
  if (node.kind === 'review') return m.map_review_node()
  if (node.kind === 'finish') return m.map_finish_node({ n: node.stage })
  return stepName(node)
}

export function stateWord(state: NodeState): string {
  switch (state) {
    case 'done':
      return m.map_state_done()
    case 'current':
      return m.map_state_current()
    case 'open':
      return m.map_state_open()
    case 'locked':
      return m.map_state_locked()
  }
}

/** `01 Етап 1 · Гами`, the region's full name. */
export function stageTitle(stage: Stage): string {
  return `${m.map_stage({ n: stage })} · ${STAGE_NAMES[stage]()}`
}
