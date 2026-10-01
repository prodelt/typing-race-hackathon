import type { Page } from '@playwright/test'
import { expect, test as fixtureTest, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * Stage 2, "words from unlocked keys". A learner whose home row is open sees real words on the
 * Path, types a word drill made only of home-row characters, has it recorded, and — the jury's
 * demo step 3 — sees a newly opened key bring its own words with it.
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

/** ЙЦУКЕН home row: the eight anchors, the three keys that open Stage 2, and the space bar. */
const HOME_ROW = new Set([...'фівапролджє', ' '])
/** The Stage 1 scale that unlocks к, the first key after the home row. */
const K_SCALE = 'yq.vertical.KeyR'

let counter = 0

function testPass(scaleId: string, index: number) {
  const completedAt = Date.now() - (10 - index) * 60_000
  counter += 1
  return {
    id: `seed-${counter}`,
    scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: completedAt - 15_000,
    completedAt,
    elapsedMs: 15_000,
    metrics: {
      spm: 200,
      wpm: 40,
      accuracy: 0.99,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
  }
}

/** A learner who knows the home row, optionally two passes into the scale that opens к. */
async function seedHomeRow(page: Page, passesOnK = 0): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const envelope = {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'knowsHomeRow', en: 'neverTouchTyped' },
    attempts: Array.from({ length: passesOnK }, (_, i) => testPass(K_SCALE, i)),
  }
  await seedStore(page, envelope)
}

/**
 * In-app navigation only after the first load: the seed is an init script, so a full page load
 * would write it again over everything the test has just typed.
 */
async function openPath(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Основна навігація' })
    .getByRole('link', { name: 'Мапа' })
    .click()
  await expect(page).toHaveURL(/\/path$/)
}

function wordsRegion(page: Page) {
  return page.getByRole('region', { name: 'Слова з відкритих клавіш' })
}

/** Starts the attempt already on screen, types its whole text and waits for the result. */
async function typeAttempt(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  const line = page.getByTestId('typing-line')
  await expect(line).toBeVisible()
  const text = (await line.locator('p.sr-only').textContent()) ?? ''
  await typeText(page, text)
  await expect(page).toHaveURL(/\/result\//)
  return text
}

test('home row open: Stage 2 words appear, type only home-row letters, and count toward mastery', async ({
  page,
}) => {
  await seedHomeRow(page)
  await page.goto('/path')

  const words = wordsRegion(page)
  await expect(words).toBeVisible()
  await expect(words.getByTestId('words-featured')).toContainText('Перші справжні слова')
  await expect(words.locator('[data-drill-id="yq.words.length.short"]')).toBeVisible()
  // Keys past the home row stay closed, and say which key opens them.
  await expect(words.locator('[data-drill-id="yq.words.key.KeyR"]')).toHaveAttribute(
    'data-state',
    'lockedKeys',
  )

  await words.getByRole('button', { name: 'Почати вправу «Перші слова»' }).click()
  await expect(page).toHaveURL(/\/exercise\/yq\.words\.first/)
  await expect(page.getByTestId('scale-goal')).toContainText('Домашній ряд у справжніх словах')

  const practised = await typeAttempt(page)
  expect(practised.split(' ').length).toBeGreaterThan(5)
  for (const char of practised) expect(HOME_ROW.has(char), `«${char}» is not open`).toBe(true)

  // A Test Attempt: same words-only rule, and no keyboard guide or next-key hint (zero-peek).
  await openPath(page)
  await wordsRegion(page).getByRole('button', { name: 'Почати вправу «Перші слова»' }).click()
  await page.getByRole('button', { name: 'Пройти залікову спробу' }).click()
  await expect(page).toHaveURL(/mode=test/)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
  await expect(page.getByTestId('keyboard-guide')).toHaveCount(0)
  await expect(page.getByTestId('next-key')).toHaveCount(0)
  const tested = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
  for (const char of tested) expect(HOME_ROW.has(char), `«${char}» is not open`).toBe(true)
  await typeText(page, tested)
  await expect(page).toHaveURL(/\/result\//)

  await openPath(page)
  await expect(
    wordsRegion(page).getByTestId('words-featured'),
    'the passing test attempt is recorded as progress on the drill',
  ).toContainText('1 з 3')
})

test('opening a new key brings real words containing it', async ({ page }) => {
  await seedHomeRow(page, 2)

  // The third passing test attempt on к's scale unlocks к.
  await page.goto(`/exercise/${K_SCALE}?mode=test`)
  await typeAttempt(page)

  const unlock = page.getByTestId('unlock-words')
  await expect(unlock).toContainText('Нові слова з «к»')
  const shown = (await unlock.locator('.wunlock__words span').allTextContents()).filter(Boolean)
  expect(shown.length).toBeGreaterThan(2)
  for (const word of shown) {
    expect(word).toContain('к')
    for (const char of word) expect(HOME_ROW.has(char) || char === 'к', word).toBe(true)
  }

  // The Path now leads with the new key's words, and its drill types only open keys.
  await openPath(page)
  const featured = wordsRegion(page).getByTestId('words-featured')
  await expect(featured).toContainText('Нові слова з «к»')
  await featured.getByRole('button', { name: 'Почати вправу «Слова з «к»»' }).click()
  await expect(page).toHaveURL(/\/exercise\/yq\.words\.key\.KeyR/)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
  for (const word of text.split(' ')) expect(word).toContain('к')
  for (const char of text) expect(HOME_ROW.has(char) || char === 'к', char).toBe(true)
})
