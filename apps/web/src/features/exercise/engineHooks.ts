import type { Engine, EngineView } from '@typing-race/engine'
import { useLayoutEffect, useSyncExternalStore } from 'react'

/**
 * The two ways a component may listen to the engine, and the reason there are only two.
 *
 * The keystroke path lives outside React (ADR-0003) and FR-069 forbids anything outside the typing
 * line changing between two keystrokes. So a component either:
 *
 * - paints **imperatively** from `useEnginePaint`, mutating DOM nodes it owns through refs and
 *   never calling `setState`; or
 * - reads a **primitive** through `useSyncExternalStore`, which re-renders only when that primitive
 *   changes — for `paused` that is twice per attempt, not once per keystroke.
 */

/** Runs `paint` once with the current view, then again on every processed engine event. */
export function useEnginePaint(engine: Engine, paint: (view: EngineView) => void): void {
  useLayoutEffect(() => {
    paint(engine.view)
    return engine.onChange(paint)
  }, [engine, paint])
}

/** `true` only while the attempt is paused; changes at most on Escape and on resume. */
export function useEnginePaused(engine: Engine | null): boolean {
  return useSyncExternalStore(
    (notify) => engine?.onChange(notify) ?? (() => {}),
    () => engine?.view.state === 'paused',
    () => false,
  )
}
