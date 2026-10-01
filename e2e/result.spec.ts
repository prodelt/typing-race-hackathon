import type { Page } from '@playwright/test'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import { pressBackspace, typeChar, typeText } from './harness/type.js'

/**
 * T093, T094, T095, T096. User Story 2, "The result of an attempt and one next action".
 *
 * Independent Test: finish one attempt from a seeded progress store and read the result screen;
 * every metric in the requirements is present, exactly one Next Action is shown, and with a store
 * seeded at the mastery threshold the Key Unlock card appears.
 *
 * Most scenarios are read from a *seeded* store, because a result screen is a pure rendering of
 * stored attempts and a seed reaches each rule of the coach directly. The two scenarios that are
 * about what typing produces (2 and 8) type for real.
 */

/**
 * The harness drives `getByTestId('typing-input')`, which the exercise screen does not carry; see
 * the note in exercise.spec.ts. Given from outside, so the driver works.
 */
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

interface SeedAttempt {
  readonly id: string
  readonly scaleId: string
  readonly mode: 'practice' | 'test'
  readonly accuracy: number
  readonly spm?: number
  readonly rhythm?: number
  readonly elapsedMs?: number
  readonly errorCount?: number
  readonly errorsByChar?: Record<string, number>
  readonly meanIkiByKey?: Record<string, number>
  readonly meanIkiByTransition?: Record<string, number>
  readonly transitions?: Record<
    string,
    { count: number; misses: number; sumIki: number; sumIkiSq: number }
  >
}

/** A stored attempt summary, in the shape `StoredEnvelope.attempts` holds. */
function summary(attempt: SeedAttempt, index: number) {
  const spm = attempt.spm ?? 240
  const elapsedMs = attempt.elapsedMs ?? 15_000
  const completedAt = Date.now() - 3_600_000 + index * 60_000
  return {
    id: attempt.id,
    scaleId: attempt.scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode: attempt.mode,
    seed: 1,
    startedAt: completedAt - elapsedMs,
    completedAt,
    elapsedMs,
    metrics: {
      spm,
      wpm: spm / 5,
      accuracy: attempt.accuracy,
      errorCount: attempt.errorCount ?? 0,
      errorsByChar: attempt.errorsByChar ?? {},
      rhythmConsistency: { value: attempt.rhythm ?? 90, breaksExcluded: 0 },
      meanIkiByKey: attempt.meanIkiByKey ?? {},
      meanIkiByTransition: attempt.meanIkiByTransition ?? {},
    },
    aggregates: { keys: {}, transitions: attempt.transitions ?? {} },
  }
}

async function seedLearner(page: Page, attempts: readonly SeedAttempt[]): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const envelope = {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: attempts.map(summary),
  }
  await seedStore(page, envelope)
}

const ANCHORS = 'yq.run.anchors'
const FIRST_KEY = 'yq.run.KeyG'

function region(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true })
}

/** Scenario 7 in one place: one Next Action, one button, and nothing else offered. */
async function expectSingleNextAction(page: Page): Promise<void> {
  const next = region(page, 'Що робити далі')
  await expect(next).toBeVisible()
  await expect(page.locator('[data-rule]')).toHaveCount(1)
  await expect(next.getByRole('button')).toHaveCount(1)
  await expect(next.getByRole('button', { name: 'Почати' })).toBeVisible()
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
      document
        .getAnimations()
        // A deliberately endless animation (the live gradient, a caret) never finishes.
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY &&
            // Nor does one inside unrendered content (a closed <details>): it never runs.
            ((animation.effect as KeyframeEffect | null)?.target?.checkVisibility() ?? true),
        )
        .map((animation) =>
          animation.finished.then(
            () => undefined,
            () => undefined,
          ),
        ),
    ),
  )
  await expectNoAxeViolations(page)
}

