import type { Level, Progress } from '@typing-race/domain'
import config from './levels.json'

/**
 * Reads the level config and refuses a malformed one loudly, at import time, rather than letting a
 * typo in `levels.json` turn into a floor of `undefined` that every attempt silently passes.
 * Exported so the tests can feed it broken input.
 */
export function parseLevels(raw: unknown): Level[] {
  const list = (raw as { levels?: unknown } | null)?.levels
  if (!Array.isArray(list) || list.length === 0) {
    throw new TypeError('level config: `levels` must be a non-empty array')
  }
  return list.map((entry: unknown, index): Level => {
    const level = entry as Record<string, unknown>
    const where = `level config entry ${index}`
    const text = (value: unknown, field: string): { uk: string; en: string } => {
      const pair = value as Record<string, unknown> | null
      if (typeof pair?.['uk'] !== 'string' || typeof pair['en'] !== 'string') {
        throw new TypeError(`${where}: \`${field}\` needs a uk and an en string`)
      }
      return { uk: pair['uk'], en: pair['en'] }
    }
    const id = level['id']
    const floor = level['accuracyFloor']
    if (typeof id !== 'string' || id === '') throw new TypeError(`${where}: missing id`)
    if (typeof floor !== 'number' || !(floor > 0 && floor <= 1)) {
      throw new TypeError(`${where}: accuracyFloor must be a fraction in (0, 1]`)
    }
    const spm = level['spm'] as { min?: unknown; max?: unknown } | null | undefined
    let spmBenchmark: Level['spmBenchmark'] = null
    if (spm !== null && spm !== undefined) {
      const { min, max } = spm
      if (typeof min !== 'number' || (max !== null && typeof max !== 'number')) {
        throw new TypeError(`${where}: spm needs a numeric min and a numeric or null max`)
      }
      if (max !== null && max < min) throw new TypeError(`${where}: spm.max is below spm.min`)
      spmBenchmark = { min, max }
    }
    return {
      id,
      name: text(level['name'], 'name'),
      spmBenchmark,
      accuracyFloor: floor,
      goal: text(level['goal'], 'goal'),
    }
  })
}

/**
 * The requirements' level table, loaded from `levels.json` — the one place its values live. The
 * accuracy floors, the SPM benchmarks, the names and the goals are all edited there.
 *
 * Only the first band is ever in force today, because the level follows the stage (FR-080); the
 * later bands are published on the Formulas page as benchmarks. Speed gates nothing.
 */
export const levels: readonly Level[] = parseLevels(config)

/** The first band of the table: the one Stage 1 is judged against. */
export const introductionLevel: Level = levels[0] as Level

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
