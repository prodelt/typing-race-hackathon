/**
 * T066. The service worker behind the `AssetCache` seam (`src/seams/cache.ts`).
 *
 * FR-074: after one successful load the learner can open the app, run a Stage 1 exercise and read
 * the result with the network away. Stage 1 data, the scale generators and the keyboard maps are
 * bundled into the hashed JavaScript, so precaching the build output precaches the data; the
 * fonts (FR-085, self-hosted woff2) are emitted into the same output and ride along.
 *
 * This file is **self-contained on purpose**: no runtime imports. The build (`vite.config.ts`,
 * plugin `typing-race:service-worker`) compiles it alone, substitutes `__PRECACHE_MANIFEST__` with
 * the list of emitted files, and writes it to `/sw.js` unhashed, because the worker's URL is its
 * identity and the seam registers exactly `/sw.js`.
 *
 * Stale shells. The classic failure is a learner served yesterday's app forever. Three layers:
 *  1. `version` is a hash of every emitted file name (each already content-hashed) plus the HTML,
 *     and it is written into this file, so any deploy changes `sw.js` byte for byte. The browser
 *     re-fetches the worker script on navigation, sees the difference, and installs the new one.
 *  2. Install calls `skipWaiting()` and activate calls `clients.claim()`, then deletes every cache
 *     whose name is not the current version. No tab has to be closed for the update to land.
 *  3. Navigations are network-first. The HTML is the one un-hashed file, so it is never served
 *     from cache while the network answers; the cached copy is only the offline fallback.
 *
 * Known trade-off: a tab opened before a deploy that lazy-loads an old hashed chunk after the new
 * worker activated finds that chunk gone from the cache. It falls through to the network, which
 * may 404; the next navigation recovers. Acceptable against the alternative of never updating.
 */

interface PrecacheManifest {
  readonly version: string
  readonly urls: readonly string[]
}

/** Replaced at build time. The worker is emitted only by `vite build`, never served in dev. */
declare const __PRECACHE_MANIFEST__: PrecacheManifest

/**
 * The slice of the worker global scope this file uses. `apps/web` compiles against the DOM lib, and
 * the `webworker` lib cannot be loaded beside it without redeclaring every global, so the surface
 * is named here instead of widened with a cast.
 */
interface WorkerScope {
  readonly location: { readonly origin: string }
  readonly clients: { claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: 'install' | 'activate', listener: (event: WaitEvent) => void): void
  addEventListener(type: 'fetch', listener: (event: RequestEvent) => void): void
}

interface WaitEvent {
  waitUntil(work: Promise<unknown>): void
}

interface RequestEvent {
  readonly request: Request
  respondWith(response: Promise<Response>): void
}

declare const self: WorkerScope

const manifest: PrecacheManifest = __PRECACHE_MANIFEST__

const CACHE_PREFIX = 'typing-race-shell-'
const CACHE_NAME = `${CACHE_PREFIX}${manifest.version}`
const SHELL_URL = '/index.html'
/** An offline device fails fast; a flaky one must not hold the shell hostage. */
const NAVIGATION_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // `reload` bypasses the HTTP cache, so a half-stale CDN edge cannot poison a fresh version.
      // Atomic on purpose: one failed file fails the install, and the old worker keeps serving.
      await cache.addAll(manifest.urls.map((url) => new Request(url, { cache: 'reload' })))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Supabase and every other origin are not ours to cache (FR-085), and a write is never cached.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
    return
  }
  event.respondWith(assetFirst(request))
})

async function navigate(request: Request): Promise<Response> {
  try {
    return await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS)
  } catch {
    // Client-side routing: every path is the same shell, so any navigation offline gets it.
    const shell = await (await caches.open(CACHE_NAME)).match(SHELL_URL)
    return shell ?? Response.error()
  }
}

async function assetFirst(request: Request): Promise<Response> {
  const cached = await (await caches.open(CACHE_NAME)).match(request)
  return cached ?? fetch(request)
}

function withTimeout(work: Promise<Response>, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('navigation timed out')), ms)
    work.then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
