import { create } from 'zustand'
import type { RaceStanding } from '../../sync/race.js'

/**
 * The Race Rating as the status bar, the races lobby and the profile see it.
 *
 * The rating is the server's (`rate_race`); this is only where the app keeps the last answer. The
 * status bar is in the initial bundle and must never pull `@supabase/supabase-js` in, so the read
 * goes through a dynamic import, and only when this browser has a race identity at all: a learner
 * who never raced makes no request and sees `guest`. The last answer is cached per browser so the
 * bar does not flicker from "—" to the number on every load.
 */

export type { RaceStanding }

/** `loading` only until the first read settles; after that the last answer stays on screen. */
export type StandingState = RaceStanding | { readonly kind: 'loading' }

const CACHE_KEY = 'typing-race:race-standing'
/** Where `sync/race.ts` keeps the race session. Its presence is the only thing read eagerly. */
const SESSION_KEY = 'typing-race:race-auth'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function cached(): StandingState {
  try {
    const raw = storage()?.getItem(CACHE_KEY)
    if (raw === null || raw === undefined) return { kind: 'loading' }
    const parsed = JSON.parse(raw) as RaceStanding
    return parsed.kind === 'rated' && Number.isFinite(parsed.rating) ? parsed : { kind: 'loading' }
  } catch {
    return { kind: 'loading' }
  }
}

export const useRaceStanding = create<{ readonly standing: StandingState }>(() => ({
  standing: cached(),
}))

/** Records an answer. `unavailable` never replaces a known rating: offline is not a reset. */
export function setRaceStanding(next: RaceStanding): void {
  const current = useRaceStanding.getState().standing
  if (next.kind === 'unavailable' && current.kind === 'rated') return
  useRaceStanding.setState({ standing: next })
  try {
    if (next.kind === 'rated') storage()?.setItem(CACHE_KEY, JSON.stringify(next))
    else if (next.kind === 'guest' || next.kind === 'unrated') storage()?.removeItem(CACHE_KEY)
  } catch {
    // A full or blocked storage only costs the cache.
  }
}

/** Has this browser ever signed in to races or groups? */
export function hasRaceIdentity(): boolean {
  try {
    return storage()?.getItem(SESSION_KEY) != null
  } catch {
    return false
  }
}

/** A rating change with its sign: «+12», «−8», «0». */
export function signed(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '0'
}

let inFlight: Promise<void> | null = null

/** Reads the rating from the server, if this browser has a race identity. Never throws. */
export function refreshRaceStanding(): Promise<void> {
  if (!hasRaceIdentity()) {
    setRaceStanding({ kind: 'guest' })
    return Promise.resolve()
  }
  inFlight ??= (async () => {
    try {
      const { raceBackend } = await import('../../sync/race.js')
      const backend = await raceBackend()
      setRaceStanding(backend === null ? { kind: 'unavailable' } : await backend.standing())
    } catch {
      setRaceStanding({ kind: 'unavailable' })
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