test.describe('US2 the result of an attempt', () => {
  test('every metric of the requirements is on the screen (scenario 1)', async ({ page }) => {
    await seedLearner(page, [
      {
        id: 'a1',
        scaleId: ANCHORS,
        mode: 'test',
        accuracy: 58 / 60,
        spm: 240,
        elapsedMs: 15_000,
        errorCount: 2,
        rhythm: 84,
        errorsByChar: { а: 1, о: 1 },
        meanIkiByKey: { а: 210, о: 380 },
        meanIkiByTransition: { 'а>о': 430, 'о>а': 250 },
      },
    ])
    await page.goto('/result/a1')

    await expect(page.getByRole('heading', { name: 'Результат спроби' })).toBeVisible()

    // The four headline tiles: SPM (CPM), accuracy, errors, time.
    const tiles = region(page, 'Головні показники')
    await expect(tiles).toContainText(/SPM\s*240/)
    await expect(tiles).toContainText(/Точність\s*96[.,]7\s*%/)
    await expect(tiles).toContainText(/Помилки\s*2/)
    await expect(tiles).toContainText(/Час\s*0:15[.,]0/)

    // The full record: WPM as the secondary metric, and rhythm consistency.
    const all = region(page, 'Усі показники')
    await expect(all).toContainText(/WPM\s*SPM \/ 5, другорядний показник\s*48[.,]0/)
    await expect(all).toContainText(/Рівність ритму.*ідеально рівний ритм\s*84[.,]0/)
    await expect(page.getByTestId('breaks-excluded')).toContainText('Пауз понад 3 с не було')

    // Errors by character, each with its share (FR-025).
    const errors = region(page, 'Помилки за символами')
    await expect(errors).toContainText('а')
    await expect(errors).toContainText('о')
    await expect(errors.getByText('1 раз, 50% усіх помилок')).toHaveCount(2)

    // The average delay per key and per Transition (FR-026).
    const keys = all.getByRole('table', { name: 'Середня затримка перед клавішею' })
    await expect(keys.getByRole('row', { name: /а\s*210 мс/ })).toBeVisible()
    await expect(keys.getByRole('row', { name: /о\s*380 мс/ })).toBeVisible()
    const transitions = all.getByRole('table', { name: 'Середня затримка на перехід' })
    await expect(transitions.getByRole('row', { name: /а → о\s*430 мс/ })).toBeVisible()
    await expect(transitions.getByRole('row', { name: /о → а\s*250 мс/ })).toBeVisible()

    await expect(region(page, 'Ритм')).toBeVisible()
  })

  test('a corrected wrong keystroke stays in the error total and in the accuracy denominator (scenario 2, §8.2)', async ({
    page,
  }) => {
    await seedLearner(page, [])
    await page.goto(`/exercise/${ANCHORS}?mode=practice`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()

    const text = [
      ...((await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''),
    ]
    const wrongAt = 4
    // The wrong key, then Backspace, then the right key: the requirement in its plainest form.
    await typeText(page, text.slice(0, wrongAt).join(''))
    await typeChar(page, 'ъ')
    await pressBackspace(page)
    await typeText(page, text.slice(wrongAt).join(''))
    await expect(page).toHaveURL(/\/result\//)

    // n right keystrokes and one wrong one; Backspace is in neither count.
    const expected = ((text.length / (text.length + 1)) * 100).toFixed(1).replace('.', '[.,]')
    const tiles = region(page, 'Головні показники')
    await expect(tiles).toContainText(new RegExp(`Точність\\s*${expected}\\s*%`))
    await expect(tiles).toContainText(/Помилки\s*1/)

    // The error is booked against the character that was awaited, not the one that was typed.
    const errors = region(page, 'Помилки за символами')
    await expect(errors).toContainText(text[wrongAt] ?? '')
    await expect(errors.getByText('1 раз, 100% усіх помилок')).toBeVisible()
    await expect(region(page, 'Усі показники')).toContainText('Backspace у знаменнику не рахується')
  })

  test('the previous personal result on the same exercise and the difference are named (scenario 3)', async ({
    page,
  }) => {
    await seedLearner(page, [
      { id: 'early', scaleId: ANCHORS, mode: 'test', accuracy: 0.97, spm: 200 },
      { id: 'other', scaleId: 'yq.mirror.anchors', mode: 'test', accuracy: 0.99, spm: 400 },
      { id: 'late', scaleId: ANCHORS, mode: 'test', accuracy: 0.98, spm: 220 },
    ])

    await page.goto('/result/late')
    const comparison = region(page, 'Порівняння з попереднім')
    // The other exercise's better result is not the comparison: it is a different exercise.
    await expect(comparison).toContainText(/200[.,]0 SPM, точність 97[.,]0%/)
    await expect(comparison).toContainText(/\+20[.,]0 SPM/)
    await expect(comparison).toContainText(/\+1[.,]0 в\. п\./)

    // The first result on an exercise says so instead of showing a zero that reads as "no change".
    await page.goto('/result/early')
    await expect(region(page, 'Порівняння з попереднім')).toContainText('перший результат')
  })

  test('below the accuracy floor the one Next Action lowers the tempo to a named speed (scenario 4)', async ({
    page,
  }) => {
    await seedLearner(page, [
      { id: 'low', scaleId: ANCHORS, mode: 'test', accuracy: 0.9, spm: 240, errorCount: 6 },
    ])
    await page.goto('/result/low')

    await expectSingleNextAction(page)
    await expect(page.locator('[data-rule]')).toHaveAttribute('data-rule', 'lowerTempo')
    // 80% of the speed just typed, to the nearest 5.
    await expect(page.locator('[data-rule]')).toContainText(/нижче за поріг 95%/)
    await expect(page.locator('[data-rule]')).toContainText('до 190 SPM')
    // No second recommendation is smuggled in beside it.
    const next = region(page, 'Що робити далі')
    await expect(next).not.toContainText('Перехід')
    await expect(next).not.toContainText('ритм нерівний')
    await expect(next).not.toContainText('Наступна клавіша')
  })

  test('above the floor, the weakest sampled Transition is named with its two fingers (scenario 5)', async ({
    page,
  }) => {
    // Twelve observations of ф→в, eight of them missed: well past the five-sample minimum
    // (FR-035) and far below the confidence ceiling. Accuracy and rhythm are fine, so rules 1
    // and 3 cannot fire and this is rule 2's turn.
    await seedLearner(page, [
      {
        id: 'weak',
        scaleId: ANCHORS,
        mode: 'test',
        accuracy: 0.98,
        rhythm: 90,
        transitions: { 'ф>в': { count: 12, misses: 8, sumIki: 5400, sumIkiSq: 2_430_000 } },
      },
    ])
    await page.goto('/result/weak')

    await expectSingleNextAction(page)
    await expect(page.locator('[data-rule]')).toHaveAttribute('data-rule', 'weakTransition')
    await expect(page.locator('[data-rule]')).toContainText('Перехід ф → в найслабший')
    // ф is the left pinky and в the left middle finger on ЙЦУКЕН.
    await expect(page.locator('[data-rule]')).toContainText(
      'Його друкують пальці: мізинець і середній палець',
    )
  })

  test('with uneven rhythm and no weak Transition the one Next Action asks for even tempo (scenario 6, rule 3)', async ({
    page,
  }) => {
    await seedLearner(page, [
      { id: 'uneven', scaleId: ANCHORS, mode: 'test', accuracy: 0.98, rhythm: 55 },
    ])
    await page.goto('/result/uneven')

    await expectSingleNextAction(page)
    await expect(page.locator('[data-rule]')).toHaveAttribute('data-rule', 'evenRhythm')
    await expect(page.locator('[data-rule]')).toContainText(/ритм нерівний \(55%\)/)
  })

  test('with even rhythm and nothing weak the one Next Action offers the next key, and its button starts it (scenarios 6 and 7)', async ({
    page,
  }) => {
    await seedLearner(page, [
      { id: 'clean', scaleId: ANCHORS, mode: 'test', accuracy: 0.98, rhythm: 92 },
    ])
    await page.goto('/result/clean')

    await expectSingleNextAction(page)
    await expect(page.locator('[data-rule]')).toHaveAttribute('data-rule', 'nextKey')
    // The first key of the Unlock Order on ЙЦУКЕН is п, typed by the left index finger.
    await expect(page.locator('[data-rule]')).toContainText(
      'Наступна клавіша: п (вказівний палець)',
    )

    await region(page, 'Що робити далі').getByRole('button', { name: 'Почати' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/exercise/${FIRST_KEY.replace('.', '\\.')}\\?mode=practice`),
    )
    await expect(page.getByRole('heading', { name: /Гама: клавіша п/ })).toBeVisible()
  })

  test('the third passing Test Attempt shows the Key Unlock card, and the second does not (scenario 8)', async ({
    page,
  }) => {
    const pass = { scaleId: FIRST_KEY, mode: 'test', accuracy: 0.98 } as const
    await seedLearner(page, [
      { id: 'p1', ...pass },
      { id: 'p2', ...pass },
    ])

    await page.goto(`/exercise/${FIRST_KEY}?mode=test`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeText(page, text)
    await expect(page).toHaveURL(/\/result\//)

    // Two seeded passes plus this one: the Mastery Rule is met on the exercise for п.
    const unlock = region(page, 'Нова клавіша відкрита')
    await expect(unlock).toBeVisible()
    await expect(unlock).toContainText('Клавіша п')
    await expect(unlock).toContainText('Її друкує вказівний палець.')
    await expect(unlock).toContainText('Три залікові спроби поспіль')
    const drill = unlock.getByRole('button', { name: 'До першого завдання' })
    await expect(drill).toBeVisible()

    await drill.click()
    await expect(page).toHaveURL(/\/exercise\/.+\?mode=practice/)
  })

  test('two passes are not enough: the second Test Attempt has no Key Unlock card (scenario 8, the converse)', async ({
    page,
  }) => {
    await seedLearner(page, [{ id: 'p1', scaleId: FIRST_KEY, mode: 'test', accuracy: 0.98 }])

    await page.goto(`/exercise/${FIRST_KEY}?mode=test`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeText(page, text)
    await expect(page).toHaveURL(/\/result\//)

    await expect(page.getByRole('heading', { name: 'Що робити далі' })).toBeVisible()
    await expect(region(page, 'Нова клавіша відкрита')).toHaveCount(0)
  })

  test('a Practice Attempt never shows a Key Unlock card (scenarios 8 and FR-039)', async ({
    page,
  }) => {
    await seedLearner(page, [
      { id: 'p1', scaleId: FIRST_KEY, mode: 'test', accuracy: 0.98 },
      { id: 'p2', scaleId: FIRST_KEY, mode: 'test', accuracy: 0.98 },
      { id: 'practice', scaleId: FIRST_KEY, mode: 'practice', accuracy: 1 },
    ])
    await page.goto('/result/practice')
    await expect(region(page, 'Нова клавіша відкрита')).toHaveCount(0)
  })

  test('intervals over 400 ms are drawn in the error colour and marked without colour (scenario 9)', async ({
    page,
  }) => {
    await seedLearner(page, [
      {
        id: 'slow',
        scaleId: ANCHORS,
        mode: 'test',
        accuracy: 0.98,
        meanIkiByTransition: { 'ф>і': 520, 'і>в': 450, 'в>а': 210, 'а>о': 180 },
      },
    ])
    await page.goto('/result/slow')

    const chart = region(page, 'Ритм')
    const image = chart.getByRole('img')

    // The chart is described in words, and the description carries the count (FR-066).
    await expect(image).toHaveAccessibleName(/Повільніших за 400 мс переходів: 2 із 4\./)
    await expect(page.getByTestId('chart-summary')).toHaveText(
      'Повільніших за 400 мс переходів: 2 із 4.',
    )

    // The plotted bars only: the hatch pattern in <defs> is a rect too, and is not a bar.
    const slow = chart.locator('svg rect.result-bar[stroke="var(--color-terracotta)"]')
    const calm = chart.locator('svg rect.result-bar[stroke="none"]')
    // 2 slow bars: error colour outline *and* hatched fill; the other 2 carry neither.
    await expect(slow).toHaveCount(2)
    await expect(slow.first()).toHaveAttribute('fill', /^url\(#/)
    await expect(calm).toHaveCount(2)
    await expect(calm.first()).toHaveAttribute('fill', 'var(--color-sage)')

    // A triangle marker sits on each slow bar: a shape, so the cue survives without colour.
    await expect(chart.locator('svg path[fill="var(--color-terracotta)"]')).toHaveCount(2)
    // And the legend says it in words.
    await expect(chart).toContainText('понад 400 мс')
  })

  test('with no interval over 400 ms nothing is drawn as slow (scenario 9, the converse)', async ({
    page,
  }) => {
    await seedLearner(page, [
      {
        id: 'fast',
        scaleId: ANCHORS,
        mode: 'test',
        accuracy: 0.98,
        meanIkiByTransition: { 'ф>і': 310, 'і>в': 250 },
      },
    ])
    await page.goto('/result/fast')

    const chart = region(page, 'Ритм')
    await expect(page.getByTestId('chart-summary')).toHaveText(
      'Жоден перехід не повільніший за 400 мс.',
    )
    await expect(chart.locator('svg rect[stroke="var(--color-terracotta)"]')).toHaveCount(0)
  })

  test('a result screen has no accessibility violations, with and without slow intervals (T096)', async ({
    page,
  }) => {
    await seedLearner(page, [
      {
        id: 'slow',
        scaleId: ANCHORS,
        mode: 'test',
        accuracy: 0.98,
        errorCount: 2,
        errorsByChar: { а: 1, о: 1 },
        meanIkiByKey: { а: 210, о: 380 },
        meanIkiByTransition: { 'ф>і': 520, 'і>в': 450, 'в>а': 210 },
      },
      { id: 'fast', scaleId: 'yq.mirror.anchors', mode: 'test', accuracy: 0.98 },
    ])

    await page.goto('/result/slow')
    await expect(region(page, 'Ритм')).toBeVisible()
    await audit(page)

    await page.goto('/result/fast')
    await expect(region(page, 'Ритм')).toBeVisible()
    await audit(page)
  })
})
