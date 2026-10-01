import type { AssetCache, AssetCacheStatus } from './index.js'

/**
 * The service worker behind a seam. `main.tsx` registers the real adapter in production builds;
 * unit tests use `noAssetCache`. The worker is network-first for navigations and every asset URL is
 * content-hashed, so a registered worker cannot serve an e2e run a stale build.
 *
 * This is the only file in the application permitted to register a worker or touch the Cache API
 * (Constitution III); the worker script itself, under `src/sw/`, is the other.
 */

export function serviceWorkerCache(scriptUrl = '/sw.js'): AssetCache {
  let current: AssetCacheStatus = 'idle'

  return {
    async register() {
      if (!('serviceWorker' in navigator)) {
        current = 'unsupported'
        return current
      }
      try {
        await navigator.serviceWorker.register(scriptUrl, { type: 'module' })
        current = 'active'
      } catch {
        // FR-074 promises practice offline after the first load, not that registration cannot
        // fail. A failed worker degrades the next visit; it must never break this one.
        current = 'failed'
      }
      return current
    },
    status: () => current,
  }
}

/** Always `unsupported`. Registers nothing, caches nothing, and reports so honestly. */
export function noAssetCache(): AssetCache {
  return {
    register: () => Promise.resolve('unsupported'),
    status: () => 'unsupported',
  }
}
