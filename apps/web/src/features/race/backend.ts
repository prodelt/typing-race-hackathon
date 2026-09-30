import { useEffect, useState } from 'react'
import { type FinishReply, type RaceBackend, raceBackend } from '../../sync/race.js'

/** Where this racer's own finish stands: not yet, being replayed by the server, or answered. */
export type Mine =
  | { readonly kind: 'none' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'done'; readonly reply: FinishReply }
  | { readonly kind: 'failed' }

export type BackendStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'ready'; readonly backend: RaceBackend }

/** The race backend, or a calm `unavailable` when it is not configured or not reachable. */
export function useRaceBackend(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({ kind: 'loading' })
  useEffect(() => {
    let live = true
    void raceBackend().then((backend) => {
      if (!live) return
      setStatus(backend === null ? { kind: 'unavailable' } : { kind: 'ready', backend })
    })
    return () => {
      live = false
    }
  }, [])
  return status
}

/** A display name the server will accept: 2 to 32 characters after trimming. */
export function validName(name: string): boolean {
  const length = [...name.trim()].length
  return length >= 2 && length <= 32
}

/** Server time, ticking, from a measured offset. Ticks only while `active`. */
export function useServerNow(offsetMs: number, active: boolean, everyMs = 200): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    setNow(Date.now() + offsetMs)
    if (!active) return
    const id = setInterval(() => setNow(Date.now() + offsetMs), everyMs)
    return () => clearInterval(id)
  }, [offsetMs, active, everyMs])
  return now
}
