import type { Page } from '@playwright/test'
import { expect, MOTION_OFF_SETTINGS, seedStore, test } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * The Academy, Stage 3 (requirements §3.3, §4.1, demo §9.4): the course page shows its modules in
 * difficulty order with progress, a bigram exercise runs as a zero-peek test and moves the module's
 * progress, and a module whose every exercise is mastered reads as complete.
 */

/** The first bigram exercise of the Ukrainian course and the six exercises of that module. */
const BIGRAMS = Array.from({ length: 6 }, (_, i) => `academy.uk.bigrams.${i + 1}`)

interface SeedAttempt {
  readonly scaleId: string
  readonly accuracy: number
}

function summary(attempt: SeedAttempt, index: number, total: number) {
  const completedAt = Date.now() - (total - index) * 60_000
  return {
    id: `academy-seed-${index}`,
    scaleId: attempt.scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: completedAt - 15_000,
    completedAt,
    elapsedMs: 15_000,
    metrics: {
      spm: 240,
      wpm: 48,
      accuracy: attempt.accuracy,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
  }
}

async function seedLearner(page: Page, attempts: readonly SeedAttempt[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: attempts.map((a, i) => summary(a, i, attempts.length)),
  } as Parameters<typeof seedStore>[1])
}

function moduleRow(page: Page, id: string) {
  return page.getByTestId(`module-${id}`)
}

test.describe('Academy', () => {
  test('a learner opens the Academy, passes a bigram test and sees the module move (§9.4)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/academy')

    await expect(page.getByRole('heading', { name: 'Академія', level: 1 })).toBeVisible()
    // Stage 1 is not complete: the page says the Academy assumes every key, and lets them in.
    await expect(page.getByText('Академія розрахована на всі клавіші')).toBeVisible()
    // Modules are visible, numbered, in the §3.3 order, with their completion state.
    const titles = await page.locator('.academy-module__title').allInnerTexts()
    expect(titles.length).toBeGreaterThanOrEqual(14)
    expect(titles.indexOf('Найчастотніші біграми')).toBeLessThan(titles.indexOf('Речення'))
    expect(titles.indexOf('Речення')).toBeLessThan(titles.indexOf('Темпові серії'))

    const bigrams = moduleRow(page, 'bigrams')
    await expect(bigrams.getByTestId('module-count')).toHaveText('0 з 6 опановано')
    await expect(bigrams.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    await bigrams.getByRole('button', { name: /Показати вправи/ }).click()
    await bigrams.getByRole('link', { name: 'Залік: на · не' }).click()
    await expect(page).toHaveURL(/\/academy\/academy\.uk\.bigrams\.1\?mode=test/)

    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    // Zero-peek: no keyboard guide and no next-key card in a test attempt.
    await expect(page.getByText('Наступна клавіша')).toHaveCount(0)

    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    expect(text.startsWith('на на на')).toBe(true)
    await typeText(page, text)

    await expect(page).toHaveURL(/\/result\//)
    const next = page.getByRole('region', { name: 'Далі в Академії' })
    await expect(next).toBeVisible()
    await expect(next.getByTestId('academy-next')).toContainText('Зараховано')
    await expect(next.getByRole('link', { name: 'Складати залік' })).toBeVisible()

    // In-app navigation: a reload would re-run the seed script and erase the attempt just made.
    await next.getByRole('link', { name: 'До Академії' }).click()
    const after = moduleRow(page, 'bigrams')
    await after.getByRole('button', { name: /Показати вправи/ }).click()
    await expect(
      after.getByTestId('exercise-academy.uk.bigrams.1').getByTestId('exercise-state'),
    ).toHaveText('Залік 1 з 3')
    const value = Number(await after.getByRole('progressbar').getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThan(0)
    await expect(after).not.toHaveAttribute('data-complete')
  })

  test('a module whose every exercise is mastered reads as complete', async ({ page }) => {
    await seedLearner(
      page,
      BIGRAMS.flatMap((scaleId) => [1, 2, 3].map(() => ({ scaleId, accuracy: 0.99 }))),
    )
    await page.goto('/academy')

    const bigrams = moduleRow(page, 'bigrams')
    await expect(bigrams).toHaveAttribute('data-complete', 'true')
    await expect(bigrams.getByTestId('module-complete')).toHaveText('Завершено')
    await expect(bigrams.getByTestId('module-count')).toHaveText('6 з 6 опановано')
    await expect(page.getByTestId('academy-modules-complete')).toContainText('1')
    // A neighbouring module is untouched.
    await expect(moduleRow(page, 'same-finger')).not.toHaveAttribute('data-complete')
  })

  test('Stage 3 is a real stage on the Path', async ({ page }) => {
    await seedLearner(page)
    await page.goto('/path')
    const stage = page.getByTestId('academy-stage')
    await expect(stage).toContainText('Етап 3. Академія')
    await expect(stage).toContainText('0 з 17 модулів завершено')
    await stage.getByRole('link', { name: 'Перейти до Академії' }).click()
    await expect(page).toHaveURL(/\/academy$/)
  })
})
