import type { Page } from '@playwright/test'
import { expect, test as fixtureTest, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'

/**
 * The game shell: the five destinations and their 1–5 keys, Play Mode hiding the frame while a
 * run is on, the product page at /about, and the phone dock with its keyboard notice.
 */

/** The harness names the hidden textarea; the exercise screen does not carry the test id itself. */
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

const LEARNER = {
  settings: { ...MOTION_OFF_SETTINGS },
  startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
}

function rail(page: Page) {
  return page.getByRole('navigation', { name: 'Основна навігація' })
}

function statusBar(page: Page) {
  return page.getByRole('region', { name: 'Стан гравця' })
}

test.describe('the game shell', () => {
  test('a returning learner lands on Home inside the frame; a fresh profile is asked first', async ({
    page,
    browser,
  }) => {
    await seedStore(page, LEARNER)
    await page.goto('/')
    await expect(page.getByTestId('home-continue')).toBeVisible()
    await expect(rail(page).getByRole('link', { name: 'Головна' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(statusBar(page).getByTestId('status-level')).toHaveText('1')
    await expect(statusBar(page).getByText('гість', { exact: true })).toBeVisible()

    // The old address of Today still works.
    await page.goto('/today')
    await expect(page).toHaveURL(/\/$/)

    const fresh = await browser.newPage()
    await fresh.goto('/')
    await expect(fresh.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
    await expect(rail(fresh)).toBeVisible()
    await fresh.close()
  })

  test('keys 1–5 switch destinations, but not from inside a field', async ({ page }) => {
    await seedStore(page, LEARNER)
    await page.goto('/')
    await expect(page.getByTestId('home-continue')).toBeVisible()

    const steps = [
      ['2', /\/path$/, 'Мапа'],
      ['3', /\/races$/, 'Перегони'],
      ['4', /\/groups$/, 'Спільнота'],
      ['5', /\/profile$/, 'Профіль'],
      ['1', /\/$/, 'Головна'],
    ] as const
    for (const [key, url, name] of steps) {
      await page.locator('body').press(key)
      await expect(page).toHaveURL(url)
      await expect(rail(page).getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    }

    // A number typed into a field stays in the field.
    await page.goto('/settings')
    const slider = page.getByRole('slider', { name: 'Розмір тексту вправи' })
    await slider.focus()
    await page.keyboard.press('3')
    await expect(page).toHaveURL(/\/settings$/)

    // The rail says which key opens what.
    await expect(rail(page).getByRole('link', { name: 'Мапа' })).toHaveAttribute(
      'aria-keyshortcuts',
      '2',
    )
  })

  test('Play Mode: the rail and the status bar leave while a run is on, and come back after', async ({
    page,
  }) => {
    await seedStore(page, LEARNER)
    await page.goto('/exercise/yq.run.anchors?mode=practice')
    await expect(rail(page)).toBeVisible()
    await expect(statusBar(page)).toBeVisible()

    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    await expect(rail(page)).toBeHidden()
    await expect(statusBar(page)).toBeHidden()

    // The destination keys are off: the run owns the keyboard.
    await page.keyboard.press('2')
    await expect(page).toHaveURL(/\/exercise\//)

    // Escape keeps its pause, and leaving the run brings the frame back.
    await page.getByTestId('typing-input').press('Escape')
    const pause = page.getByRole('dialog', { name: 'Пауза' })
    await expect(pause).toBeVisible()
    await expect(rail(page)).toBeHidden()
    await pause.getByRole('button', { name: 'Залишити спробу' }).click()
    await expect(page).toHaveURL(/\/path$/)
    await expect(rail(page)).toBeVisible()
    await expect(statusBar(page)).toBeVisible()
  })

  test('the product page lives at /about, outside the frame, and the menu reaches it', async ({
    page,
  }) => {
    await seedStore(page, LEARNER)
    await page.goto('/')
    await page.getByRole('button', { name: 'Про гру' }).click()
    await page.getByRole('link', { name: 'Про Typing-Race' }).click()
    await expect(page).toHaveURL(/\/about$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Друкуй наосліп' })).toBeVisible()
    await expect(rail(page)).toHaveCount(0)

    // The cog opens Settings.
    await page.goto('/')
    await statusBar(page).getByRole('link', { name: 'Налаштування' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Налаштування' })).toBeVisible()
  })

  test('on a phone the rail is a dock and training asks for a physical keyboard', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedStore(page, LEARNER)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Потрібна фізична клавіатура' }),
    ).toBeVisible()
    await expect(page.getByTestId('home-continue')).toBeHidden()

    await rail(page).getByRole('link', { name: 'Профіль' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Профіль' })).toBeVisible()
    const dock = await rail(page).boundingBox()
    expect(dock?.y ?? 0).toBeGreaterThan(700)
  })
})
