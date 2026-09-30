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

/** One metronome step of a tempo run: the characters `[from, to)` of the text, paced at `spm`. */
export interface TempoSegment {
  readonly spm: number
  /** 1-based step number, for "step 2 of 3". */
  readonly step: number
  /** Code-point index of the first character of this step. */
  readonly from: number
  /** Code-point index one past the last character, the joining space included. */
  readonly to: number
}

/**
 * How a tempo run is paced: its text cut into one run of whole items per metronome step, in order,
 * so the pace rises 100 → 120 → 140 SPM across the attempt and never mid-motif. Indices are code
 * points, the same unit as the engine's cursor. A text with fewer items than steps gets fewer
 * segments; a Scale with no tempo gets none.
 */
export function tempoPlan(targetSpm: number | null, text: string): TempoSegment[] {
  const steps = tempoSteps(targetSpm)
  const items = text.split(' ').filter((item) => item !== '')
  if (steps.length === 0 || items.length === 0) return []
  const count = Math.min(steps.length, items.length)
  const segments: TempoSegment[] = []
  let at = 0
  for (let step = 0; step < count; step++) {
    const first = Math.floor((step * items.length) / count)
    const last = Math.floor(((step + 1) * items.length) / count)
    const chars = items.slice(first, last).reduce((sum, item) => sum + [...item].length + 1, 0)
    // The last step has no space after its last item.
    const to = step === count - 1 ? at + chars - 1 : at + chars
    segments.push({ spm: steps[step] ?? 0, step: step + 1, from: at, to })
    at = to
  }
  return segments
}

/** The step the caret is in: the last step once the text is finished, `undefined` with no plan. */
export function paceAt(plan: readonly TempoSegment[], cursor: number): TempoSegment | undefined {
  return plan.find((segment) => cursor < segment.to) ?? plan.at(-1)
}
