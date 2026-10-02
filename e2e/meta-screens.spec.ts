import type { Page } from '@playwright/test'
import { backendConfigured } from './harness/backend.js'
import {
  expect,
  expectNoAxeViolations,
  MOTION_OFF_SETTINGS,
  seedStore,
  test,
} from './harness/fixtures.js'

/**
 * The meta screens inside the game frame: Profile (numbers, route, history, the honest Account
 * placeholder), the reference pages of the «Про гру» menu, and the Community switch between
 * groups and leaderboards.
 */

function stats(count: number, misses: number, iki: number) {
  const hits = count - misses
  return { count, misses, sumIki: hits * iki, sumIkiSq: hits * iki * iki }
}

/** Three finished attempts an hour apart: two practice, one test at 150 SPM. */
function history() {
  const end = Date.now() - 3_600_000
  return [
    { id: 'p1', mode: 'practice', spm: 120 },
    { id: 't1', mode: 'test', spm: 150 },
    { id: 'p2', mode: 'practice', spm: 130 },
  ].map((attempt, i) => ({
    id: attempt.id,
    scaleId: 'yq.run.anchors',
    layoutId: 'yq',
    language: 'uk',
    mode: attempt.mode,
    seed: 1,
    startedAt: end + i * 3_600_000 - 120_000,
    completedAt: end + i * 3_600_000,
    elapsedMs: 120_000,
    metrics: {
      spm: attempt.spm,
      wpm: attempt.spm / 5,
      accuracy: 0.97,
      errorCount: 2,
      errorsByChar: {},
      rhythmConsistency: { value: 80, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: { а: stats(40, 1, 200) }, transitions: {} },
  }))
}

/**
 * A visitor who has never answered the starting-level question. The harness's own `calmPage`
 * seeds an envelope without `startingLevelByLanguage`, which boot cannot read, so this one says
 * it explicitly.
 */
async function seedVisitor(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: {},
  } as never)
}

async function seedLearner(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: history(),
  } as never)
}

test.describe('Profile', () => {
  test('shows the level, the numbers, the route and the history, newest first', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Профіль' })).toBeVisible()

    await expect(page.getByTestId('profile-level')).toContainText('1')
    // Only the test attempt sets the best speed; practice never does.
    await expect(page.getByTestId('profile-best')).toContainText('150')
    await expect(page.getByTestId('profile-time')).toContainText('6 хв')
    await expect(page.getByTestId('profile-mastery')).toContainText('з 50 клавіш')

    const rows = page.getByTestId('profile-attempt')
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toContainText('130')
    await expect(rows.nth(1)).toContainText('залік')

    // A history row opens that attempt's result.
    await rows.nth(1).click()
    await expect(page).toHaveURL(/\/result\/t1$/)
  })

  test('the Account section offers Google sign-in to a guest and says what stays private', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/profile')
    const account = page.getByTestId('profile-account')
    await expect(account).toContainText('гість')
    await expect(account.getByRole('button', { name: 'Увійти через Google' })).toBeEnabled()
    await expect(account).toContainText('Публічним буде лише нік')
  })

  test('a fresh visitor sees an empty history that points to training', async ({
    page: visitor,
  }) => {
    await seedVisitor(visitor)
    await visitor.goto('/profile')
    await expect(visitor.getByTestId('profile-history')).toContainText('Тут з’являться')
    await expect(visitor.getByTestId('profile-attempt')).toHaveCount(0)
  })

  test('S opens Settings from Profile', async ({ page }) => {
    await seedLearner(page)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-level')).toBeVisible()
    await page.locator('body').press('s')
    await expect(page.getByRole('heading', { level: 1, name: 'Налаштування' })).toBeVisible()
  })

  test('is readable on a phone, with no keyboard notice', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedLearner(page)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-level')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Потрібна фізична клавіатура' })).toBeHidden()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(390)
  })

  test('has no accessibility violations, light and dark', async ({ page }) => {
    await seedLearner(page)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-attempt').first()).toBeVisible()
    await expectNoAxeViolations(page)

    await page.goto('/settings')
    await page
      .getByRole('group', { name: 'Тема', exact: true })
      .getByRole('radio', { name: 'Темна' })
      .check()
    await page.goto('/profile')
    await expect(page.getByTestId('profile-attempt').first()).toBeVisible()
    await expectNoAxeViolations(page)
  })
})

test.describe('the reference pages', () => {
  test('each names the «Про гру» pages, marks the current one, and moves between them', async ({
    page: visitor,
  }) => {
    await seedVisitor(visitor)
    await visitor.goto('/privacy')
    const menu = visitor.locator('#main').getByRole('navigation', { name: 'Про гру' })
    await expect(menu.getByRole('link', { name: 'Приватність' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(menu.getByRole('link', { name: 'Про Typing-Race' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await menu.getByRole('link', { name: 'Про проєкт' }).click()
    await expect(visitor.getByRole('heading', { level: 1, name: 'Про проєкт' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Про проєкт' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(menu.getByRole('link', { name: 'Про Typing-Race' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await menu.getByRole('link', { name: 'Формули' }).click()
    await expect(visitor.getByRole('heading', { level: 1, name: 'Формули' })).toBeVisible()
  })

  test('privacy says what reaches the server and what never does', async ({ page: visitor }) => {
    await seedVisitor(visitor)
    await visitor.goto('/privacy')
    await expect(visitor.getByRole('heading', { name: 'Тренування' })).toBeVisible()
    await expect(visitor.getByRole('heading', { name: 'Перегони, групи й рейтинги' })).toBeVisible()
  })

  test('About the project has no accessibility violations', async ({ page: visitor }) => {
    await seedVisitor(visitor)
    await visitor.goto('/about/project')
    await expect(visitor.getByRole('heading', { level: 1, name: 'Про проєкт' })).toBeVisible()
    await expectNoAxeViolations(visitor)
  })
})

test.describe('@backend Community', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('the head bar switches between groups and leaderboards; the board opens on this week without a group', async ({
    page: visitor,
  }) => {
    await seedVisitor(visitor)
    await visitor.addInitScript(() => localStorage.setItem('typing-race:test-account', '1'))
    await visitor.goto('/groups')
    const tabs = visitor.getByRole('navigation', { name: 'Розділи спільноти' })
    await expect(tabs.getByRole('link', { name: 'Групи' })).toHaveAttribute('aria-current', 'page')
    await tabs.getByRole('link', { name: 'Рейтинги' }).click()
    await expect(visitor).toHaveURL(/\/leaderboards/)
    await expect(visitor.getByRole('button', { name: 'Цей тиждень' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 15_000 },
    )
    await expect(visitor.getByTestId('leaderboard-me')).toBeVisible()
    await expectNoAxeViolations(visitor)
  })
})

test('Community, unavailable, has no accessibility violations', async ({ page: visitor }) => {
  await seedVisitor(visitor)
  await visitor.route('**/auth/v1/**', (route) => route.abort())
  await visitor.goto('/groups')
  await expect(visitor.getByTestId('community-unavailable')).toBeVisible({ timeout: 20_000 })
  await expectNoAxeViolations(visitor)
})
