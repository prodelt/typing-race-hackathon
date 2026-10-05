import {
  expect,
  expectNoAxeViolations,
  MOTION_OFF_SETTINGS,
  seedStore,
  test,
} from './harness/fixtures.js'

/**
 * Home, the hub: one Continue that starts the session, the race tiles, the mini-map, the weak
 * spot and the daily goal, each reachable by one key, and the row of free-practice modes.
 */

function stats(count: number, misses: number, iki: number) {
  const hits = count - misses
  return { count, misses, sumIki: hits * iki, sumIkiSq: hits * iki * iki }
}

/** Two earlier attempts in which о → л is slow, so Home has a weak spot to name. */
function history() {
  const end = Date.now() - 3_600_000
  return [520, 480].map((iki, i) => ({
    id: `earlier-${i}`,
    scaleId: 'yq.run.anchors',
    layoutId: 'yq',
    language: 'uk',
    mode: 'practice',
    seed: 1,
    startedAt: end - 60_000 * (i + 2),
    completedAt: end - 60_000 * (i + 1),
    elapsedMs: 60_000,
    metrics: {
      spm: 120,
      wpm: 24,
      accuracy: 0.97,
      errorCount: 2,
      errorsByChar: {},
      rhythmConsistency: { value: 80, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: {
      keys: { о: stats(50, 0, 160), л: stats(50, 0, 170) },
      transitions: { 'о>л': stats(50, 1, iki) },
    },
  }))
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: history(),
  } as never)
})

test('Home shows the five panels with real numbers', async ({ page }) => {
  await page.goto('/')
  const go = page.getByTestId('home-continue')
  await expect(go.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(go.getByRole('listitem')).toHaveCount(4)
  await expect(go).toContainText(/до \+\d+ XP за заняття/)

  await expect(page.getByRole('button', { name: /УКР · швидкий матч/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Кімната з другом/ })).toBeVisible()
  await expect(page.getByTestId('home-map')).toContainText(/8 з \d+ клавіш відкрито/)
  await expect(page.getByTestId('home-weak')).toContainText('о → л')
  await expect(page.getByTestId('home-weak').getByRole('img')).toBeVisible()
  await expect(page.getByTestId('home-goal')).toContainText(/Сьогодні \d+ з 20 хв/)
})

test('Enter starts the session at its first block, and Home then offers to resume it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('home-continue')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/exercise\/.+\?mode=practice/)

  await page
    .getByRole('navigation', { name: 'Основна навігація' })
    .getByRole('link', { name: 'Головна' })
    .click()
  await expect(page.getByRole('button', { name: 'Продовжити заняття' })).toBeVisible()
})

test('Q opens a quick Ukrainian race and D drills the weak spot', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-continue')).toBeVisible()
  await page.keyboard.press('KeyQ')
  await expect(page).toHaveURL(/\/races/)

  await page.goto('/')
  await expect(page.getByTestId('home-weak')).toBeVisible()
  await page.keyboard.press('KeyD')
  await expect(page).toHaveURL(/\/exercise\/.+\?mode=practice/)
})

test('the Modes row opens Daily and Mistakes; a locked Sprint says how it opens', async ({
  page,
}) => {
  await page.goto('/')
  const modes = page.getByTestId('home-modes')
  await expect(modes.getByRole('link', { name: /Свій текст/ })).toBeVisible()

  // Stage 2 is not open for this learner, so Sprint is locked and its tooltip says why; Esc hides it.
  const sprint = modes.getByRole('button', { name: /Спринт 60 с/ })
  await expect(sprint).toHaveAttribute('aria-disabled', 'true')
  await sprint.focus()
  const why = page.getByRole('tooltip').filter({ hasText: 'Відкриється з етапом «Слова»' })
  await expect(why).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(why).toBeHidden()

  await modes.getByRole('button', { name: /Помилки/ }).click()
  await expect(page).toHaveURL(/\/exercise\/.+\?mode=practice/)

  await page.goto('/')
  await page
    .getByTestId('home-modes')
    .getByRole('link', { name: /Виклик дня/ })
    .click()
  await expect(page).toHaveURL(/\/daily$/)
})

test('Esc closes a weak-spot chip tooltip', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('home-weak-chips').getByText('о → л', { exact: true }).focus()
  const why = page.getByRole('tooltip').filter({ hasText: '«о → л»' })
  await expect(why).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(why).toBeHidden()
})

test('Home has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-continue')).toBeVisible()
  await expectNoAxeViolations(page)
})
