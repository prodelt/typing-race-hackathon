import type { Page } from '@playwright/test'
import { readEnvelope } from './harness/firstRun.js'
import { expect, test as fixtureTest, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

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
    await expect(fresh.getByTestId('first-run')).toBeVisible()
    await expect(
      fresh.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' }),
    ).toBeVisible()
    await expect(rail(fresh)).toBeVisible()
    await fresh.close()
  })

  test('keys 1–5 switch destinations, but not from inside a field', async ({ page }) => {
    await seedStore(page, LEARNER)
    await page.goto('/')
    await expect(page.getByTestId('home-continue')).toBeVisible()

    const steps = [
      ['2', /\/map$/, 'Мапа'],
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
    await expect(page).toHaveURL(/\/map$/)
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

/** The first run's own text for the check, mirrored from `features/firstrun/model.ts`. */
const CHECK_TEXT = {
  uk: 'сонце світить над полем і річка тихо біжить',
  en: 'the quick brown fox jumps over the lazy dog',
} as const

function step(page: Page) {
  return page.getByRole('list', { name: 'Кроки першого запуску' }).locator('[aria-current="step"]')
}

test.describe('first run', () => {
  for (const [language, key, layout] of [
    ['uk', '1', 'yq'],
    ['en', '2', 'qwerty'],
  ] as const) {
    test(`a fresh profile walks it with the keyboard and lands on the first ${language} exercise in Play Mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')

      // 1 — the typing language. No sign-up, no form: the first visit is the first run.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' }),
      ).toBeVisible()
      await expect(step(page)).toContainText('Мова')
      await page.locator('body').press(key)
      await expect(
        page.getByRole('radio', { name: language === 'uk' ? /Українська/ : /English/ }),
      ).toBeChecked()
      // A digit picks; it does not switch destinations.
      await expect(page).toHaveURL(/\/$/)
      await page.keyboard.press('Enter')

      // 2 — the level. Enter waits for an answer.
      await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
      await expect(step(page)).toContainText('Рівень')
      await expect(page.getByTestId('first-run-next')).toBeDisabled()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
      // Esc goes back and the language is kept.
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' }),
      ).toBeVisible()
      await expect(
        page.getByRole('radio', { name: language === 'uk' ? /Українська/ : /English/ }),
      ).toBeChecked()
      await page.keyboard.press('Enter')
      await page.keyboard.press('1')
      await expect(page.getByRole('radio', { name: /Ще не друкую наосліп/ })).toBeChecked()
      await page.keyboard.press('Enter')

      // 3 — the finger scheme, on the chosen layout, answering a pressed key with its finger.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Кожна клавіша — своєму пальцю' }),
      ).toBeVisible()
      await expect(step(page)).toContainText('Пальці')
      const scheme = page.getByTestId('finger-scheme')
      await expect(scheme.locator('[data-code="KeyF"]')).toHaveText(language === 'uk' ? 'а' : 'f')
      await page.keyboard.press('KeyF')
      await expect(page.getByTestId('finger-said')).toContainText('лівий вказівний палець')
      await expect(scheme.locator('[data-code="KeyF"]')).toHaveAttribute('data-on', 'true')
      await page.keyboard.press('Digit3')
      await expect(page).toHaveURL(/\/$/)
      await page.keyboard.press('Enter')

      // The first exercise, in the chosen language, running: Play Mode has taken the frame.
      await expect(page).toHaveURL(new RegExp(`/exercise/${layout}\\.`))
      await expect(page.getByTestId('typing-line')).toBeVisible()
      await expect(rail(page)).toBeHidden()
      await expect(statusBar(page)).toBeHidden()

      // The answers were kept: back on Home, the hub — not the first run — in that language.
      await page.goto('/')
      await expect(page.getByTestId('home-continue')).toBeVisible()
      await expect(page.getByTestId('first-run')).toHaveCount(0)
    })
  }

  test('the check is optional: Esc skips it, and finishing it suggests a level', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' }),
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()

    // Skipped: back on the level step with nothing chosen for the learner.
    await page.keyboard.press('4')
    await expect(page.getByRole('heading', { level: 1, name: 'Надрукуй рядок' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)

    // Taken: the line typed on the real input path, a suggestion picked, the choice still open.
    await page.getByRole('button', { name: /Не знаю — перевірити себе/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Надрукуй рядок' })).toBeVisible()
    await typeText(page, CHECK_TEXT.uk)
    await expect(page.getByRole('heading', { level: 1, name: 'З чого почнемо?' })).toBeVisible()
    await expect(page.getByTestId('first-run-advice')).toContainText('Радимо')
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    await expect(page.getByTestId('first-run-next')).toBeEnabled()
  })

  test('Settings starts it over: nothing is deleted and no lower level is offered', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const completedAt = Date.now() - 3_600_000
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      startingLevelByLanguage: { uk: 'knowsHomeRow' },
      attempts: [
        {
          id: 'r1',
          scaleId: 'yq.run.anchors',
          layoutId: 'yq',
          language: 'uk',
          mode: 'practice',
          seed: 1,
          startedAt: completedAt - 15_000,
          completedAt,
          elapsedMs: 15_000,
          metrics: {
            spm: 200,
            wpm: 40,
            accuracy: 0.97,
            errorCount: 1,
            errorsByChar: { а: 1 },
            rhythmConsistency: { value: 80, breaksExcluded: 0 },
            meanIkiByKey: { а: 210 },
            meanIkiByTransition: { 'ф>і': 300 },
          },
          aggregates: { keys: {}, transitions: {} },
        },
      ],
    } as Parameters<typeof seedStore>[1])

    await page.goto('/settings')
    await page.getByRole('link', { name: 'Почати спочатку' }).click()
    await expect(page).toHaveURL(/\/start$/)
    await expect(page.getByText('Почати спочатку · історія залишається')).toBeVisible()

    // On the first step Esc is "cancel": back to Settings, nothing changed.
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/settings$/)

    await page.getByRole('link', { name: 'Почати спочатку' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Якою мовою друкуємо?' }),
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('radio', { name: /Знаю домашній ряд/ })).toBeChecked()
    await expect(page.getByRole('radio', { name: /Ще не друкую наосліп/ })).toBeDisabled()
    await page.keyboard.press('3')
    await expect(page.getByRole('radio', { name: /Друкую наосліп, хочу точності/ })).toBeChecked()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/exercise\/yq\./)

    const stored = await readEnvelope(page)
    expect({
      attempts: stored.attempts.length,
      level: stored.startingLevelByLanguage['uk'],
    }).toEqual({ attempts: 1, level: 'touchTypesWantsAccuracy' })
  })
})
