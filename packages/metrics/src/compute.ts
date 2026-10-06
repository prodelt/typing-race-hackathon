import type { AttemptMetrics, ElementStats, KeystrokeEventLog, Layout } from '@typing-race/domain'
import { accuracyOf, countKeystrokes } from './accuracy'
import { computeAggregates } from './aggregates'
import { charKeystrokes } from './keystrokes'
import { implausibilityOf } from './plausibility'
import { rhythmConsistencyOf } from './rhythm'

/** Only elements with at least one timed hit have a mean; the rest are simply absent. */
function meanIkis(stats: Readonly<Record<string, ElementStats>>): Record<string, number> {
  const means = new Map<string, number>()
  for (const [element, { count, misses, sumIki }] of Object.entries(stats)) {
    const hits = count - misses
    if (hits > 0) means.set(element, sumIki / hits)
  }
  return Object.fromEntries(means)
}

/**
 * Everything the result screen reports, derived from the log after the fact — FR-019, FR-023..026.
 *
 * SPM counts the characters of the text typed correctly, each once, over the elapsed time
 * (ADR-0003, 2026-10-06): on a finished attempt that is the length of the text, so SPM is
 * `60 · N / T`. A wrong keystroke is not typing more text; it costs accuracy, and the time it
 * took. Retyping a character after erasing it does not count it twice, which is what the cap at
 * the text's length does. `elapsedMs` comes from the engine, which excludes unfocused time,
 * rather than from summing `dt`. An `elapsedMs` of zero or less has no speed, so it reports `0`
 * instead of infinity.
 *
 * `wpm` is `spm / 5` exactly as computed; multiplying it back by 5 may differ from `spm` by one
 * floating-point ulp, which is inherent to the division and not a rounding we chose.
 *
 * `implausible` is set only when the typing is not what a hand does (`plausibility.ts`); the key is
 * absent otherwise, so an honest attempt stores exactly what it stored before the rule existed.
 */
export function computeMetrics(args: {
  log: KeystrokeEventLog
  text: string
  layout: Layout
  elapsedMs: number
}): AttemptMetrics {
  const { log, text, layout, elapsedMs } = args
  const { correct, total } = countKeystrokes(log)
  const typed = Math.min(correct, Array.from(text).length)
  const spm = elapsedMs > 0 ? (typed * 60_000) / elapsedMs : 0
  const implausible = implausibilityOf(log, spm)

  // Errors are attributed to the awaited character, matching the aggregates; past the end of the
  // text there is nothing awaited, so the typed character is the only thing to name.
  const errorsByChar = new Map<string, number>()
  for (const keystroke of charKeystrokes(log, text)) {
    if (keystroke.correct) continue
    const char = keystroke.awaited ?? keystroke.typed
    errorsByChar.set(char, (errorsByChar.get(char) ?? 0) + 1)
  }

  const aggregates = computeAggregates({ log, text, layout })
  return {
    spm,
    wpm: spm / 5,
    accuracy: accuracyOf(log),
    errorCount: total - correct,
    errorsByChar: Object.fromEntries(errorsByChar),
    rhythmConsistency: rhythmConsistencyOf(log),
    meanIkiByKey: meanIkis(aggregates.keys),
    meanIkiByTransition: meanIkis(aggregates.transitions),
    ...(implausible === undefined ? {} : { implausible }),
  }
}
