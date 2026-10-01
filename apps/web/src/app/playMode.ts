import { useEffect } from 'react'
import { create } from 'zustand'
import { useAppStore } from './state/index.js'

/**
 * Play Mode: while an attempt or a race runs, the rail and the status bar leave the screen and only
 * the run remains (`CONTEXT.md`, Game Layer).
 *
 * Attempts already announce themselves to the app store (`attemptInProgress`, set on Start). A race
 * is not an attempt, so it raises its own flag here. A counter rather than a boolean, so two
 * overlapping mounts (a development double-mount, a route swap) cannot clear each other's flag.
 */
const useRuns = create<{ readonly runs: number }>(() => ({ runs: 0 }))

/** Holds Play Mode on while `active` is true and the calling component is mounted. */
export function useHoldPlayMode(active: boolean): void {
  useEffect(() => {
    if (!active) return
    useRuns.setState((state) => ({ runs: state.runs + 1 }))
    return () => useRuns.setState((state) => ({ runs: state.runs - 1 }))
  }, [active])
}

export function usePlayMode(): boolean {
  const attempt = useAppStore((state) => state.attemptInProgress)
  const race = useRuns((state) => state.runs > 0)
  return attempt || race
}
