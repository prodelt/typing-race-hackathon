import { createRouter, RouterProvider } from '@tanstack/react-router'
import '@typing-race/ui/tokens.css'
import '@typing-race/ui/themes.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildRouteTree } from './app/router.js'
import { DEFAULT_SETTINGS, useAppStore } from './app/state/index.js'
import { applyPresentation, readEnvironment, watchSystemPreferences } from './app/theme.js'
import { TodayScreen } from './features/path/TodayScreen.js'
import { installLatencyProbe } from './instrument/latency.js'
import { serviceWorkerCache } from './seams/index.js'

/**
 * The application entry point.
 *
 * Order matters here. The theme is applied to `<html>` **before** React mounts, so no frame of the
 * wrong theme is ever painted — a flash of the light theme on the way to the dark one is the sort
 * of thing a learner notices at 7am and no test would ever catch.
 */

const environment = readEnvironment()
applyPresentation(DEFAULT_SETTINGS, environment)

// Re-applies whenever the reducer changes settings, and whenever the operating system does.
useAppStore.subscribe((state) => {
  applyPresentation(state.settings, readEnvironment())
})
watchSystemPreferences((next) => {
  applyPresentation(useAppStore.getState().settings, next)
})

// Dead in production: the body is behind `import.meta.env.DEV`, which the build constant-folds
// away (research R8, and the note in instrument/latency.ts about why dot access matters).
installLatencyProbe()

const router = createRouter({
  routeTree: buildRouteTree({ home: TodayScreen }),
  defaultPreload: 'intent',
  // The View Transitions API, per docs/design/motion.md's frame layer: a cross-document fade with
  // an 8 px rise on the main column. CSS-only, so it costs no JavaScript, and browsers without it
  // simply swap the page — which is what they do today anyway.
  defaultViewTransition: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// The offline promise: after one successful load the app opens, runs an exercise and shows its
// result with the network away. Only a production build emits `/sw.js`, so the dev server never
// registers anything. Registration waits for `load` so installing the precache never competes
// with the first paint; a failed registration degrades the next visit and never this one.
if (import.meta.env.PROD) {
  const cache = serviceWorkerCache()
  if (document.readyState === 'complete') void cache.register()
  else window.addEventListener('load', () => void cache.register(), { once: true })
}
