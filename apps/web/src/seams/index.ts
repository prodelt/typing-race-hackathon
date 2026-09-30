/**
 * The seams — T013, `specs/001-typing-core/contracts/seams.md`.
 *
 * Constitution III: every module that talks to the outside world is reachable through an interface
 * with an in-memory adapter, and the interfaces are agreed **before** the tests that use them.
 *
 * The rule these exist to enforce, checked by `tools/architecture.test.ts` and by Biome:
 *
 * > No code outside `apps/web/src/seams/` touches IndexedDB, the Cache API, `performance.now()`,
 * > `Math.random()` or a DOM input event.
 *
 * `Clock`, `Random`, `InputSource` and `InputEvent` are declared in `@typing-race/domain` rather
 * than here, because `packages/engine` consumes them and must not depend on the application.
 * `ProgressStore` and `AssetCache` are declared here: nothing outside the app uses them.
 */

import type { Attempt, Settings, StoredEnvelope } from '@typing-race/domain'

export type {
  Clock,
  InputEvent,
  InputSource,
  LayoutProbe,
  Random,
} from '@typing-race/domain'

/**
 * The seam F2 replaces with Supabase, so its shape is designed for that now: asynchronous,
 * batched, idempotent by attempt id, version-marked.
 */
export interface ProgressStore {
  /**
   * Four outcomes rather than a throw, because each has its own screen:
   * `'empty'` is a first visit, `'unreadable-version'` is FR-083's deliberate fresh start, and
   * `'unavailable'` is FR-052 — the learner is told plainly and this visit's practice still runs.
   */
  load(): Promise<StoredEnvelope | 'empty' | 'unreadable-version' | 'unavailable'>
  /** Idempotent on `attempt.id`, so a retry cannot double-count. */
  appendAttempts(attempts: readonly Attempt[]): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  clear(): Promise<void>
}

export type AssetCacheStatus = 'active' | 'unsupported' | 'failed' | 'idle'

export interface AssetCache {
  register(): Promise<Exclude<AssetCacheStatus, 'idle'>>
  status(): AssetCacheStatus
}

export { noAssetCache, serviceWorkerCache } from './cache.js'
export { manualClock, systemClock } from './clock.js'
export { domInputSource, scriptedInput } from './input.js'
export { seededRandom } from './random.js'
export { indexedDbStore, memoryStore } from './store.js'
