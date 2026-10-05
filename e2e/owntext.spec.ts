import type { Page } from '@playwright/test'
import { expect, test as fixtureTest, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * Own text: free practice on a text the learner brings. Practice only (no test to switch to), a cut
 * text is named on the pre-start card, and "again" on its result re-runs the same text.
 */

/** The exercise textarea carries no test id; the harness driver needs one (see exercise.spec.ts). */
const test = fixtureTest.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const name = () => {
        for (const node of document.querySelectorAll('main textarea')) {
          if (node.getAttribute('aria-label') !== null) {
            node.setAttribute('data-testid', 'typing-input')
          }
        }
      }
      new MutationObserver(name).observe(document, { childList: true, subtree: true })
    })
    await use(page)
  },
})

async function seedLearner(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'knowsHomeRow', en: 'neverTouchTyped' },
    attempts: [],
  } as Parameters<typeof seedStore>[1])
}

async function submitOwnText(page: Page, text: string): Promise<void> {
  await page.getByLabel('Текст', { exact: true }).fill(text)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('scale-goal')).toHaveText('Ваш текст, вільна практика')
}

test('a long own text is cut, says so on the pre-start card, and offers no test', async ({
  page,
}) => {
  await seedLearner(page)
  await page.goto('/own')
  await submitOwnText(page, 'фіва олдж '.repeat(400))

  await expect(page.getByTestId('prestart-notice')).toContainText('Взято перші')
  await expect(page.getByRole('button', { name: 'Пройти залікову спробу' })).toHaveCount(0)
})

test('"again" on an own text result types the same text once more', async ({ page }) => {
  await seedLearner(page)
  await page.goto('/own')
  await submitOwnText(page, 'фіва олдж')
  await expect(page.getByTestId('prestart-notice')).toHaveCount(0)

  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
  await typeText(page, 'фіва олдж')
  await expect(page).toHaveURL(/\/result\//)
  await expect(page.getByText('Свій текст').first()).toBeVisible()

  await page.getByRole('button', { name: /Ще раз/ }).click()
  await expect(page).toHaveURL(/\/exercise\/yq\.owntext/)
  await expect(page.getByTestId('scale-goal')).toHaveText('Ваш текст, вільна практика')
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line').locator('p.sr-only')).toHaveText('фіва олдж')
})
