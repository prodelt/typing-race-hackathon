import type { Level, Progress } from '@typing-race/domain'

/** The one band Stage 1 is judged against — FR-080. */
export const introductionLevel: Level = {
  id: 'introduction',
  // No speed requirement: speed never gates progression — FR-040.
  spmBenchmark: null,
  accuracyFloor: 0.95,
  goal: 'level.introduction.goal',
}

/**
 * The requirements' level table, as data so it can change without touching anything that reads it
 * (FR-030). The accuracy floors are the published 95 / 96 / 97 / 97 / 98 % column.
 *
 * Only `introduction` is ever in force in F1, because the level follows the stage (FR-080). The
 * later bands are here so that F3 and F4 inherit them rather than invent them.
 *
 * The speed benchmarks of the later bands are informational placeholders, contiguous from the 150
 * SPM Basic floor that research R4 names as its reference. They gate nothing — FR-040 — and are
 * to be replaced by the values the Formulas page publishes.
 */
export const levels: readonly Level[] = [
  introductionLevel,
  {
    id: 'basic',
    spmBenchmark: { min: 150, max: 199 },
    accuracyFloor: 0.96,
    goal: 'level.basic.goal',
  },
  {
    id: 'intermediate',
    spmBenchmark: { min: 200, max: 249 },
    accuracyFloor: 0.97,
    goal: 'level.intermediate.goal',
  },
  {
    id: 'advanced',
    spmBenchmark: { min: 250, max: 299 },
    accuracyFloor: 0.97,
    goal: 'level.advanced.goal',
  },
  {
    id: 'expert',
    spmBenchmark: { min: 300, max: 400 },
    accuracyFloor: 0.98,
    goal: 'level.expert.goal',
  },
]

/**
 * The level in force for a stage. It takes the **stage**, never a speed, so no gain in speed can
 * raise the accuracy floor — FR-080. F1 has a single stage, so the answer is always Introduction.
 * The progress fold calls this rather than {@link levelFor} because it has no Progress yet.
 */
export function levelForStage(_stage: 1): Level {
  // Stage 1 is the only stage F1 knows; the parameter exists so F3 adds a stage by widening a type.
  return introductionLevel
}

/**
 * Same answer as {@link levelForStage}, with the signature the contract publishes. `progress` is
 * accepted and deliberately ignored: the level follows the stage, not anything the learner did
 * — FR-080.
 */
export function levelFor(stage: 1, _progress: Progress): Level {
  return levelForStage(stage)
}

/** Whether an attempt's accuracy (a fraction in [0, 1]) meets the level's floor. */
export function passes(accuracy: number, level: Level): boolean {
  return accuracy >= level.accuracyFloor
}
