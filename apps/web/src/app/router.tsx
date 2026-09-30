import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
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

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: lazyRouteComponent(() => import('../features/path/index.js'), 'TodayScreen'),
})

const pathRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/path',
  component: lazyRouteComponent(() => import('../features/path/index.js'), 'PathScreen'),
})

/**
 * Mode lives in typed search rather than in the path, because it is a *property of this run* of
 * the scale, not a different resource — and because a typo in an untyped search parameter is
 * exactly how a test attempt would silently run with the keyboard guide visible.
 */
const exerciseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/exercise/$scaleId',
  validateSearch: (search: Record<string, unknown>): { mode: 'practice' | 'test' } => ({
    mode: search['mode'] === 'test' ? 'test' : 'practice',
  }),
  component: lazyRouteComponent(() => import('../features/exercise/index.js'), 'ExerciseScreen'),
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

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: lazyRouteComponent(() => import('../features/public/index.js'), 'AboutPage'),
})

/**
 * The public pages are reachable without a learner. Everything else is behind sign-in from F2
 * onward; in F1 there is no sign-in, and `plan.md`'s waiver records why.
 */
export const PUBLIC_PATHS = ['/', '/formulas', '/licences', '/privacy', '/about'] as const

/**
 * The product page is the one eagerly loaded route: it is what `/` renders, so deferring it would
 * add a round trip to the first paint and buy nothing. It is injected rather than imported so a
 * test can mount the tree with a stub entry screen and no module mock.
 */
export function buildRouteTree(pages: { readonly product: FunctionComponent }) {
  const productRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: pages.product,
  })

  return rootRoute.addChildren([
    productRoute,
    todayRoute,
    pathRoute,
    exerciseRoute,
    resultRoute,
    sessionRoute,
    settingsRoute,
    formulasRoute,
    licencesRoute,
    privacyRoute,
    aboutRoute,
  ])
}

export { createRouter, rootRoute }
