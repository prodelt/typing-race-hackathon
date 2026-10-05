import type { Language } from '@typing-race/domain'

/** A sprint lasts one minute, counted from the first keystroke. */
export const SPRINT_MS = 60_000

/** Whole seconds left on the clock, never below zero. */
export function secondsLeft(elapsedMs: number): number {
  return Math.max(0, Math.ceil((SPRINT_MS - elapsedMs) / 1000))
}

export interface SprintScore {
  readonly spm: number
  readonly accuracy: number
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
 * end inside a minute.
 */
export function sprintText(words: readonly string[], random: () => number, count = 300): string {
  if (words.length === 0) return ''
  const out: string[] = []
  let previous = ''
  let guard = 0
  while (out.length < count && guard < count * 20) {
    guard += 1
    const word = words[Math.floor(random() * words.length)] ?? ''
    if (word === '' || (word === previous && words.length > 1)) continue
    out.push(word)
    previous = word
  }
  return out.join(' ')
}
