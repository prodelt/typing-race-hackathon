import type { Page } from '@playwright/test'
import { expect, MOTION_OFF_SETTINGS, seedStore, test } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * The Academy, Stage 3 (requirements §3.3, §4.1, demo §9.4): the Map's third region shows its
 * modules in difficulty order with progress, a bigram exercise runs as a zero-peek test and moves the module's
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

/** A module's tab in the Map's Stage 3 block. */
function moduleRow(page: Page, id: string) {
  return page.locator(`[data-module="${id}"]`)
}

/** The Stage 3 blocks on the Map's route, in order. */
const ACADEMY_NODES = ['s3-keys', 's3-syllables', 's3-phrases', 's3-text'] as const

test.describe('Academy', () => {
  test('a learner opens the Academy, passes a bigram test and sees the module move (§9.4)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/academy')

    // The old address opens the Map on Stage 3.
    await expect(page).toHaveURL(/\/map\?stage=3$/)
    await expect(page.getByRole('heading', { name: 'Мапа', level: 1 })).toBeVisible()
    await expect(page.getByTestId('map-detail')).toHaveAttribute('data-stage', '3')
    // Stage 1 is not complete: the region says the Academy is best after it, and lets them in.
    await expect(page.getByTestId('map-region-3')).toContainText('радимо після етапу 1')
    // Modules are visible, numbered, in the §3.3 order, block by block along the route.
    const titles: string[] = []
    for (const node of ACADEMY_NODES) {
      await page.locator(`[data-node="${node}"]`).click()
      await expect(page.locator('.mmod__title').first()).toBeVisible()
      titles.push(...(await page.locator('.mmod__title').allInnerTexts()))
    }
    expect(titles.length).toBeGreaterThanOrEqual(14)
    expect(titles.indexOf('Найчастотніші біграми')).toBeLessThan(titles.indexOf('Речення'))
    expect(titles.indexOf('Речення')).toBeLessThan(titles.indexOf('Темпові серії'))

    await page.locator('[data-node="s3-keys"]').click()
    const bigrams = moduleRow(page, 'bigrams')
    await expect(bigrams.getByTestId('module-count')).toHaveText('0 з 6 опановано')

    await bigrams.click()
    // The first exercise is on the most frequent bigram of the data, whichever it is today.
    await page
      .getByTestId('module-bigrams')
      .getByRole('link', { name: /^Залік: / })
      .first()
      .click()
    await expect(page).toHaveURL(/\/academy\/academy\.uk\.bigrams\.1\?mode=test/)
    // The exercise screen is a lazy chunk: wait until it has replaced the Map, whose own start
    // button has the same name.
    await expect(page.getByTestId('map-detail')).toHaveCount(0)

    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    // Zero-peek: no keyboard guide and no next-key card in a test attempt.
    await expect(page.getByText('Наступна клавіша')).toHaveCount(0)

    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    expect(text).toMatch(/^(\S+) \1 \1 /)
    await typeText(page, text)

    await expect(page).toHaveURL(/\/result\//)
    const next = page.getByRole('region', { name: 'Далі в Академії' })
    await expect(next).toBeVisible()
    await expect(next.getByTestId('academy-next')).toContainText('Зараховано')
    await expect(next.getByRole('link', { name: 'Складати залік' })).toBeVisible()

    // In-app navigation: a reload would re-run the seed script and erase the attempt just made.
    await next.getByRole('link', { name: 'До Академії' }).click()
    await expect(page).toHaveURL(/\/map\?stage=3&course=uk$/)
    await moduleRow(page, 'bigrams').click()
    await expect(
      page
        .getByTestId('module-bigrams')
        .getByTestId('exercise-academy.uk.bigrams.1')
        .getByTestId('exercise-state'),
    ).toHaveText('Залік 1 з 3')
    await expect(moduleRow(page, 'bigrams')).not.toHaveAttribute('data-complete')
  })

  test('a module whose every exercise is mastered reads as complete', async ({ page }) => {
    await seedLearner(
      page,
      BIGRAMS.flatMap((scaleId) => [1, 2, 3].map(() => ({ scaleId, accuracy: 0.99 }))),
    )
    await page.goto('/academy')

    const bigrams = moduleRow(page, 'bigrams')
    await expect(bigrams).toHaveAttribute('data-complete', 'true')
    await expect(bigrams.getByTestId('module-count')).toHaveText('6 з 6 опановано')
    await expect(page.getByTestId('map-region-3')).toContainText('1 з 17 модулів')
    // A neighbouring module is untouched.
    await expect(moduleRow(page, 'same-finger')).not.toHaveAttribute('data-complete')
  })

  test('Stage 3 is a real region of the Map, and the old address still opens it', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/map')
    const stage = page.getByTestId('map-region-3')
    await expect(stage).toContainText('Етап 3 · Академія')
    await expect(stage).toContainText('0 з 17 модулів')

    // `/academy` lands on the Map with Stage 3 open, and `?course=` keeps picking the course.
    await page.goto('/academy?course=en')
    await expect(page).toHaveURL(/\/map\?stage=3&course=en$/)
    await expect(page.getByTestId('map-detail')).toHaveAttribute('data-stage', '3')
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('an exercise with letters Stage 1 has not opened says so, and still lets the learner start', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/academy/academy.uk.bigrams.1?mode=practice')

    const note = page.getByTestId('academy-locked')
    await expect(note).toContainText('яких ти ще не відкрив')
    await expect(note.getByRole('link', { name: 'До Етапу 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Почати' })).toBeEnabled()
  })

  test('a learner who already touch types sees no such note', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      startingLevelByLanguage: { uk: 'touchTypesWantsAccuracy', en: 'touchTypesWantsAccuracy' },
      attempts: [],
    } as Parameters<typeof seedStore>[1])
    await page.goto('/academy/academy.uk.bigrams.1?mode=practice')

    await expect(page.getByRole('button', { name: 'Почати' })).toBeVisible()
    await expect(page.getByTestId('academy-locked')).toHaveCount(0)
  })
})
