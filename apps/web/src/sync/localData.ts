/**
 * Learner data that lives in `localStorage` beside the progress store: the daily challenge's
 * cleared days and the sprint bests. Sign-out wipes the local copy (ADR 0006), and this is part of
 * that copy, so it goes with it.
 *
 * Kept deliberately: the coach-marks "seen" flag (`typing-race:guide-seen`) is a per-browser UI
 * hint that holds nothing about the learner's typing; auth keys, which sign-out handles itself; and
 * the e2e test-account flag.
 */

const EXACT = new Set(['typing-race:daily'])
const PREFIXES = ['typing-race:daily:', 'typing-race:sprint-best:']

export function isLearnerDataKey(key: string): boolean {
  return EXACT.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix))
}

/** Removes every learner-data key. Never throws: a locked storage has nothing to wipe. */
export function wipeLearnerData(storage: Storage | undefined): void {
  try {
    if (storage === undefined) return
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key !== null && isLearnerDataKey(key)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // Private mode or a denied storage: nothing was written there either.
  }
}

/** The app's `localStorage`, or `undefined` where reading it throws. */
export function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
