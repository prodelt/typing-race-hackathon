import { type Browser, expect, type Page, test } from '@playwright/test'
import { backendConfigured, learner } from './harness/backend.js'
import { realKeyboard } from './harness/realType.js'

/**
 * Races on a real keyboard (`Input.dispatchKeyEvent`), against the backend the lane provides. The
 * synthetic `beforeinput` driver in `race.spec.ts` cannot see a missing focus or a key that never
 * arrives; a Race that "did nothing when you type" passed it. Here a key reaches the page only if
 * the page can receive it.
 *
 * `@backend`: skipped without a Supabase configuration. `@cdp`: Chromium only.
 */

const racer = (browser: Browser): Promise<Page> => learner(browser)

async function openLobby(page: Page, name: string): Promise<void> {
  await page.goto('/races')
  await expect(page.getByTestId('race-unavailable')).toHaveCount(0)
  await page.getByLabel('Ваше ім’я в заїзді').fill(name)
}

async function createRoom(page: Page, layout: 'QWERTY' | 'ЙЦУКЕН'): Promise<string> {
  await page.getByText(layout, { exact: true }).click()
  await page.getByRole('button', { name: 'Створити кімнату' }).click()
  const code = (await page.getByTestId('race-code').textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z0-9]{6}$/)
  return code
}

async function raceText(page: Page): Promise<string> {
  const text = await page.locator('[data-testid="typing-line"] .sr-only').textContent()
  if (text === null || text.length === 0) throw new Error('no race text on the page')
  return text
}

/** Where the typing line's awaited character sits: it does not move while the line is held. */
async function awaitedIndex(page: Page): Promise<number> {
  return page
    .locator('[data-testid="typing-line"] .typing-line__char')
    .evaluateAll((nodes) =>
      nodes.findIndex((node) => node.getAttribute('data-state') === 'awaited'),
    )
}

test.describe('races on a real keyboard', { tag: ['@cdp', '@backend'] }, () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('two racers type a private room on real keys: focus, a wrong key, one shared ranking', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const suffix = String(Date.now() % 100_000)
    const host = await racer(browser)
    const guest = await racer(browser)

    await openLobby(host, `Host ${suffix}`)
    const code = await createRoom(host, 'QWERTY')
    await openLobby(guest, `Guest ${suffix}`)
    await guest.getByLabel('Код кімнати').fill(code.toLowerCase())
    await guest.locator('#main').getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(guest.getByTestId('race-code')).toHaveText(code)
    await expect(host.getByTestId('race-roster-row')).toHaveCount(2)
    await host.getByRole('button', { name: 'Старт', exact: true }).click()

    const hostKeys = await realKeyboard(host, 'qwerty')
    const guestKeys = await realKeyboard(guest, 'qwerty')

    // The countdown is on screen but the line is not live yet: keys pressed now start nothing.
    await expect(host.locator('.race-run__line')).toBeVisible({ timeout: 20_000 })
    await hostKeys.type('qwe')
    await expect(host.locator('.race-run__line[data-live]')).toBeVisible({ timeout: 20_000 })
    await expect(guest.locator('.race-run__line[data-live]')).toBeVisible({ timeout: 20_000 })
    expect(await awaitedIndex(host)).toBe(0)

    // The surface holds focus the moment the race goes live, with nothing clicked.
    expect(await hostKeys.focusIsOnTypingSurface()).toBe(true)
    expect(await guestKeys.focusIsOnTypingSurface()).toBe(true)

    const hostText = await raceText(host)
    const guestText = await raceText(guest)
    expect(guestText).toBe(hostText)
    const chars = [...hostText]

    // The guest hits one wrong key early: the line holds on it, then carries on.
    await guestKeys.type(chars.slice(0, 5).join(''), { delayMs: 40 })
    await guestKeys.type('7')
    expect(await awaitedIndex(guest)).toBe(5)
    await guestKeys.type(chars.slice(5).join(''), { delayMs: 40 })
    await hostKeys.type(hostText, { delayMs: 40 })

    for (const page of [host, guest]) {
      await expect(page.getByText('Заїзд завершено.')).toBeVisible({ timeout: 60_000 })
    }
    const [seenByHost, seenByGuest] = await Promise.all([
      host.getByTestId('race-result').allTextContents(),
      guest.getByTestId('race-result').allTextContents(),
    ])
    expect(seenByHost).toHaveLength(2)
    expect(seenByGuest).toEqual(seenByHost)
    expect(seenByHost.join(' ')).toContain(`Host ${suffix}`)
    expect(seenByHost.join(' ')).toContain(`Guest ${suffix}`)

    await hostKeys.detach()
    await guestKeys.detach()
  })

  test('a Ukrainian race with the system on US explains itself, and clears when the layout is right', async ({
    browser,
  }) => {
    test.setTimeout(120_000)
    const suffix = String(Date.now() % 100_000)
    const host = await racer(browser)
    await openLobby(host, `Solo ${suffix}`)
    await createRoom(host, 'ЙЦУКЕН')
    await host.getByRole('button', { name: 'Старт', exact: true }).click()
    await expect(host.locator('.race-run__line[data-live]')).toBeVisible({ timeout: 30_000 })

    const text = await raceText(host)
    const notice = host.getByTestId('race-layout-notice')

    // The keys of a ЙЦУКЕН text, pressed with the operating system on a US layout.
    const onUs = await realKeyboard(host, 'qwerty')
    expect(await onUs.focusIsOnTypingSurface()).toBe(true)
    await onUs.type([...text].slice(0, 2).join(''), { intended: 'yq' })
    // Two stray letters are a slip, not an alarm: a live race says nothing yet.
    await expect(notice).toHaveCount(0)
    // Six keys in all: some Ukrainian letters (ї, б, ю...) sit on keys a US layout turns into signs,
    // and only letters count, so three foreign letters need a few more keys than three.
    await onUs.type([...text].slice(2, 6).join(''), { intended: 'yq' })
    await expect(notice).toHaveAttribute('data-tone', 'wrong')
    await expect(notice).toContainText('ЙЦУКЕН')
    // The line did not move: nothing a US layout produces is a letter of this text.
    expect(await awaitedIndex(host)).toBe(0)
    await onUs.detach()

    // The learner switches the system to ЙЦУКЕН and types the first letter.
    const onYq = await realKeyboard(host, 'yq')
    await onYq.type([...text][0] ?? '')
    await expect(notice).toHaveCount(0)
    expect(await awaitedIndex(host)).toBe(1)
    await onYq.detach()
  })
})
