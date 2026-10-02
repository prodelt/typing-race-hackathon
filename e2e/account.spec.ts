import { expect, type Page, test } from '@playwright/test'
import { backendConfigured } from './harness/backend.js'
import {
  ATTEMPT_ID,
  addUser,
  type FakeSupabase,
  type FakeUser,
  fakeSupabase,
  SESSION_KEY,
  seedLearner,
} from './harness/fakeSupabase.js'
import { localAttemptIds } from './harness/fixtures.js'

/**
 * The Account: Google sign-in, the second-device 422, the nick, sync state, sign-out and "delete my
 * data" (ADR-0006).
 *
 * Without a backend the chip and the Account section must still make sense: sign-in is offered and,
 * when pressed, says calmly that it is unavailable.
 *
 * With a backend configured (`@backend`), **nothing reaches it**: `fakeSupabase` answers every
 * request to the configured URL, Google's consent included, so the whole flow — PKCE round trip,
 * `linkIdentity`, the outbox upload, the wipe — runs against an in-memory project. Point the build
 * at a placeholder such as `https://typing-race-e2e.supabase.co` to run it anywhere.
 */

const chip = (page: Page) => page.getByTestId('account-chip')
const account = (page: Page) => page.getByTestId('profile-account')

test.describe('account without a backend', () => {
  test.skip(backendConfigured(), 'this build has a backend; the @backend specs cover it')

  test('the chip offers Google sign-in and, pressed, says calmly that it is unavailable', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedLearner(page)
    await page.goto('/profile')

    await expect(chip(page)).toContainText('Увійти через Google')
    await expect(chip(page)).toBeEnabled()
    await expect(page.getByTestId('status-who')).toContainText('гість')
    await expect(account(page)).toContainText('Ви граєте як гість')
    await expect(account(page)).toContainText('Публічним буде лише нік')

    await chip(page).click()
    const dialog = page.getByRole('dialog', { name: 'Вхід зараз недоступний' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Заняття працюють і без нього')
    // The dialog holds the focus, and Esc lets go.
    await expect(dialog.getByRole('button', { name: 'Зрозуміло' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // The Account section's own button says the same.
    await account(page).getByRole('button', { name: 'Увійти через Google' }).click()
    await expect(page.getByRole('dialog', { name: 'Вхід зараз недоступний' })).toBeVisible()
    await page.getByRole('button', { name: 'Зрозуміло' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('@backend account (Supabase faked in the page)', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  let fake: FakeSupabase

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    fake = await fakeSupabase(page)
  })

  test.afterEach(() => {
    expect(fake.unexpected, 'requests the fake does not model').toEqual([])
  })

  const google = (nickname: string): FakeUser =>
    addUser(fake, {
      id: '0b9e2a1c-6f0d-4a3e-9c55-7d1f2e3a4b01',
      email: 'olesia.k@example.com',
      anonymous: false,
      nickname,
    })

  test('a guest signs in with Google: the code is exchanged, the URL cleaned, the outbox uploaded; sign-out wipes this browser', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/profile')
    await expect(chip(page)).toContainText('Увійти')

    await chip(page).click()
    // Back from "Google" on the page the learner left, with no code in the address.
    await expect(page.getByTestId('status-who')).toContainText('typist-0a0a0a0a')
    await expect(page).toHaveURL(/\/profile$/)
    expect(await page.evaluate(() => window.location.href)).not.toMatch(/code=|error/)
    await expect(page.getByTestId('account-toast')).toContainText('Ви увійшли')

    const user = [...fake.users.values()].find((u) => !u.anonymous)
    expect(user).toBeDefined()
    await expect.poll(() => [...(fake.attempts.get(user?.id ?? '') ?? [])]).toContain(ATTEMPT_ID)
    await expect(chip(page)).toContainText('синхронізовано')
    // The email is the owner's alone: shown in the Account section, nowhere in the frame.
    await expect(account(page).getByTestId('account-email')).toHaveText('olesia.k@example.com')
    await expect(page.locator('.bar')).not.toContainText('olesia.k@example.com')

    await account(page).getByTestId('account-sign-out').click()
    await expect(chip(page)).toContainText('Увійти')
    await expect(page.getByTestId('account-toast')).toContainText('Ви вийшли')
    expect(await localAttemptIds(page)).toEqual([])
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('typing-race:race-name'))).toBeNull()
  })

  test('a second device: the 422 is explained, then the learner signs into that account and this browser uploads', async ({
    page,
  }) => {
    const owner = google('Олеся_К')
    fake.googleOwner = owner.id
    const guest = addUser(fake, {
      id: '3c1d0e9f-2b7a-4d6c-8e1f-5a4b3c2d1e02',
      email: null,
      anonymous: true,
      nickname: 'guest-racer',
    })
    // The guest's attempt is still queued (its uploads fail). An attempt the guest had already
    // uploaded would stay with the guest: ids are global, and accounts are not merged (ADR-0006).
    fake.refuseFrom.add(guest.id)
    await seedLearner(page, { session: fake.session(guest) })
    await page.goto('/profile')
    await expect(account(page)).toContainText('guest-racer')

    // Linking is refused: the plain-language question, the address clean.
    await account(page).getByTestId('profile-sign-in').click()
    const question = page.getByRole('dialog', { name: /уже має прогрес на іншому пристрої/ })
    await expect(question).toBeVisible()
    expect(await page.evaluate(() => window.location.href)).not.toMatch(/error|code=/)
    await expect(question.getByRole('button', { name: 'Увійти в цей акаунт' })).toBeFocused()

    // Esc keeps the guest as it was.
    await page.keyboard.press('Escape')
    await expect(question).toBeHidden()
    await expect(page.getByTestId('status-who')).toContainText('guest-racer')

    await account(page).getByTestId('profile-sign-in').click()
    await expect(question).toBeVisible()
    await question.getByRole('button', { name: 'Увійти в цей акаунт' }).click()

    await expect(page.getByTestId('status-who')).toContainText('Олеся_К')
    await expect.poll(() => [...(fake.attempts.get(owner.id) ?? [])]).toContain(ATTEMPT_ID)
    // The guest keeps its races; nothing of the account was merged into it.
    expect(fake.users.get(guest.id)?.anonymous).toBe(true)
  })

  test('linking a guest keeps its id: the same user becomes the Google account', async ({
    page,
  }) => {
    const guest = addUser(fake, {
      id: '4d2e1f0a-3c8b-4e7d-9f20-6b5c4d3e2f03',
      email: null,
      anonymous: true,
      nickname: 'swift-guest',
    })
    await seedLearner(page, { session: fake.session(guest) })
    await page.goto('/profile')
    await account(page).getByTestId('profile-sign-in').click()
    await expect(chip(page)).toContainText('синхронізовано')
    await expect(page.getByTestId('status-who')).toContainText('swift-guest')
    expect(fake.users.get(guest.id)?.anonymous).toBe(false)
    await expect.poll(() => [...(fake.attempts.get(guest.id) ?? [])]).toContain(ATTEMPT_ID)
  })

  test('sign-out with unsynced attempts explains and wipes nothing; a retry once online signs out', async ({
    page,
  }) => {
    const owner = google('Олеся_К')
    fake.submitDown = true
    await seedLearner(page, { session: fake.session(owner) })
    await page.goto('/profile')
    await expect(page.getByTestId('status-who')).toContainText('Олеся_К')

    await account(page).getByTestId('account-sign-out').click()
    const pending = page.getByTestId('account-signout-pending')
    await expect(pending).toBeVisible()
    await expect(pending).toContainText('Спроб, які ще не дійшли до хмари: 1')
    expect(await localAttemptIds(page)).toEqual([ATTEMPT_ID])

    fake.submitDown = false
    await pending.getByRole('button', { name: 'Спробувати ще раз' }).click()
    await expect(chip(page)).toContainText('Увійти')
    expect(await localAttemptIds(page)).toEqual([])
    expect([...(fake.attempts.get(owner.id) ?? [])]).toContain(ATTEMPT_ID)
  })

  test('the nick: a taken one is refused in plain words, a free one is saved everywhere', async ({
    page,
  }) => {
    const owner = google('Олеся_К')
    fake.takenNicks.add('taken-nick')
    await seedLearner(page, { session: fake.session(owner) })
    await page.goto('/profile')

    await account(page).getByRole('button', { name: 'Змінити нік' }).click()
    const field = account(page).getByTestId('account-nick-input')
    await expect(field).toBeFocused()
    await field.fill('taken-nick')
    await account(page).getByRole('button', { name: 'Зберегти' }).click()
    await expect(account(page).getByRole('alert')).toContainText('Цей нік уже зайнятий')

    await field.fill('Swift-Fox')
    await field.press('Enter')
    await expect(account(page).getByTestId('account-nick')).toHaveText('Swift-Fox')
    await expect(page.getByTestId('status-who')).toContainText('Swift-Fox')
    expect(owner.nickname).toBe('Swift-Fox')
    expect(await page.evaluate(() => localStorage.getItem('typing-race:race-name'))).toBe(
      'Swift-Fox',
    )
  })

  test('delete my data takes two steps, then the server deletes and this browser forgets', async ({
    page,
  }) => {
    const owner = google('Олеся_К')
    await seedLearner(page, { session: fake.session(owner) })
    await page.goto('/profile')
    await expect(chip(page)).toContainText('синхронізовано')

    await account(page).getByTestId('account-delete').click()
    const confirm = page.getByRole('dialog', { name: 'Видалити всі ваші дані?' })
    await expect(confirm).toBeVisible()
    // The safe answer has the focus; Esc deletes nothing.
    await expect(confirm.getByRole('button', { name: 'Скасувати' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirm).toBeHidden()
    expect(fake.deleted).toEqual([])

    await account(page).getByTestId('account-delete').click()
    await confirm.getByRole('button', { name: 'Видалити назавжди' }).click()
    await expect(page.getByTestId('account-toast')).toContainText('Ваші дані видалено')
    expect(fake.deleted).toEqual([owner.id])
    await expect(chip(page)).toContainText('Увійти')
    expect(await localAttemptIds(page)).toEqual([])
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })
})
