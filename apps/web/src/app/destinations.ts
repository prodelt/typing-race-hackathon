/**
 * The five destinations of the game client and which routes belong to each.
 *
 * Pure data and pure functions, so the rail, the 1–5 keys and the phone dock agree on one answer
 * and a unit test can pin it down without mounting anything.
 */

export type DestinationId = 'home' | 'map' | 'races' | 'community' | 'profile'

export interface Destination {
  readonly id: DestinationId
  /** 1-based; it is both the rail's index number and the key that opens it. */
  readonly key: 1 | 2 | 3 | 4 | 5
  readonly to: '/' | '/map' | '/races' | '/groups' | '/profile'
  /** Route prefixes that light this destination up in the rail. */
  readonly owns: readonly string[]
}

export const DESTINATIONS: readonly Destination[] = [
  { id: 'home', key: 1, to: '/', owns: ['/today'] },
  {
    id: 'map',
    key: 2,
    to: '/map',
    owns: ['/map', '/path', '/academy', '/review', '/exercise', '/session', '/result'],
  },
  { id: 'races', key: 3, to: '/races', owns: ['/races'] },
  { id: 'community', key: 4, to: '/groups', owns: ['/groups', '/leaderboards'] },
  { id: 'profile', key: 5, to: '/profile', owns: ['/profile'] },
]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** The destination a route belongs to, or `null` for the pages reached from the cog menu. */
export function destinationOf(pathname: string): DestinationId | null {
  if (pathname === '/') return 'home'
  return DESTINATIONS.find((d) => d.owns.some((prefix) => under(pathname, prefix)))?.id ?? null
}

/**
 * Routes that need a physical keyboard. On a phone they show a calm notice instead; profile,
 * leaderboards, groups, the races lobby and the reference pages stay readable.
 */
const TRAINING = [
  '/today',
  '/map',
  '/path',
  '/academy',
  '/review',
  '/exercise',
  '/session',
  '/start',
]

export function needsKeyboard(pathname: string): boolean {
  if (pathname === '/') return true
  if (under(pathname, '/races/room')) return true
  return TRAINING.some((prefix) => under(pathname, prefix))
}

/**
 * Pages that are not part of the game frame: the product page is a long, scrolling landing page
 * and keeps its own full-bleed layout.
 */
export function isOutsideFrame(pathname: string): boolean {
  return pathname === '/about'
}
