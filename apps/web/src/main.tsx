import { createRouter, RouterProvider } from '@tanstack/react-router'
import '@typing-race/ui/tokens.css'
import '@typing-race/ui/themes.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isOutsideFrame } from './app/destinations.js'
import { buildRouteTree } from './app/router.js'
import { DEFAULT_SETTINGS, useAppStore } from './app/state/index.js'
import { applyPresentation, readEnvironment, watchSystemPreferences } from './app/theme.js'
import { cleanAuthUrl, parseAuthReturn, RETURN_TO_KEY } from './features/account/model.js'
import { completeAuthReturn, hasStoredSession, refreshAccount } from './features/account/state.js'
import { HomeScreen } from './features/home/HomeScreen.js'
import { installLatencyProbe } from './instrument/latency.js'
import { serviceWorkerCache } from './seams/index.js'
import { startSync } from './sync/index.js'

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

// A return from Google carries a code (or an error) in the address. It is read and the address
// cleaned *before* the router starts, so no code or token is ever routed, rendered or left in the
// history; the exchange itself happens after the first paint, in the lazily loaded Account code.
const authReturn = parseAuthReturn(window.location.href)
if (authReturn.kind !== 'none') {
  let returnTo: string | null = null
  try {
    returnTo = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
  } catch {
    // Without it the learner lands where Google sent them, cleaned.
  }
  window.history.replaceState(
    window.history.state,
    '',
    cleanAuthUrl(window.location.href, returnTo),
  )
}

const router = createRouter({
  routeTree: buildRouteTree({ home: HomeScreen }),
  defaultPreload: 'intent',
  // The View Transitions API, per docs/design/motion.md's frame layer: a cross-document fade with
  // an 8 px rise on the main column. CSS-only, so it costs no JavaScript, and browsers without it
  // simply swap the page — which is what they do today anyway.
  defaultViewTransition: true,
})

// The crossfade is the frame's: it moves the stage between two screens *of the frame*. The first
// render has no screen to fade from, and the product page (/about) has no frame at all, so neither
// takes one. WebKit's renderer crashes outright on a transition into /about (the stage named
// `main` vanishes mid-transition), which is how this rule was found.
const crossfade = router.startViewTransition.bind(router)
router.startViewTransition = (update) => {
  const from = router.state.resolvedLocation?.pathname
  const to = router.latestLocation.pathname
  if (from === undefined || isOutsideFrame(from) || isOutsideFrame(to)) {
    delete router.shouldViewTransition
    return update()
  }
  return crossfade(update)
}

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

// Sync runs only for a learner who already has a session (ADR-0006). The check is a localStorage
// read, so a learner without one never downloads the Supabase client and never meets the backend.
// An OAuth return starts sync itself once the code is exchanged.
if (authReturn.kind === 'code') {
  void completeAuthReturn(authReturn)
} else {
  // A refused or cancelled return explains itself and leaves any session (a guest's) in place.
  if (authReturn.kind === 'error') void completeAuthReturn(authReturn)
  if (hasStoredSession()) {
    void startSync()
    void refreshAccount()
  }
}

// The offline promise: after one successful load the app opens, runs an exercise and shows its
// result with the network away. Only a production build emits `/sw.js`, so the dev server never
// registers anything. Registration waits for `load` so installing the precache never competes
// with the first paint; a failed registration degrades the next visit and never this one.
if (import.meta.env.PROD) {
  const cache = serviceWorkerCache()
  if (document.readyState === 'complete') void cache.register()
  else window.addEventListener('load', () => void cache.register(), { once: true })
}
