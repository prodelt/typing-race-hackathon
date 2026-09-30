import type { ErrorMode, InputEvent, Layout } from '@typing-race/domain'
import { createEngine, type Engine, type EngineView, manualClock, scriptedInput } from './index'

/** The engine never reads the layout, so an empty one is enough for every test. */
export const layout: Layout = {
  id: 'qwerty',
  language: 'en',
  keys: [],
  homeAnchors: [],
  unlockOrder: [],
}

export const char = (c: string, at: number): InputEvent => ({
  kind: 'char',
  char: c,
  at,
})
export const backspace = (at: number): InputEvent => ({
  kind: 'backspace',
  at,
})
export const ignored = (at: number): InputEvent => ({
  kind: 'ignored',
  reason: 'modifier',
  at,
})

export function setup(text: string, errorMode: ErrorMode = 'stopOnLetter') {
  const clock = manualClock()
  const input = scriptedInput([])
  const engine = createEngine({ text, errorMode, input, clock, layout })
  const views: EngineView[] = []
  engine.onChange((view) => views.push(view))
  return { clock, input, engine, views }
}

/** Types the text one event per character, 100 ms apart. */
export function typeText(text: string, start = 0): InputEvent[] {
  return Array.from(text).map((c, i) => char(c, start + i * 100))
}

/**
 * Finishes an attempt from wherever it stands: erases any wrong character, then types what is
 * awaited. Used by the replay property, which needs a *completed* attempt to have a log.
 */
export function completeFrom(
  engine: Engine,
  emit: (event: InputEvent) => void,
  text: string,
  at: number,
): void {
  const chars = Array.from(text)
  let clock = at
  while (engine.view.state !== 'completed') {
    clock += 10
    const { cursor, markedAt } = engine.view
    const awaited = markedAt !== null && markedAt !== cursor ? undefined : chars[cursor]
    emit(awaited === undefined ? backspace(clock) : char(awaited, clock))
  }
}
