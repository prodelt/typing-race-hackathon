import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Walks the first run with the mouse: language, an explicit level, the finger scheme, and on into
 * the first exercise. Specs that only need "a learner who has answered" use this, then go where
 * they need to; `e2e/shell.spec.ts` drives the same flow with the keyboard and the check.
 */
export async function walkFirstRun(
  page: Page,
  options: { readonly language?: 'uk' | 'en'; readonly level?: RegExp } = {},
): Promise<void> {
  const next = page.getByTestId('first-run-next')
  await expect(page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' })).toBeVisible()
  await page
    .getByRole('radio', { name: options.language === 'en' ? /English/ : /Українська/ })
    .check()
  await next.click()
  await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
  await page.getByRole('radio', { name: options.level ?? /Ще не друкую наосліп/ }).check()
  await next.click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Кожна клавіша — своєму пальцю' }),
  ).toBeVisible()
  await next.click()
  await expect(page).toHaveURL(/\/exercise\//)
}

/** Opens the first run's level step from a fresh profile, without answering it. */
export async function openLevelStep(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' })).toBeVisible()
  await page.getByTestId('first-run-next').click()
  await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
}

/** What the app stored, read back from IndexedDB: proof that a step kept (or wrote) something. */
export async function readEnvelope(page: Page): Promise<{
  readonly attempts: readonly unknown[]
  readonly startingLevelByLanguage: Readonly<Record<string, string>>
}> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('typing-race', 1)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('envelope').objectStore('envelope').get('current')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => resolve(get.result)
        }
      }),
  )
}
