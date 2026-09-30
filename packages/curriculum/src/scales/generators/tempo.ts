import type { Generator } from '../types'
import { anchorKeys } from './shared'

const REPEATS = 4

/**
 * `tempo` — one short motif, repeated (R6). The motif is the Focus Element against one anchor; the
 * metronome that paces it is the Scale's `targetSpm`, and it steps up across the exercise
 * (`tempoSteps`). `generateText` draws one motif and repeats it, so a run is one motif throughout.
 */
export const tempo: Generator = (context) =>
  context.forms.flatMap((form) =>
    anchorKeys(context)
      .filter((anchor) => context.available.has(anchor.plain) && !form.includes(anchor.plain))
      .map((anchor) => `${form}${anchor.plain}`.repeat(REPEATS)),
  )

/** How far each metronome step rises, in SPM. Research R6: 100, 120, 140. */
const STEP_SPM = 20
const STEP_COUNT = 3

/**
 * The metronome series for a `tempo` Scale: its `targetSpm` and two steps above it. Speed never
 * gates progress, so this paces the learner and is never a pass mark. A Scale with no tempo has no
 * series.
 */
export function tempoSteps(targetSpm: number | null): number[] {
  if (targetSpm === null) return []
  return Array.from({ length: STEP_COUNT }, (_, step) => targetSpm + step * STEP_SPM)
}
