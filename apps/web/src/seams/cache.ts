import type { AssetCache, AssetCacheStatus } from './index.js'

/**
 * T023. The service worker behind a seam, so that the default in every test is **off**.
 *
 * That default is the point. A registered service worker serving a stale shell will happily make
 * a broken build pass its own end-to-end suite, and the failure mode is a green run against code
 * that is no longer there. Exactly one test — the offline scenario in US3 — opts into the real
 * adapter; everything else uses `noAssetCache`.
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
