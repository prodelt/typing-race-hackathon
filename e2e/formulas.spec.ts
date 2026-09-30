import type { Page } from '@playwright/test'
import { expect, expectNoAxeViolations, test } from './harness/fixtures.js'

/**
 * T117. User Story 4, "The public Formulas page".
 *
 * Independent Test: open the Formulas route with no stored progress and confirm every formula the
 * product uses is stated there, including the row-change divergence.
 *
 * These tests use the bare `page` and seed nothing: no envelope, no settings, no attempts. That is
 * the scenario. A juror opening this page has no learner state, and a spec that seeded one first
 * would be proving the page works for somebody else.
 */

function section(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true })
}

/**
 * The audit, after the page has stopped moving. "Motion off" leaves transitions of a hundredth of a
 * millisecond behind rather than none, so the frame after a theme change can still hold the old
 * colours, and axe samples colours. Waiting for them to land makes the audit about the screen and
 * not about a frame.
 */
async function audit(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished.then(() => undefined)),
    ),
  )
  await expectNoAxeViolations(page)
}

test.describe('US4 the public Formulas page', () => {
  test('it renders fully with no stored progress at all (scenario 1)', async ({ page }) => {
    await page.goto('/formulas')

    await expect(page.getByRole('heading', { level: 1, name: 'Формули' })).toBeVisible()
    // No learner gate in front of it: neither the starting-level question nor the boot notices.
    await expect(page.getByRole('heading', { name: 'З чого почнемо?' })).toHaveCount(0)
    await expect(page.getByText('Завантаження…')).toHaveCount(0)
    await expect(page).toHaveURL(/\/formulas$/)

    // All four sections are there, and each is reachable from the table of contents.
    for (const title of [
      'Швидкість і точність',
      'Складність переходу: зміна рядка',
      'Просування',
      'Ритм і впевненість',
    ]) {
      await expect(section(page, title)).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: 'Розділи сторінки' })
          .getByRole('link', { name: title }),
      ).toBeVisible()
    }
  })

  test('the other public pages open with no stored progress too', async ({ page }) => {
    // The product page, formulas, licences, privacy and about are the only screens a visitor
    // without a learner may reach (DECISIONS.md, product rules).
    for (const [path, heading] of [
      ['/', 'Навчися друкувати, не дивлячись на клавіатуру'],
      ['/licences', 'Ліцензії'],
      ['/privacy', 'Приватність'],
      ['/about', 'Про проєкт'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })

  test('speed is a stated formula, WPM is SPM / 5 and labelled the secondary metric (scenario 2)', async ({
    page,
  }) => {
    await page.goto('/formulas')
    const speed = section(page, 'Швидкість і точність')

    await expect(speed).toContainText('SPM = characterKeystrokes × 60 000 ÷ elapsedMs')
    await expect(speed).toContainText('WPM = SPM / 5')

    // The label sits on the WPM heading itself, so it cannot be read as belonging to SPM.
    const wpm = speed.getByRole('heading', { name: /WPM — слів за хвилину/ })
    await expect(wpm).toContainText('друга метрика')
    const spm = speed.getByRole('heading', { name: /SPM — знаків за хвилину/ })
    await expect(spm).not.toContainText('друга метрика')
  })

  test('accuracy is correct over all character keystrokes, and a corrected error still counts (scenario 3)', async ({
    page,
  }) => {
    await page.goto('/formulas')
    const speed = section(page, 'Швидкість і точність')

    await expect(speed).toContainText('accuracy = correctCharKeystrokes ÷ allCharKeystrokes')
    // Requirement §8.2, stated where the reader looks for accuracy.
    await expect(speed).toContainText(
      'Хибне натискання завжди рахується помилкою, навіть якщо його виправлено клавішею Backspace',
    )
    await expect(speed).toContainText(
      'Backspace не є символьним натисканням, тому не потрапляє ні в чисельник, ні в знаменник',
    )
    await expect(speed).toContainText('errorCount = allCharKeystrokes − correctCharKeystrokes')
  })

  test('both readings of the row-change measure are given, with the one we count and why (scenario 4)', async ({
    page,
  }) => {
    await page.goto('/formulas')
    const difficulty = section(page, 'Складність переходу: зміна рядка')

    // Reading 1: adjacent row-changing pairs. Reading 2: distinct rows touched.
    await expect(
      difficulty.getByRole('heading', { name: 'Читання 1. Сусідні пари зі зміною рядка' }),
    ).toBeVisible()
    await expect(difficulty).toContainText(
      'rowChanges = #{ i : row(letter[i]) ≠ row(letter[i+1]) }',
    )
    await expect(
      difficulty.getByRole('heading', { name: 'Читання 2. Різні рядки, яких торкається слово' }),
    ).toBeVisible()
    await expect(difficulty).toContainText('rowsTouched = | { row(letter[i]) } |')

    // The worked example shows the two readings disagreeing: 5 against 3.
    await expect(difficulty).toContainText('Читання 1 дає 5')
    await expect(difficulty).toContainText('Читання 2 дає 3')

    // Which one is counted, and why.
    const counted = difficulty.getByRole('heading', { name: 'Яке читання рахуємо ми' })
    await expect(counted).toBeVisible()
    await expect(difficulty).toContainText('Ми рахуємо сусідні пари зі зміною рядка (читання 1)')
    await expect(difficulty).toContainText('Причина проста')
    // And the divergence from the requirements' own example is admitted, not buried.
    await expect(difficulty).toContainText('rowChanges = 3')
    await expect(difficulty).toContainText('повідомляємо про це відкрито')
  })

  test('the level table, the Mastery Rule, Stage 1 completion and "speed never gates" are stated (scenario 5)', async ({
    page,
  }) => {
    await page.goto('/formulas')
    const progression = section(page, 'Просування')

    const table = progression.getByRole('table', {
      name: 'Рівні, їхні швидкісні орієнтири та планки точності',
    })
    // The published accuracy floors: 95 / 96 / 97 / 97 / 98 %.
    for (const [level, floor] of [
      ['Вступ', '95 %'],
      ['Базовий', '96 %'],
      ['Середній', '97 %'],
      ['Просунутий', '97 %'],
      ['Експерт', '98 %'],
    ] as const) {
      const row = table
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: level }) })
      await expect(row, `${level} row`).toContainText(floor)
    }
    // Introduction sets no speed requirement, and is the only band in force.
    const intro = table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Вступ' }) })
    await expect(intro).toContainText('без вимог')
    await expect(intro).toContainText('діє для всього Етапу 1')

    await expect(progression).toContainText('last 3 test attempts all have accuracy ≥ floor')
    await expect(progression).toContainText('Тренувальна спроба ніколи не зараховується')
    await expect(progression).toContainText('every scale complete')
    await expect(progression).toContainText('mean(accuracy of last 5 attempts) ≥ 0.96')
    await expect(
      progression.getByRole('heading', { name: 'Швидкість нічого не блокує' }),
    ).toBeVisible()
    await expect(progression).toContainText('Швидкість ніколи не блокує просування')
  })

  test('interval, rhythm consistency and Confidence are each defined (scenario 6)', async ({
    page,
  }) => {
    await page.goto('/formulas')
    const rhythm = section(page, 'Ритм і впевненість')

    await expect(
      rhythm.getByRole('heading', { name: 'Інтервал між натисканнями', exact: true }),
    ).toBeVisible()
    await expect(rhythm).toContainText('iki[i] = t[i] − t[i−1]')
    await expect(
      rhythm.getByRole('heading', { name: 'Рівномірність ритму', exact: true }),
    ).toBeVisible()
    await expect(rhythm).toContainText('cv')
    await expect(rhythm).toContainText('stdev(iki) / mean(iki)')
    await expect(rhythm.getByRole('heading', { name: 'Впевненість', exact: true })).toBeVisible()
    await expect(rhythm).toContainText('accuracyFactor = wHits / n')
    // Confidence selects what to practise; it gates nothing.
    await expect(rhythm).toContainText('Впевненість нічого не блокує.')
  })

  test('the Formulas page has no accessibility violations (T117)', async ({ page }) => {
    await page.goto('/formulas')
    await expect(page.getByRole('heading', { level: 1, name: 'Формули' })).toBeVisible()
    await audit(page)
  })
})
