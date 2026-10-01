import type { Page } from '@playwright/test'
import { expect, MOTION_OFF_SETTINGS, seedStore, test } from './harness/fixtures.js'

/**
 * The Map: Path and Academy as one route through three regions. One node per block of exercises;
 * the arrow keys walk the route, Enter starts the selected block's next exercise, and review and
 * free practice are always one key away.
 */

async function seedLearner(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: [],
  } as Parameters<typeof seedStore>[1])
}

function node(page: Page, id: string) {
  return page.locator(`[data-node="${id}"]`)
}

test.describe('the Map', () => {
  test('the old Path address opens it, on «ти тут», with three regions and a legend in words', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/path')
    await expect(page).toHaveURL(/\/map$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Мапа' })).toBeVisible()

    for (const [n, name] of [
      [1, 'Етап 1 · Гами'],
      [2, 'Етап 2 · Слова'],
      [3, 'Етап 3 · Академія'],
    ] as const) {
      await expect(page.getByTestId(`map-region-${n}`)).toContainText(name)
    }
    await expect(node(page, 's1-home')).toHaveAttribute('data-node-state', 'current')
    await expect(node(page, 's1-home')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('map-here')).toContainText('Ти тут:')
    // Every stage ends at its finish flag, and review stops sit on the route.
    for (const stage of [1, 2, 3]) await expect(node(page, `finish-${stage}`)).toBeVisible()
    await expect(node(page, 'review-2')).toBeVisible()
    const legend = page.getByRole('note', { name: 'Позначення' })
    for (const word of ['пройдено', 'ти тут', 'відкрито', 'закрито', 'повторення', 'фініш']) {
      await expect(legend).toContainText(word)
    }
  })

  test('arrow keys walk the route and Enter starts the selected block', async ({ page }) => {
    await seedLearner(page)
    await page.goto('/map')
    await expect(node(page, 's1-home')).toHaveAttribute('aria-pressed', 'true')

    await page.locator('body').press('ArrowRight')
    await expect(node(page, 's1-top')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('map-detail')).toContainText('Верхній ряд')
    // A closed block has nothing to start: Enter does nothing there.
    await page.locator('body').press('Enter')
    await expect(page).toHaveURL(/\/map$/)

    // Focus on the route follows the selection.
    await node(page, 's1-top').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(node(page, 's1-home')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/exercise\/yq\.run\.anchors\?mode=practice$/)
  })

  test('review and free practice are always one key away', async ({ page }) => {
    await seedLearner(page)
    await page.goto('/map')
    await expect(node(page, 's1-home')).toBeVisible()
    await page.locator('body').press('r')
    await expect(page).toHaveURL(/\/review$/)

    await page.goBack()
    await expect(node(page, 's1-home')).toBeVisible()
    await page.locator('body').press('p')
    await expect(page).toHaveURL(/\/exercise\/yq\.realtext\?mode=practice$/)
  })
})
