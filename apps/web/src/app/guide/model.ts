import { useEffect } from 'react'
import { create } from 'zustand'
import { usePlayMode } from '../playMode.js'

/**
 * First-visit coach-marks: the part every screen loads eagerly. It is tiny on purpose — which screen
 * is on, whether its guide was seen, and when to open it. The bubbles themselves (`CoachMarks.tsx`)
 * are a lazy chunk the shell pulls in only when a guide actually opens.
 */

export type GuideScreen = 'home' | 'map' | 'prestart' | 'result'

/** One coach-mark: a CSS selector for the thing it points at, and at most ten words about it. */
export interface GuideStep {
  readonly target: string
  readonly text: string
}

const SEEN_KEY = 'typing-race:guide-seen'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** The screens whose guide this browser has already shown, read fresh on every call. */
export function readSeen(): Readonly<Partial<Record<GuideScreen, true>>> {
  try {
    const raw = storage()?.getItem(SEEN_KEY)
    if (raw === null || raw === undefined) return {}
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Partial<Record<GuideScreen, true>>)
      : {}
  } catch {
    return {}
  }
}

export function isSeen(screen: GuideScreen): boolean {
  return readSeen()[screen] === true
}

export function markSeen(screen: GuideScreen): void {
  try {
    storage()?.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [screen]: true }))
  } catch {
    // A full or blocked storage only means the guide may show once more.
  }
}

/** `[data-guide="name"]`: the attribute a screen puts on what a coach-mark points at. */
export function guideTarget(name: string): string {
  return `[data-guide="${name}"]`
}

/**
 * The steps whose target is on screen now. A step pointing at something this screen does not show
 * (an empty panel, a narrow layout that hides it) is skipped rather than pointing at nothing.
 */
export function presentSteps<T extends GuideStep>(
  steps: readonly T[],
  find: (selector: string) => Element | null,
): T[] {
  return steps.filter((step) => {
    const element = find(step.target)
    return element !== null && element.getClientRects().length > 0
  })
}

/** Automated browsers (the e2e suite) never get a guide on their own; the «?» button still works. */
export function autoShowAllowed(nav: Navigator | undefined = globalThis.navigator): boolean {
  return nav?.webdriver !== true
}

interface GuideState {
  /** The screen whose guide the «?» button would replay; null where there is none. */
  readonly screen: GuideScreen | null
  readonly open: boolean
}

export const useGuide = create<GuideState>(() => ({ screen: null, open: false }))

/** Opens the current screen's guide again, whether or not it was seen. */
export function replayGuide(): void {
  if (useGuide.getState().screen !== null) useGuide.setState({ open: true })
}

/** Closes the guide and remembers that this screen's guide was seen. */
export function closeGuide(): void {
  const { screen } = useGuide.getState()
  if (screen !== null) markSeen(screen)
  useGuide.setState({ open: false })
}

/** How long a screen settles (fonts, the map's measured route) before its guide points at it. */
const SETTLE_MS = 700

/**
 * Declares that `screen` is on and owns the guide while the caller is mounted. The first time this
 * browser sees the screen, the guide opens by itself — never during a run, never for an automated
 * browser, and only when `ready` (Home waits for progress; the first exercise has its own card).
 */
export function useGuideScreen(screen: GuideScreen, ready = true): void {
  const play = usePlayMode()
  useEffect(() => {
    if (!ready) return
    useGuide.setState({ screen, open: false })
    return () => {
      if (useGuide.getState().screen === screen) useGuide.setState({ screen: null, open: false })
    }
  }, [screen, ready])

  useEffect(() => {
    if (!ready || play || isSeen(screen) || !autoShowAllowed()) return
    const timer = setTimeout(() => {
      if (useGuide.getState().screen === screen) useGuide.setState({ open: true })
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [screen, ready, play])
}
