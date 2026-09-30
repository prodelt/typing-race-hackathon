import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import type { FunctionComponent } from 'react'
import { ExerciseScreen } from '../features/exercise/index.js'
import { PathScreen, TodayScreen } from '../features/path/index.js'
import { AboutPage, LicencesPage, PrivacyPage } from '../features/public/index.js'
import { ResultScreen } from '../features/result/index.js'
import { SessionScreen } from '../features/session/index.js'
import { SettingsScreen } from '../features/settings/index.js'
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
 */

const rootRoute = createRootRoute({ component: Shell })

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: TodayScreen,
})

const pathRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/path',
  component: PathScreen,
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
  component: ExerciseScreen,
})

const resultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/result/$attemptId',
  component: ResultScreen,
})

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session',
  component: SessionScreen,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsScreen,
})

const licencesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/licences',
  component: LicencesPage,
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutPage,
})

/**
 * The public pages are reachable without a learner. Everything else is behind sign-in from F2
 * onward; in F1 there is no sign-in, and `plan.md`'s waiver records why.
 */
export const PUBLIC_PATHS = ['/', '/formulas', '/licences', '/privacy', '/about'] as const

/**
 * The product and Formulas pages are injected rather than imported, so this file does not have to
 * be edited when their directory changes shape — and so a screen can be swapped for a stub in a
 * test without a module mock.
 */
export function buildRouteTree(pages: {
  readonly product: FunctionComponent
  readonly formulas: FunctionComponent
}) {
  const productRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: pages.product,
  })

  const formulasRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/formulas',
    component: pages.formulas,
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
