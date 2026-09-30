import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

/**
 * T070. Store seeding, motion-off, and the axe helper.
 *
 * Seeding writes **into IndexedDB itself** rather than swapping the app's store for an in-memory
 * one. That costs a few lines and buys something worth having: the end-to-end suite exercises the
 * real adapter, including the retention rule and the version envelope, so a defect in
 * `indexedDbStore` cannot hide behind a test double that the unit suite already covers.
 */

const DB_NAME = 'typing-race'
const DB_VERSION = 1
const STORE_NAME = 'envelope'
const ENVELOPE_KEY = 'current'

/** Mirrors `packages/domain`'s `StoredEnvelope`; kept loose so a seed can be partial. */
export interface SeedEnvelope {
  storeVersion?: number
  writtenAt?: number
  progressByLanguage?: Record<string, unknown>
  settings?: Record<string, unknown>
  attempts?: unknown[]
  logs?: Record<string, unknown>
}

export const MOTION_OFF_SETTINGS = {
  theme: 'light',
  motion: 'off',
  sound: 'off',
  textSizePx: 28,
  errorMode: 'stopOnLetter',
  typingLanguage: 'uk',
  layoutId: 'yq',
  interfaceLanguage: 'uk',
} as const

/**
 * Writes an envelope before the app's first script runs, so boot reads a learner rather than an
 * empty store. `addInitScript` is the only place this can happen: by the time a test could call
 * into the page, `BootGate` has already resolved.
 */
export async function seedStore(page: Page, seed: SeedEnvelope): Promise<void> {
  await page.addInitScript(
    ({ dbName, dbVersion, storeName, key, envelope }) => {
      const complete: Record<string, unknown> = {
        storeVersion: 1,
        writtenAt: Date.now(),
        progressByLanguage: {},
        attempts: [],
        logs: {},
        ...envelope,
      }

      // A promise the app will not await, but IndexedDB serialises transactions per database, so
      // the app's own open waits behind this one.
      const request = indexedDB.open(dbName, dbVersion)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName)
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(storeName, 'readwrite')
        transaction.objectStore(storeName).put(complete, key)
      }
    },
    {
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
      storeName: STORE_NAME,
      key: ENVELOPE_KEY,
      envelope: seed as Record<string, unknown>,
    },
  )
}

/**
 * The fixture every visual and accessibility scenario uses.
 *
 * Motion off is not a nicety: it is what makes a screenshot comparison deterministic, and the
 * product has one flag for exactly that reason (FR-064). Both halves are set — the stored setting
 * and the emulated OS preference — because either alone leaves one path animating.
 */
export const test = base.extend<{ calmPage: Page }>({
  calmPage: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, { settings: { ...MOTION_OFF_SETTINGS } })
    await use(page)
  },
})

/**
 * Zero axe violations, and the report names them when there are any — a bare count tells whoever
 * reads the failing build nothing they can act on.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const summary = results.violations
    .map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`)
    .join('\n')

  expect(results.violations, `axe violations:\n${summary}`).toEqual([])
}

export { expect }
