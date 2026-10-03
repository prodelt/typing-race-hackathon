import { expect, MOTION_OFF_SETTINGS, seedStore, test } from './harness/fixtures.js'
import { realKeyboard } from './harness/realType.js'

/**
 * Typing with real key events (`Input.dispatchKeyEvent`), not `beforeinput` dispatched at the
 * textarea. Only a key the page can actually receive gets through, so these prove what the
 * synthetic driver cannot: the surface has focus, and a physical keyboard moves the line.
 */

test.use({ serviceWorkers: 'block' })

const STARTING_LEVEL = { startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' } }

test.describe('real keyboard in Training', { tag: '@cdp' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      ...STARTING_LEVEL,
    } as Parameters<typeof seedStore>[1])
  })

  test('a ЙЦУКЕН keyboard types the first Ukrainian exercise to its result', async ({ page }) => {
    await page.goto('/exercise/yq.run.anchors?mode=practice')
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const line = page.getByTestId('typing-line')
    await expect(line).toBeVisible()

    const keys = await realKeyboard(page, 'yq')
    // Nothing was clicked into: the exercise itself must have put the focus where keys land.
    expect(await keys.focusIsOnTypingSurface()).toBe(true)

    const text = (await line.locator('p.sr-only').textContent()) ?? ''
    expect(text.length).toBeGreaterThan(10)
    await keys.type(text)
    await expect(page).toHaveURL(/\/result\//)
    await keys.detach()
  })

  test('a wrong key, Backspace and Escape behave like the keys they are', async ({ page }) => {
    await page.goto('/exercise/yq.run.anchors?mode=practice')
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const line = page.getByTestId('typing-line')
    await expect(line).toBeVisible()
    const keys = await realKeyboard(page, 'yq')
    const text = (await line.locator('p.sr-only').textContent()) ?? ''
    const chars = [...text]

    // The first letter right, then a letter that is not the next one: an error, the cursor holds.
    await keys.type(chars[0] ?? '')
    const wrong = ['ф', 'і', 'в', 'а', 'о', 'л', 'д', 'ж'].find((c) => c !== chars[1]) ?? 'ф'
    await keys.type(wrong)
    await expect(page.getByTestId('typing-line').locator('[data-mark="wrong"]')).toHaveCount(1)
    await keys.backspace()
    await keys.type(chars[1] ?? '')
    await expect(page.getByTestId('typing-line').locator('[data-mark="wrong"]')).toHaveCount(0)

    // Escape pauses.
    await keys.escape()
    await expect(page.getByRole('dialog')).toBeVisible()
    await keys.detach()
  })
})
