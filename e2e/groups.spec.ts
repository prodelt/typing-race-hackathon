import { expect, type Page, test } from '@playwright/test'
import { backendConfigured, learner } from './harness/backend.js'
import { typeText } from './harness/type.js'

/**
 * Groups and the group board against the real Supabase project: A creates a group, B joins it by
 * code, the two race each other once in a private room, and both then find themselves ranked on
 * the group board with A's own row marked. A third member who is a real (non-test) learner opens
 * the same board and sees neither: test accounts never reach a board a real learner sees.
 *
 * Tagged `@backend` and skipped when the build has no Supabase configuration.
 */

/** Paced inside the page; see the note on the same constant in race.spec.ts. */
const KEY_DELAY_MS = 60

async function race(page: Page): Promise<void> {
  await expect(page.locator('.race-run__line[data-live]')).toBeVisible({ timeout: 20_000 })
  const text = await page.locator('[data-testid="typing-line"] .sr-only').textContent()
  if (text === null || text.length === 0) throw new Error('no race text on the page')
  await typeText(page, text, KEY_DELAY_MS)
  await expect(page.getByText('Заїзд завершено.')).toBeVisible({ timeout: 30_000 })
}

async function groupBoard(page: Page, groupId: string): Promise<string[]> {
  await page.goto(`/leaderboards?scope=group&layout=qwerty&group=${groupId}`)
  await expect(page.getByRole('button', { name: 'Моя група' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
  return page.getByTestId('leaderboard-row').allTextContents()
}

test.describe('@backend groups', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('two members race, both rank on the group board, and test rows stay off real boards', async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const suffix = String(Date.now() % 100_000)
    const nameA = `e2e A ${suffix}`
    const nameB = `e2e B ${suffix}`
    const a = await learner(browser)
    const b = await learner(browser)

    // A creates the group and becomes its owner.
    await a.goto('/groups')
    await a.getByLabel('Ваше ім’я').fill(nameA)
    await a.getByLabel('Назва групи').fill(`e2e group ${suffix}`)
    await a.getByRole('button', { name: 'Створити', exact: true }).click()
    await expect(a.getByTestId('group-name')).toHaveText(`e2e group ${suffix}`)
    const code = (await a.getByTestId('group-code').textContent())?.trim() ?? ''
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    const groupId = a.url().split('/groups/')[1] ?? ''
    expect(groupId).toMatch(/^[0-9a-f-]{36}$/)

    // B joins by the code, typed in lower case.
    await b.goto('/groups')
    await b.getByLabel('Ваше ім’я').fill(nameB)
    await b.getByLabel('Код групи').fill(code.toLowerCase())
    await b.getByRole('button', { name: 'Приєднатися', exact: true }).click()
    await expect(b.getByTestId('group-member')).toHaveCount(2)
    await expect(b.getByTestId('group-member').first()).toContainText(nameA)
    await expect(b.getByTestId('group-member').first()).toContainText('власник')
    // Only the owner may remove members.
    await expect(b.getByRole('button', { name: /^Вилучити/ })).toHaveCount(0)
    await a.reload()
    await expect(a.getByRole('button', { name: `Вилучити ${nameB} з групи` })).toBeVisible()

    // They race each other once, in a private English room, under the same identities.
    await a.goto('/races')
    await expect(a.getByLabel('Ваше ім’я в заїзді')).toHaveValue(nameA)
    await a.getByText('QWERTY').click()
    await a.getByRole('button', { name: 'Створити кімнату' }).click()
    const room = (await a.getByTestId('race-code').textContent())?.trim() ?? ''
    await b.goto('/races')
    await expect(b.getByLabel('Ваше ім’я в заїзді')).toHaveValue(nameB)
    await b.getByLabel('Код кімнати').fill(room)
    await b.locator('#main').getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(a.getByTestId('race-roster-row')).toHaveCount(2)
    await a.getByRole('button', { name: 'Старт', exact: true }).click()
    await Promise.all([race(a), race(b)])

    // Both are ranked on the group board, and each sees their own row marked.
    const [seenByA, seenByB] = await Promise.all([groupBoard(a, groupId), groupBoard(b, groupId)])
    for (const seen of [seenByA, seenByB]) {
      expect(seen).toHaveLength(2)
      expect(seen.join(' ')).toContain(nameA)
      expect(seen.join(' ')).toContain(nameB)
    }
    await expect(a.locator('[data-testid="leaderboard-row"][data-me]')).toContainText(nameA)
    await expect(b.locator('[data-testid="leaderboard-row"][data-me]')).toContainText(nameB)

    // A real learner joins by the invite link and opens the same board: the two test rows are
    // excluded, so the board is empty for them.
    const real = await learner(browser, { real: true })
    await real.goto(`/groups/join/${code}`)
    await real.getByLabel('Ваше ім’я').fill(`e2e viewer ${suffix}`)
    await real.getByRole('button', { name: 'Приєднатися', exact: true }).click()
    await expect(real.getByTestId('group-member')).toHaveCount(3)
    await groupBoard(real, groupId)
    await expect(real.getByText(/Тут ще нікого немає/)).toBeVisible()
    await expect(real.getByTestId('leaderboard-row')).toHaveCount(0)

    // The real learner leaves again; the owner then removes B.
    await real.goto(`/groups/${groupId}`)
    await real.getByRole('button', { name: 'Вийти з групи' }).click()
    await real.getByRole('button', { name: 'Точно вийти?' }).click()
    await expect(real).toHaveURL(/\/groups$/)
    await a.goto(`/groups/${groupId}`)
    await expect(a.getByTestId('group-member')).toHaveCount(2)
    await a.getByRole('button', { name: `Вилучити ${nameB} з групи` }).click()
    await expect(a.getByTestId('group-member')).toHaveCount(1)
  })
})

test('groups and boards say calmly that they are unavailable when the backend is down', async ({
  page,
}) => {
  await page.route('**/auth/v1/**', (route) => route.abort())
  await page.goto('/leaderboards')
  await expect(page.getByTestId('community-unavailable')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('link', { name: 'До тренування' }).click()
  await expect(page).toHaveURL(/\/$/)
})
