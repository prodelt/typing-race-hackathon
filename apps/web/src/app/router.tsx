import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import type { FunctionComponent } from 'react'
import { Shell } from './Shell.js'

/**
 * T059. Code-based routes — no file-based routing and no generated route tree (research R1).
 *
 * The reason is ownership, not taste. A generated `routeTree.gen.ts` is a committed artifact that
 * every lane adding a route rewrites, producing conflicts in a file nobody reviews and that
 * regenerates differently depending on who ran the generator last. Here a lane adds a route by
 * writing its own screen and one line in this file.
 *
 * The typed params and typed search that made TanStack Router worth choosing survive intact: only
 * discovery ergonomics are lost, and with eleven routes that costs nothing.
 *
 * **Every route but the entry is lazy**, and that is load-bearing rather than an optimisation
 * added afterwards. With all eleven screens statically imported the initial chunk came to 151.5 KB
 * gzip and T006's budget plugin failed the build — which is exactly what ticket 15 wanted the
 * budget to do. "Initial" means what the browser needs to paint `/`, and a learner opening the
 * product page has no use yet for the rhythm chart, the settings form or the session planner.
 * `defaultPreload: 'intent'` fetches each chunk on hover, so the split costs nothing where it
 * would be felt.
 */

const rootRoute = createRootRoute({ component: Shell })

/** Today became Home at `/`; the old address still works. */
const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})

/**
 * The Map: Path and Academy as one route through three regions. `stage` opens it on a region and
 * `course` picks the Academy course (absent, the typing language decides).
 */
const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map',
  validateSearch: (
    search: Record<string, unknown>,
  ): { stage?: 1 | 2 | 3; course?: 'uk' | 'en' } => {
    const stage = Number(search['stage'])
    const course = search['course']
    return {
      ...(stage === 1 || stage === 2 || stage === 3 ? { stage } : {}),
      ...(course === 'uk' || course === 'en' ? { course } : {}),
    }
  },
  component: lazyRouteComponent(() => import('../features/map/index.js'), 'MapScreen'),
})

/** The Path became the Map; the old address still works. */
const pathRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/path',
  beforeLoad: () => {
    throw redirect({ to: '/map', replace: true })
  },
})

/**
 * Mode lives in typed search rather than in the path, because it is a *property of this run* of
 * the scale, not a different resource — and because a typo in an untyped search parameter is
 * exactly how a test attempt would silently run with the keyboard guide visible.
 */
const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/exercise/$scaleId',
  // `start` opens the run straight into Play Mode (the first run's last step); without it the
  // pre-start screen comes first, as it always has.
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode: 'practice' | 'test'; start?: true } => ({
    mode: search['mode'] === 'test' ? 'test' : 'practice',
    ...(search['start'] === true || search['start'] === 1 || search['start'] === '1'
      ? { start: true as const }
      : {}),
  }),
  component: lazyRouteComponent(() => import('../features/exercise/index.js'), 'ExerciseScreen'),
})

/** Stage 3 is the Map's third region; the old address opens the Map there, course and all. */
const academyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academy',
  validateSearch: (search: Record<string, unknown>): { course?: 'uk' | 'en' } =>
    search['course'] === 'uk' || search['course'] === 'en' ? { course: search['course'] } : {},
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/map',
      search: { stage: 3, ...(search.course === undefined ? {} : { course: search.course }) },
      replace: true,
    })
  },
})

const academyExerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academy/$exerciseId',
  validateSearch: (search: Record<string, unknown>): { mode: 'practice' | 'test' } => ({
    mode: search['mode'] === 'test' ? 'test' : 'practice',
  }),
  component: lazyRouteComponent(
    () => import('../features/academy/index.js'),
    'AcademyExerciseScreen',
  ),
})

/** Weak-spot review: the learner's weakest keys and moves, one drill for them, and the maps. */
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  component: lazyRouteComponent(() => import('../features/review/index.js'), 'ReviewScreen'),
})

/** The daily challenge: one shared exercise a day, free practice. */
const dailyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/daily',
  component: lazyRouteComponent(() => import('../features/daily/index.js'), 'DailyScreen'),
})

const resultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/result/$attemptId',
  component: lazyRouteComponent(() => import('../features/result/index.js'), 'ResultScreen'),
})

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session',
  component: lazyRouteComponent(() => import('../features/session/index.js'), 'SessionScreen'),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('../features/settings/index.js'), 'SettingsScreen'),
})

const formulasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/formulas',
  component: lazyRouteComponent(() => import('../features/formulas/index.js'), 'FormulasPage'),
})

const licencesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/licences',
  component: lazyRouteComponent(() => import('../features/public/index.js'), 'LicencesPage'),
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: lazyRouteComponent(() => import('../features/public/index.js'), 'PrivacyPage'),
})

/** The product page: a long landing page, drawn outside the game frame. */
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: lazyRouteComponent(() => import('../features/product/index.js'), 'ProductPage'),
})

/** The short "about the project" page, reached from the «Про гру» menu. */
const aboutProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about/project',
  component: lazyRouteComponent(() => import('../features/public/index.js'), 'AboutPage'),
})

/** Settings' "start over": the first run again, history kept. */
const startRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/start',
  component: lazyRouteComponent(() => import('../features/firstrun/index.js'), 'FirstRunScreen'),
})

/** Profile, destination 05. */
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('../features/profile/index.js'), 'ProfileScreen'),
})

/** Live races. Lazy like every screen, which keeps `@supabase/supabase-js` out of the entry. */
const racesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/races',
  // Home's race tiles land here with what to do: `go` starts it at once, `lang` picks the text.
  validateSearch: (
    search: Record<string, unknown>,
  ): { go?: 'quick' | 'friend'; lang?: 'uk' | 'en' } => ({
    ...(search['go'] === 'quick' || search['go'] === 'friend' ? { go: search['go'] } : {}),
    ...(search['lang'] === 'uk' || search['lang'] === 'en' ? { lang: search['lang'] } : {}),
  }),
  component: lazyRouteComponent(() => import('../features/race/index.js'), 'RacesScreen'),
})

const raceRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/races/room/$roomId',
  component: lazyRouteComponent(() => import('../features/race/index.js'), 'RoomScreen'),
})

const raceJoinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/races/join/$code',
  component: lazyRouteComponent(() => import('../features/race/index.js'), 'JoinScreen'),
})

/** Groups and leaderboards. Lazy, and sharing the races' Supabase client and identity. */
const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  component: lazyRouteComponent(() => import('../features/groups/index.js'), 'GroupsScreen'),
})

const groupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId',
  component: lazyRouteComponent(() => import('../features/groups/index.js'), 'GroupScreen'),
})

const groupJoinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/join/$code',
  component: lazyRouteComponent(() => import('../features/groups/index.js'), 'GroupJoinScreen'),
})

const leaderboardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboards',
  validateSearch: (
    search: Record<string, unknown>,
  ): { scope?: 'group' | 'week' | 'all'; layout?: 'yq' | 'qwerty'; group?: string } => {
    const { scope, layout, group } = search
    return {
      ...(scope === 'group' || scope === 'week' || scope === 'all' ? { scope } : {}),
      ...(layout === 'yq' || layout === 'qwerty' ? { layout } : {}),
      ...(typeof group === 'string' && /^[0-9a-f-]{36}$/.test(group) ? { group } : {}),
    }
  },
  component: lazyRouteComponent(
    () => import('../features/leaderboards/index.js'),
    'LeaderboardsScreen',
  ),
})

/** Pages a visitor reaches from the «Про гру» menu, with or without a learner. */
export const PUBLIC_PATHS = [
  '/about',
  '/formulas',
  '/licences',
  '/privacy',
  '/about/project',
] as const

/**
 * Home is the one eagerly loaded route: it is what `/` renders, so deferring it would add a round
 * trip to the first paint and buy nothing. It is injected rather than imported so a test can mount
 * the tree with a stub entry screen and no module mock. For a fresh profile it starts the
 * first-run starting-level flow itself.
 */
export function buildRouteTree(pages: { readonly home: FunctionComponent }) {
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: pages.home,
  })

  return rootRoute.addChildren([
    homeRoute,
    todayRoute,
    mapRoute,
    pathRoute,
    exerciseRoute,
    academyRoute,
    academyExerciseRoute,
    reviewRoute,
    dailyRoute,
    resultRoute,
    sessionRoute,
    settingsRoute,
    startRoute,
    formulasRoute,
    licencesRoute,
    privacyRoute,
    aboutRoute,
    aboutProjectRoute,
    profileRoute,
    racesRoute,
    raceRoomRoute,
    raceJoinRoute,
    groupsRoute,
    groupRoute,
    groupJoinRoute,
    leaderboardsRoute,
  ])
}

export { createRouter, rootRoute }
