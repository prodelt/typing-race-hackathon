import { type Browser, expect, type Page, test } from '@playwright/test'
import { backendConfigured, learner } from './harness/backend.js'
import { typeChar } from './harness/type.js'

/**
 * Live races against the real Supabase project: two learners in two isolated browser contexts
 * meet in a private room by its code, race the same English text through the product's own
 * `beforeinput` path, and both see the same server-validated ranking.
 *
 * Tagged `@backend` and skipped when the build has no Supabase configuration, so the suite stays
 * green on a machine without `.env.local`.
 */

/**
 * About 1000 characters a minute: comfortably fast, and well under the server's plausibility
 * ceiling, which rejects a log typed faster than a human can.
 */
const KEY_DELAY_MS = 60

/** A test account: it races like anyone else and never reaches a board real learners see. */
function racer(browser: Browser): Promise<Page> {
  return learner(browser)
}

/** Types the room's text once the start gate opens, optionally with one wrong key on the way. */
async function race(page: Page, wrongAt: number | null): Promise<void> {
  // The line is on screen through the countdown, but it opens only at the start.
  await expect(page.locator('.race-run__line[data-live]')).toBeVisible({ timeout: 20_000 })
  const text = await page.locator('[data-testid="typing-line"] .sr-only').textContent()
  if (text === null || text.length === 0) throw new Error('no race text on the page')
  for (const [index, char] of [...text].entries()) {
    if (index === wrongAt) {
      await typeChar(page, '#')
      await page.waitForTimeout(KEY_DELAY_MS)
    }
    await typeChar(page, char)
    await page.waitForTimeout(KEY_DELAY_MS)
  }
}

async function ranking(page: Page): Promise<string[]> {
  await expect(page.getByText('Заїзд завершено.')).toBeVisible({ timeout: 30_000 })
  return page.getByTestId('race-result').allTextContents()
}

test('races say calmly that they are unavailable when the backend cannot be reached', async ({
  page,
}) => {
  await page.route('**/auth/v1/**', (route) => route.abort())
  await page.goto('/races')
  await expect(page.getByTestId('race-unavailable')).toBeVisible({ timeout: 20_000 })
  // Training is one click away and does not depend on the backend at all.
  await page.getByRole('link', { name: 'До тренування' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('a learner who never raced has no race rating, shown as absent rather than a number', async ({
  page,
}) => {
  await page.goto('/races')
  // No race identity in this browser: the status bar makes no request and shows a calm dash.
  await expect(page.getByTestId('status-rating')).toHaveText('—')
  await page.getByTestId('status-rating').locator('..').locator('..').focus()
  await expect(page.getByRole('tooltip').filter({ hasText: 'Рейтингу ще немає' })).toBeAttached()
})

test.describe('@backend races', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('two learners race a private room and see the same validated ranking', async ({
    browser,
  }) => {
    // Two racers typing ~250 characters each through `beforeinput`: about two minutes on a busy
    // machine, so the default budget is too tight.
    test.setTimeout(180_000)
    const suffix = String(Date.now() % 100_000)
    const host = await racer(browser)
    const guest = await racer(browser)

    // The host creates an English room.
    await host.goto('/races')
    await expect(host.getByTestId('race-unavailable')).toHaveCount(0)
    await host.getByLabel('Ваше ім’я в заїзді').fill(`Host ${suffix}`)
    await host.getByText('QWERTY').click()
    await host.getByRole('button', { name: 'Створити кімнату' }).click()
    const code = (await host.getByTestId('race-code').textContent())?.trim() ?? ''
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    // The guest joins by the code, from the lobby.
    await guest.goto('/races')
    await guest.getByLabel('Ваше ім’я в заїзді').fill(`Guest ${suffix}`)
    await guest.getByLabel('Код кімнати').fill(code.toLowerCase())
    await guest.locator('#main').getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(guest.getByTestId('race-code')).toHaveText(code)

    // Both are in the room before the host starts it.
    await expect(host.getByTestId('race-roster-row')).toHaveCount(2)
    await expect(host.getByTestId('race-roster-row').nth(1)).toContainText(`Guest ${suffix}`)
    await host.getByRole('button', { name: 'Старт', exact: true }).click()

    await Promise.all([race(host, null), race(guest, 40)])

    const [seenByHost, seenByGuest] = await Promise.all([ranking(host), ranking(guest)])
    expect(seenByHost).toHaveLength(2)
    expect(seenByGuest).toEqual(seenByHost)
    // Every ranked row carries its validated speed and accuracy.
    for (const row of seenByHost) expect(row).toMatch(/\d+зн\/хв\d+\.\d%точність/)
    expect(seenByHost.join(' ')).toContain(`Host ${suffix}`)
    expect(seenByHost.join(' ')).toContain(`Guest ${suffix}`)
  })
})
