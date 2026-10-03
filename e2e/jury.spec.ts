import type { Page } from '@playwright/test'
import { walkFirstRun } from './harness/firstRun.js'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  localAttemptIds,
} from './harness/fixtures.js'
import { typeText, typeWithCorrectedError } from './harness/type.js'

/**
 * The demonstration script of TECHNICAL_SPECIFICATION §9, walked once from a profile that has never
 * been opened to the sources page, through the real screens and the real store. Nothing is seeded:
 * every attempt is typed (through the product's own input path), so a break anywhere in the story a
 * jury is shown is a red build and not a surprise on the day.
 *
 * Steps 1-7 are here; step 8, "the automatic checks pass", is this suite and the CI around it.
 */

/** The exercise textarea carries no test id; the harness driver needs one (see exercise.spec.ts). */
const test = fixtureTest.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const name = () => {
        for (const node of document.querySelectorAll('main textarea')) {
          if (node.getAttribute('data-testid') !== 'typing-input') {
            node.setAttribute('data-testid', 'typing-input')
          }
        }
      }
      new MutationObserver(name).observe(document, { childList: true, subtree: true })
    })
    await use(page)
  },
})

/** A sequence of home-row keys: the first Stage 1 exercise. */
const ANCHORS = 'yq.run.anchors'
/** The Stage 1 scale whose third passing test opens к, the first key after the home row. */
const K_SCALE = 'yq.vertical.KeyR'
const ACADEMY_BIGRAM = 'academy.uk.bigrams.1'
/** The home row, the three keys that open Stage 2, and the space bar. */
const OPEN_KEYS = new Set([...'фівапролджє', ' '])

async function begin(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  const line = page.getByTestId('typing-line')
  await expect(line).toBeVisible()
  return (await line.locator('p.sr-only').textContent()) ?? ''
}

test('the jury script, §9: a new profile to the sources page', async ({ page }) => {
  test.setTimeout(240_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  // 1. A new profile, and the choice of Ukrainian.
  await page.goto('/')
  await walkFirstRun(page, { language: 'uk', level: /Знаю домашній ряд/ })
  await expect(page).toHaveURL(/\/exercise\//)

  // 2. An exercise on consecutive keys, with nothing on screen to look at during the test.
  // 5. A deliberate error, counted correctly, and one concrete next action.
  await page.goto(`/exercise/${ANCHORS}?mode=test`)
  const text = await begin(page)
  await expect(page.getByText('Наступна клавіша')).toHaveCount(0)
  await expect(page.getByTestId('keyboard-guide')).toHaveCount(0)
  await expect(page.getByTestId('finger-diagram')).toHaveCount(0)
  await typeWithCorrectedError(page, text, 4)
  await expect(page).toHaveURL(/\/result\//)
  const length = [...text].length
  const accuracy = ((length / (length + 1)) * 100).toFixed(1).replace('.', '[.,]')
  const tiles = page.getByRole('region', { name: 'Головні показники', exact: true })
  await expect(tiles).toContainText(/Помилки\s*1/)
  await expect(tiles).toContainText(new RegExp(`Точність\\s*${accuracy}\\s*%`))
  const next = page.getByRole('region', { name: 'Що робити далі', exact: true })
  await expect(next).toBeVisible()
  await expect(page.locator('[data-rule]')).toHaveCount(1)
  await expect(next.getByRole('button')).toHaveCount(1)
  await expectNoAxeViolations(page)

  // 3. A new key opens, and with it real words made only of keys the learner has already met.
  // The first attempt of the scale is typed cleanly three times in a row: the Mastery Rule.
  for (let pass = 1; pass <= 3; pass++) {
    await page.goto(`/exercise/${K_SCALE}?mode=test`)
    await typeText(page, await begin(page))
    await expect(page).toHaveURL(/\/result\//)
  }
  const unlock = page.getByTestId('unlock-words')
  await expect(unlock).toContainText('Нові слова з «к»')
  const words = (await unlock.locator('.wunlock__words span').allTextContents()).filter(Boolean)
  expect(words.length).toBeGreaterThan(2)
  for (const word of words) {
    expect(word).toContain('к')
    for (const char of word) expect(OPEN_KEYS.has(char) || char === 'к', word).toBe(true)
  }

  // 4. An Academy exercise on a frequent bigram.
  await page.goto(`/academy/${ACADEMY_BIGRAM}?mode=test`)
  const bigram = await begin(page)
  // The most frequent bigram of the data, repeated three times to start; which one it is changes
  // whenever the word banks are refreshed.
  expect(bigram).toMatch(/^(\S+) \1 \1 /)
  await typeText(page, bigram)
  await expect(page).toHaveURL(/\/result\//)
  await expect(page.getByRole('region', { name: 'Далі в Академії' })).toBeVisible()

  // 6. Progress comes back after a reload: no first run, and every attempt is still stored.
  await page.goto('/')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' })).toHaveCount(0)
  await expect(page.getByTestId('home-continue')).toBeVisible()
  expect(await localAttemptIds(page)).toHaveLength(5)

  // 7. The sources and licences page.
  await page.goto('/licences')
  await expect(page.getByRole('heading', { level: 1, name: 'Ліцензії' })).toBeVisible()
  await expect(page.getByRole('link', { name: /FrequencyWords/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Typing-Race 2026/ })).toBeVisible()
  await expectNoAxeViolations(page)
})
