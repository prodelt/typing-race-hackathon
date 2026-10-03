import { resolveWordDrill } from '@typing-race/curriculum'
import { spotLabel } from '../review/format.js'
import { drillName } from '../words/labels.js'
import type { Block } from './compose.js'

/**
 * What a block practises, in words: the drill's name when the block is a Stage 2 word drill, else
 * the key or Transition it is focused on. `undefined` when there is nothing to say.
 */
export function blockSpot(block: Block): string | undefined {
  const drill = resolveWordDrill(block.scaleId)
  if (drill !== undefined) return drillName(drill)
  return block.focus === null ? undefined : spotLabel(block.focus.value)
}
