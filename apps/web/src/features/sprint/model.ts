import type { InputSource, KeystrokeEventLog, Language, Layout, Random } from '@typing-race/domain'
import { createEngine, type Engine, type EngineOptions } from '@typing-race/engine'
import { computeMetrics } from '@typing-race/metrics'

/** A sprint lasts one minute of typing time, counted from the first keystroke. */
export const SPRINT_MS = 60_000
export const SPRINT_SECONDS = SPRINT_MS / 1000

/** Whole seconds left on the clock, never below zero. */
export function secondsLeft(elapsedMs: number): number {
  return Math.max(0, Math.ceil((SPRINT_MS - elapsedMs) / 1000))
}

export interface SprintScore {
  readonly spm: number
  readonly accuracy: number
}

/**
 * The score of a sprint, from the published formulas (`packages/metrics`, the `/formulas` page): SPM
 * counts every character keystroke, accuracy is correct keystrokes over all of them, so a wrong
 * letter left in the line counts against it. The time is the typing time, capped at the minute;
 * a line finished early is scored over the time it took.
 */
export function sprintScore(args: {
  readonly log: KeystrokeEventLog
  readonly text: string
  readonly layout: Layout
  readonly elapsedMs: number
}): SprintScore {
  const metrics = computeMetrics({ ...args, elapsedMs: Math.min(SPRINT_MS, args.elapsedMs) })
  return { spm: Math.round(metrics.spm), accuracy: metrics.accuracy }
}

export interface Sprint {
  readonly engine: Engine
  /** Seconds left; ends the sprint once its minute is used up. Call it on a timer. */
  tick(): number
  /** Leaves without a score. */
  dispose(): void
}

/**
 * One sprint, outside React. The engine reads the keyboard through a gate that shuts at the 60 s
 * mark, so a key pressed after the minute never reaches the log; the timer's `tick` ends a sprint
 * whose minute ran out between two keys. The engine's clock excludes a pause, so a pause does not
 * eat the minute. `onEnd` fires once, with the score; leaving fires nothing.
 */
export function startSprint(
  options: EngineOptions & { readonly onEnd: (score: SprintScore) => void },
): Sprint {
  const { text, layout, input, onEnd } = options
  let ended = false
  let engine: Engine | null = null

  const end = (): void => {
    if (ended || engine === null) return
    ended = true
    engine.stop()
    onEnd(sprintScore({ log: engine.finish(), text, layout, elapsedMs: engine.view.elapsedMs }))
  }

  const gate: InputSource = {
    subscribe: (listener) =>
      input.subscribe((event) => {
        if (ended) return
        if (engine !== null && engine.view.elapsedMs >= SPRINT_MS) end()
        else listener(event)
      }),
    probeLayout: () => input.probeLayout(),
    focus: () => input.focus(),
  }

  const created = createEngine({ ...options, input: gate })
  engine = created
  const unwatch = created.onChange((view) => {
    if (view.state === 'completed') end()
  })

  return {
    engine: created,
    tick() {
      const elapsed = created.view.elapsedMs
      if (elapsed >= SPRINT_MS) end()
      return secondsLeft(elapsed)
    },
    dispose() {
      unwatch()
      if (ended) return
      ended = true
      created.abandon()
    },
  }
}

/**
 * A new personal best: accuracy must clear the floor (a fast sprint full of errors sets nothing),
 * and the pace must beat the stored best, if there is one.
 */
export function isNewBest(score: SprintScore, best: SprintScore | null, floor: number): boolean {
  if (score.accuracy < floor || score.spm <= 0) return false
  return best === null || score.spm > best.spm
}

/** The minimal storage seam (`localStorage` in the app, a map in tests). */
export interface BestStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const keyFor = (language: Language): string => `typing-race:sprint-best:${language}`

/** The stored best for a language; anything unreadable counts as no best. */
export function readBest(store: BestStore | null, language: Language): SprintScore | null {
  try {
    const raw = store?.getItem(keyFor(language))
    if (raw === null || raw === undefined) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { spm, accuracy } = parsed as Record<string, unknown>
    if (typeof spm !== 'number' || typeof accuracy !== 'number') return null
    return { spm, accuracy }
  } catch {
    return null
  }
}

/** Stores the best; a storage failure loses only the record, never the sprint. */
export function writeBest(store: BestStore | null, language: Language, score: SprintScore): void {
  try {
    store?.setItem(keyFor(language), JSON.stringify(score))
  } catch {
    // Private mode or a full quota: the result is still on screen.
  }
}

/** `localStorage`, or `null` where reading it throws. */
export function browserStore(): BestStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * The endless line: unlocked-only words in a shuffled cycle, long enough that nobody reaches its
 * end inside a minute. Seeded (ADR 0005), so a given seed always gives the same line.
 */
export function sprintText(words: readonly string[], random: Random, count = 300): string {
  if (words.length === 0) return ''
  const out: string[] = []
  let previous = ''
  let guard = 0
  while (out.length < count && guard < count * 20) {
    guard += 1
    const word = words[random.nextInt(words.length)] ?? ''
    if (word === '' || (word === previous && words.length > 1)) continue
    out.push(word)
    previous = word
  }
  return out.join(' ')
}
