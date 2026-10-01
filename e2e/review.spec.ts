import type { Page } from '@playwright/test'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * Weak-spot review: a learner whose history holds one clearly weak move (о → л, missed one time
 * in five and slow) opens Повторення, sees that move first with its numbers, drills it in one
 * click, and the drill's result says whether it improved.
 */

/** The exercise screen's hidden textarea, named for the typing driver (see session.spec.ts). */
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

function stats(count: number, misses: number, iki: number) {
  const hits = count - misses
  return { count, misses, sumIki: hits * iki, sumIkiSq: hits * iki * iki }
}

/** One earlier attempt: о → л is weak (10 of 50 missed, 480 ms); everything else is clean. */
function history() {
  const completedAt = Date.now() - 3_600_000
  return [
    {
      id: 'earlier',
      scaleId: 'yq.run.anchors',
      layoutId: 'yq',
      language: 'uk',
      mode: 'practice',
      seed: 1,
      startedAt: completedAt - 60_000,
      completedAt,
      elapsedMs: 60_000,
      metrics: {
        spm: 120,
        wpm: 24,
        accuracy: 0.97,
        errorCount: 10,
        errorsByChar: { л: 10 },
        rhythmConsistency: { value: 80, breaksExcluded: 0 },
        meanIkiByKey: {},
        meanIkiByTransition: {},
      },
      aggregates: {
        keys: { о: stats(50, 0, 160), л: stats(50, 0, 170), ф: stats(40, 0, 150) },
        transitions: { 'о>л': stats(50, 10, 480), 'ф>і': stats(40, 0, 150) },
      },
    },
  ]
}

async function seed(page: Page, attempts: unknown[]): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts,
  } as never)
}

test.describe('weak-spot review', () => {
  test('lists the weakest move first with its numbers, drills it, and shows whether it improved', async ({
    page,
  }) => {
    // A drill of ~140 characters typed one event each, plus an audit: longer than the default.
    test.setTimeout(90_000)
    await seed(page, history())
    await page.goto('/today')
    // Weak-spot review lives on the Map: the destination, then its «Слабкі місця» tab.
    await page
      .getByRole('navigation', { name: 'Основна навігація' })
      .getByRole('link', { name: 'Мапа' })
      .click()
    await page
      .getByRole('navigation', { name: 'Розділи мапи' })
      .getByRole('link', { name: 'Слабкі місця' })
      .click()
    await expect(page).toHaveURL(/\/review$/)
    await expect(page.getByRole('heading', { level: 1, name: /Повторення/ })).toBeVisible()

    const first = page.getByTestId('review-spots').getByRole('listitem').first()
    await expect(first).toHaveAttribute('data-element', 'о>л')
    await expect(first).toContainText('о → л')
    await expect(first).toContainText('20% помилок, 480 мс')
    await expect(first).toHaveAttribute('data-in-drill', 'true')

    // The two pictures: the error map and the rhythm, drawn from the same history.
    await expect(page.getByTestId('review-heatmap')).toBeVisible()
    await expect(page.getByTestId('review-rhythm')).toBeVisible()
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.then(() => undefined))),
    )
    await expectNoAxeViolations(page)

    // One click: a drill that holds the move.
    await page.getByRole('link', { name: 'Повторити слабкі місця' }).click()
    await expect(page).toHaveURL(/\/exercise\/yq\.review\./)
    await expect(page.getByRole('heading', { name: 'Повторення слабких місць' })).toBeVisible()
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    expect(text).toContain('ол')

    // Typed cleanly, the move's error rate falls, and the result says so in one word.
    await typeText(page, text)
    await expect(page).toHaveURL(/\/result\//)
    const outcome = page.getByTestId('review-outcome')
    await expect(outcome).toBeVisible()
    const row = outcome.locator('[data-element="о>л"]')
    await expect(row).toContainText('20% · 480 мс')
    await expect(row).toContainText('0% ·')
    await expect(row).toHaveAttribute('data-verdict', 'better')
    await expect(row).toContainText('краще')
  })

  test('with nothing measured yet, says calmly what to do', async ({ page }) => {
    await seed(page, [])
    await page.goto('/review')
    const empty = page.getByTestId('review-empty')
    await expect(empty).toContainText('Слабких місць поки не видно')
    await expect(empty).toContainText('після п’яти натискань')
    await expect(page.getByRole('link', { name: 'Повторити слабкі місця' })).toHaveCount(0)
    await empty.getByRole('link', { name: 'До Шляху' }).click()
    await expect(page).toHaveURL(/\/path$/)
  })
})
