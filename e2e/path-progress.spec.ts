import type { Browser, BrowserContext, Page } from '@playwright/test'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import { typeChar, typeText } from './harness/type.js'

/**
 * T106, T107, T108, T109, T110. User Story 3, "The path, mastery and progress that survives a
 * restart".
 *
 * Independent Test: from an empty store, choose a starting level, complete three consecutive
 * passing Test Attempts on the scale focused on the next locked key, watch the key unlock and the
 * Path update, then restart the browser with the network away and confirm the unlocked set, the
 * attempt history and the Next Action are unchanged and still usable.
 *
 * Two kinds of setup, used on purpose. A *seeded* store reaches a state directly (two passes already
 * recorded) and is right wherever the scenario is about what the next attempt does. A store built
 * by *typing* is used wherever the scenario is about persistence, because a seed written by an init
 * script is rewritten on every load and so could never prove that anything survived.
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

const ANCHORS = 'yq.run.anchors'
/** The scale focused on п, the first key of the Unlock Order on ЙЦУКЕН. */
const FIRST_KEY = 'yq.run.KeyG'

/**
 * Every Stage 1 scale of the ЙЦУКЕН catalogue. Written out rather than imported because this suite
 * treats the application as a black box; if the catalogue changes this list is the one place to
 * follow it, and the Stage 1 completion test names the cost plainly by failing.
 */
const YQ_SCALES = [
  'yq.run.anchors',
  'yq.mirror.anchors',
  'yq.alternate.anchors',
  'yq.fingerIsolation.anchors',
  'yq.tempo.anchors',
  'yq.run.KeyG',
  'yq.run.KeyH',
  'yq.run.Quote',
  'yq.vertical.KeyR',
  'yq.vertical.KeyT',
  'yq.vertical.KeyY',
  'yq.vertical.KeyU',
  'yq.vertical.KeyE',
  'yq.vertical.KeyI',
  'yq.vertical.KeyW',
  'yq.vertical.KeyO',
  'yq.vertical.KeyQ',
  'yq.vertical.KeyP',
  'yq.vertical.BracketLeft',
  'yq.vertical.BracketRight',
  'yq.fingerSpan.right-pinky',
  'yq.vertical.KeyV',
  'yq.vertical.KeyB',
  'yq.fingerSpan.left-index',
  'yq.vertical.KeyN',
  'yq.vertical.KeyM',
  'yq.fingerSpan.right-index',
  'yq.vertical.KeyC',
  'yq.fingerSpan.left-middle',
  'yq.vertical.Comma',
  'yq.fingerSpan.right-middle',
  'yq.vertical.KeyX',
  'yq.fingerSpan.left-ring',
  'yq.vertical.Period',
  'yq.fingerSpan.right-ring',
  'yq.vertical.KeyZ',
  'yq.fingerSpan.left-pinky',
  'yq.modifiers.shift',
  'yq.modifiers.Digit1',
  'yq.modifiers.Digit2',
  'yq.modifiers.Digit3',
  'yq.modifiers.Digit4',
  'yq.modifiers.Digit5',
  'yq.modifiers.Digit6',
  'yq.modifiers.Digit7',
  'yq.modifiers.Digit8',
  'yq.modifiers.Digit9',
  'yq.modifiers.Digit0',
  'yq.modifiers.Slash',
  'yq.modifiers.Slash+shift',
  'yq.modifiers.Digit4+shift',
  'yq.modifiers.Digit6+shift',
  'yq.modifiers.Minus',
  'yq.modifiers.Backquote',
  'yq.modifiers.Digit2+shift',
  'yq.modifiers.Backslash',
] as const

interface SeedAttempt {
  readonly scaleId: string
  readonly mode: 'practice' | 'test'
  readonly accuracy: number
  readonly spm?: number
}

let counter = 0

/** A stored attempt summary, in the shape `StoredEnvelope.attempts` holds. */
function summary(attempt: SeedAttempt, index: number, total: number) {
  const spm = attempt.spm ?? 240
  const elapsedMs = 15_000
  // Oldest first, ending a minute ago, so "the last five" is the last five seeded.
  const completedAt = Date.now() - (total - index) * 60_000
  counter += 1
  return {
    id: `seed-${counter}`,
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
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
  }
}

async function seedLearner(page: Page, attempts: readonly SeedAttempt[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const envelope = {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: attempts.map((attempt, index) => summary(attempt, index, attempts.length)),
  }
  await seedStore(page, envelope)
}

function passes(scaleId: string, count: number, mode: 'test' | 'practice' = 'test') {
  return Array.from({ length: count }, (): SeedAttempt => ({ scaleId, mode, accuracy: 0.98 }))
}

function region(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true })
}

function primaryNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Основна навігація' })
}

/**
 * Types one whole attempt for real. `wrongKeys` wrong keystrokes are made up front, before the
 * first right one: under stop-on-letter each is an error and none moves the caret.
 */
async function completeAttempt(
  page: Page,
  scaleId: string,
  mode: 'practice' | 'test',
  wrongKeys = 0,
): Promise<string> {
  await page.goto(`/exercise/${scaleId}?mode=${mode}`)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
  const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
  for (let i = 0; i < wrongKeys; i += 1) await typeChar(page, 'ъ')
  await typeText(page, text)
  await expect(page).toHaveURL(/\/result\//)
  return new URL(page.url()).pathname
}

/** Answers the first-run question as the first option and lands on Today. */
async function startFromEmpty(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'З чого почнемо?' })).toBeVisible()
  await page.getByRole('radio', { name: /Ще не друкую наосліп/ }).check()
  await page.getByRole('button', { name: 'Обрати й почати' }).click()
  await expect(page.getByRole('heading', { name: 'Сьогодні' })).toBeVisible()
}

async function unlockedKeyCount(page: Page): Promise<number> {
  const summaryText = await page.getByTestId('keyboard-summary').innerText()
  const match = /Відкрито (\d+) з (\d+) клавіш/.exec(summaryText)
  if (match === null) throw new Error(`unexpected keyboard summary: ${summaryText}`)
  return Number(match[1])
}

function scaleRow(page: Page, name: string) {
  return page.locator('li[data-state]').filter({ hasText: name }).first()
}

test.describe('US3 the path and mastery', () => {
  test('a learner with no history has the first scales open and later ones locked with their condition (scenario 1)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/path')

    await expect(page.getByTestId('keyboard-summary')).toContainText(
      /Відкрито 8 з \d+ клавіш\. Наступна до відкриття: п\./,
    )

    // The five anchor scales and the scale for the next key are open.
    for (const name of ['Ряд · а', 'Дзеркало · о', 'Чергування рук · ф', 'Ізоляція пальця · ж']) {
      await expect(scaleRow(page, name)).toHaveAttribute('data-state', 'notStarted')
      await expect(
        page.getByRole('button', { name: `Почати вправу ${name}` }),
        `${name} can be started`,
      ).toBeVisible()
    }
    await expect(scaleRow(page, 'Ряд · п')).toHaveAttribute('data-state', 'notStarted')

    // A later scale is locked and says what opens it: the key before it, or the keys it needs.
    const afterNext = scaleRow(page, 'Ряд · р')
    await expect(afterNext).toHaveAttribute('data-state', 'locked')
    await expect(afterNext).toContainText('Відкриється, коли опануєте клавішу р')
    const needsKey = scaleRow(page, 'Вертикальний рух · е')
    await expect(needsKey).toHaveAttribute('data-state', 'locked')
    await expect(needsKey).toContainText('Спершу відкрийте: п')
    await expect(
      page.getByRole('button', { name: 'Почати вправу Вертикальний рух · е' }),
    ).toHaveCount(0)

    // Stage 2 and the Academy are shown as arriving later, not offered.
    const later = region(page, 'Далі')
    await expect(later).toContainText('Стадія 2: слова з відкритих клавіш')
    await expect(later).toContainText('Стадія 3: Академія')
    await expect(later).toContainText('З’явиться в наступному випуску.')
    await expect(later.getByRole('button')).toHaveCount(0)
  })

  test('a third passing Test Attempt completes the exercise and unlocks exactly its key (scenarios 2 and 6)', async ({
    page,
  }) => {
    await seedLearner(page, passes(FIRST_KEY, 2))
    await page.goto('/path')
    const before = await unlockedKeyCount(page)
    await expect(scaleRow(page, 'Ряд · п')).toHaveAttribute('data-state', 'inProgress')
    await expect(scaleRow(page, 'Ряд · п')).toContainText('Серія 2 з 3')
    await expect(scaleRow(page, 'Ряд · р')).toHaveAttribute('data-state', 'locked')

    await completeAttempt(page, FIRST_KEY, 'test')
    await primaryNavigation(page).getByRole('link', { name: 'Шлях' }).click()

    // Scenario 2: complete, and the Mastery Rule is what did it.
    await expect(scaleRow(page, 'Ряд · п')).toHaveAttribute('data-state', 'complete')
    await expect(scaleRow(page, 'Ряд · п')).toContainText('Завершено')

    // Scenario 6: exactly that key joined, the next one in the order is now the awaited one, and
    // the unlocked set is still a prefix (nothing further along opened).
    expect(await unlockedKeyCount(page)).toBe(before + 1)
    await expect(page.getByTestId('keyboard-summary')).toContainText('Наступна до відкриття: р')
    const keyboard = page.getByTestId('keyboard')
    await expect(keyboard.locator('[data-code="KeyG"]')).toHaveAttribute('data-state', 'unlocked')
    await expect(keyboard.locator('[data-code="KeyH"]')).toHaveAttribute('data-state', 'next')
    await expect(keyboard.locator('[data-code="Quote"]')).toHaveAttribute('data-state', 'locked')
    await expect(keyboard.locator('[data-state="next"]')).toHaveCount(1)

    // And the scale that key was the next of is now open.
    await expect(scaleRow(page, 'Ряд · р')).toHaveAttribute('data-state', 'notStarted')
  })

  test('an attempt below the accuracy floor resets the consecutive count to zero (scenario 3)', async ({
    page,
  }) => {
    await seedLearner(page, passes(FIRST_KEY, 2))
    await page.goto('/today')
    await expect(region(page, 'Де ви зараз')).toContainText(/Серія цієї вправи\s*2 з 3/)

    // Four wrong keystrokes on a 60-character scale is under 95%.
    await completeAttempt(page, FIRST_KEY, 'test', 4)
    await expect(region(page, 'Головні показники')).toContainText(/Помилки\s*4/)

    await primaryNavigation(page).getByRole('link', { name: 'Сьогодні' }).click()
    await expect(region(page, 'Де ви зараз')).toContainText(/Серія цієї вправи\s*0 з 3/)
    await primaryNavigation(page).getByRole('link', { name: 'Шлях' }).click()
    await expect(scaleRow(page, 'Ряд · п')).not.toHaveAttribute('data-state', 'complete')
    await expect(scaleRow(page, 'Ряд · п')).not.toContainText('Серія')
    await expect(page.getByTestId('keyboard-summary')).toContainText('Наступна до відкриття: п')
  })

  test('speed below every benchmark still counts toward mastery, because speed never gates (scenario 4)', async ({
    page,
  }) => {
    // Three passes at 3 characters a minute: slower than any benchmark the level table publishes.
    await seedLearner(
      page,
      Array.from(
        { length: 3 },
        (): SeedAttempt => ({ scaleId: FIRST_KEY, mode: 'test', accuracy: 0.97, spm: 3 }),
      ),
    )
    await page.goto('/path')

    await expect(scaleRow(page, 'Ряд · п')).toHaveAttribute('data-state', 'complete')
    await expect(page.getByTestId('keyboard-summary')).toContainText('Наступна до відкриття: р')
  })

  test('a passing Practice Attempt does not count, and the test attempt becomes the primary action (scenario 5)', async ({
    page,
  }) => {
    await seedLearner(page, passes(FIRST_KEY, 2))

    // The mode buttons, read the way a learner reads them: which one is filled.
    const filled = (name: string) =>
      page
        .getByRole('button', { name, exact: true })
        .evaluate((node) => getComputedStyle(node).backgroundColor)

    // Control: before any passing practice, Start is the filled button and the test is not.
    await page.goto(`/exercise/${FIRST_KEY}?mode=practice`)
    const primary = await filled('Почати')
    expect(await filled('Пройти залікову спробу')).not.toBe(primary)

    // A perfect Practice Attempt, then on to the next action without reloading.
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeText(page, text)
    await expect(page).toHaveURL(/\/result\//)
    // Practice never unlocks anything, however clean.
    await expect(region(page, 'Нова клавіша відкрита')).toHaveCount(0)
    await region(page, 'Що робити далі').getByRole('button', { name: 'Почати' }).click()
    await expect(page).toHaveURL(/\/exercise\/yq\.run\.KeyG\?mode=practice/)

    // Now "take the test attempt" is the filled action, and Start has stepped back.
    await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeVisible()
    expect(await filled('Пройти залікову спробу')).toBe(primary)
    expect(await filled('Почати')).not.toBe(primary)

    // And the streak did not move: still two, and the key is still locked.
    await primaryNavigation(page).getByRole('link', { name: 'Шлях' }).click()
    await expect(scaleRow(page, 'Ряд · п')).toContainText('Серія 2 з 3')
    await expect(page.getByTestId('keyboard-summary')).toContainText('Наступна до відкриття: п')
  })

  test('Today shows one Next Action with its button, the stage and the unlocked key count (scenario 8)', async ({
    page,
  }) => {
    await seedLearner(page, [{ scaleId: ANCHORS, mode: 'test', accuracy: 0.98 }])
    await page.goto('/today')

    const next = region(page, 'Наступна дія')
    await expect(page.getByTestId('next-action')).toHaveCount(1)
    await expect(page.getByTestId('next-action')).toBeVisible()
    await expect(next.getByRole('button')).toHaveCount(1)

    const where = region(page, 'Де ви зараз')
    await expect(where).toContainText('Стадія 1: гами на відкритих клавішах')
    await expect(where).toContainText(/Відкрито клавіш\s*8 з \d+/)

    await next.getByRole('button', { name: 'Почати' }).click()
    await expect(page).toHaveURL(/\/exercise\/.+\?mode=practice/)
  })

  test('every scale complete and 96% over the last five attempts reports Stage 1 complete (scenario 9)', async ({
    page,
  }) => {
    await seedLearner(
      page,
      YQ_SCALES.flatMap((scaleId) => passes(scaleId, 3)),
    )
    await page.goto('/today')
    await expect(page.getByText('Стадію 1 завершено.')).toBeVisible()
  })

  test('every scale complete but only 95.5% over the last five is not Stage 1 complete (scenario 9, the converse)', async ({
    page,
  }) => {
    // Passing the 95% floor, but not the 96% bar that leaving Stage 1 takes (FR-044).
    const last: SeedAttempt[] = Array.from(
      { length: 5 },
      (): SeedAttempt => ({ scaleId: ANCHORS, mode: 'practice', accuracy: 0.955 }),
    )
    await seedLearner(page, [...YQ_SCALES.flatMap((scaleId) => passes(scaleId, 3)), ...last])
    await page.goto('/today')
    await expect(region(page, 'Де ви зараз')).toBeVisible()
    await expect(page.getByText('Стадію 1 завершено.')).toHaveCount(0)
  })

  test('the starting-level choice offers three options, the third opens more than the first, and none closes a key (scenario 10)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/today')
    await expect(page.getByRole('heading', { name: 'З чого почнемо?' })).toBeVisible()

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(3)

    const opens = async (title: RegExp): Promise<number> => {
      const label = page.locator('label').filter({ has: page.getByRole('radio', { name: title }) })
      const text = await label.innerText()
      const match = /Відкриває клавіш: (\d+)/.exec(text)
      if (match === null) throw new Error(`no key count in: ${text}`)
      return Number(match[1])
    }
    const never = await opens(/Ще не друкую наосліп/)
    const home = await opens(/Знаю домашній ряд/)
    const accuracy = await opens(/Друкую наосліп, хочу точності/)
    expect(accuracy).toBeGreaterThan(never)
    expect(home).toBeGreaterThan(never)
    expect(accuracy).toBeGreaterThan(home)

    // Choosing the first opens exactly its count...
    await page.getByRole('radio', { name: /Ще не друкую наосліп/ }).check()
    await page.getByRole('button', { name: 'Обрати й почати' }).click()
    await primaryNavigation(page).getByRole('link', { name: 'Шлях' }).click()
    expect(await unlockedKeyCount(page)).toBe(never)

    // ...and choosing the third later opens more, never fewer.
    await page.getByRole('radio', { name: /Друкую наосліп, хочу точності/ }).check()
    await page.getByRole('button', { name: 'Зберегти вибір' }).click()
    await expect(page.getByTestId('keyboard-summary')).toContainText(
      new RegExp(`Відкрито ${accuracy} з`),
    )
    expect(await unlockedKeyCount(page)).toBe(accuracy)

    // Having opened more, the lower answers are no longer offered: no answer takes a key away.
    await expect(page.getByRole('radio', { name: /Ще не друкую наосліп/ })).toBeDisabled()
    await expect(page.getByRole('radio', { name: /Знаю домашній ряд/ })).toBeDisabled()
    await expect(page.getByText('Вже відкрито більше, ніж дасть цей варіант').first()).toBeVisible()
  })

  test('Path and Today have no accessibility violations (T110)', async ({ page }) => {
    await seedLearner(page, passes(FIRST_KEY, 2))
    for (const route of ['/today', '/path']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })
})

/**
 * Closes the browser context the way quitting the browser would and opens a new one from what it
 * left on disk. `storageState` with IndexedDB is the closest a test gets to "restart": nothing of
 * the old page survives except what the application itself persisted.
 */
async function restartBrowser(
  browser: Browser,
  old: BrowserContext,
  baseURL: string | undefined,
): Promise<{ context: BrowserContext; page: Page }> {
  const storage = await old.storageState({ indexedDB: true })
  const context = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    storageState: storage,
    reducedMotion: 'reduce',
  })
  return { context, page: await context.newPage() }
}

interface Snapshot {
  readonly today: { readonly action: string; readonly where: string }
  readonly path: {
    readonly summary: string
    readonly keys: readonly (readonly (string | undefined)[])[]
    readonly rows: readonly string[]
  }
  /** Which keys the practice guide fades, read from the opacity tier on every keycap. */
  readonly confidence: readonly (readonly string[])[]
  readonly history: Readonly<Record<string, string>>
}

/** Everything the requirements' §8.9 says must be unchanged, read the way a learner would. */
async function snapshot(page: Page, resultPaths: readonly string[]): Promise<Snapshot> {
  await page.goto('/today')
  await expect(page.getByTestId('next-action')).toBeVisible()
  const today = {
    action: await page.getByTestId('next-action').innerText(),
    where: await region(page, 'Де ви зараз').innerText(),
  }

  await page.goto('/path')
  await expect(page.getByTestId('keyboard-summary')).toBeVisible()
  const path = {
    summary: await page.getByTestId('keyboard-summary').innerText(),
    keys: await page
      .getByTestId('keyboard')
      .locator('[data-code]')
      .evaluateAll((nodes) =>
        nodes.map((node) => [
          (node as HTMLElement).dataset['code'],
          (node as HTMLElement).dataset['state'],
        ]),
      ),
    rows: await page
      .locator('li[data-state]')
      .evaluateAll((nodes) =>
        nodes.map((node) => `${(node as HTMLElement).dataset['state']}|${node.textContent}`),
      ),
  }

  // Confidence is not printed anywhere; its one visible effect is how strongly the practice guide
  // prompts each key. Reading that tier per key is reading Confidence from the outside.
  await page.goto(`/exercise/${ANCHORS}?mode=practice`)
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('keyboard-guide')).toBeVisible()
  const confidence = await page
    .getByTestId('keyboard-guide')
    .locator('[data-code]')
    .evaluateAll((nodes) =>
      nodes.map((node) => [
        (node as HTMLElement).dataset['code'] ?? '',
        /opacity-\d+/.exec(node.className)?.[0] ?? '',
        String(node.className.includes('outline-terracotta')),
      ]),
    )

  const history: Record<string, string> = {}
  for (const resultPath of resultPaths) {
    await page.goto(resultPath)
    await expect(region(page, 'Головні показники')).toBeVisible()
    history[resultPath] = [
      await region(page, 'Головні показники').innerText(),
      await region(page, 'Порівняння з попереднім').innerText(),
      await region(page, 'Що робити далі').innerText(),
    ].join('\n')
  }
  return { today, path, confidence, history }
}

test.describe('US3 progress survives a restart (§8.9)', () => {
  test('the unlocked set, streaks, confidence, history and Next Action are unchanged after a reload and after a restart (scenario 7)', async ({
    page,
    browser,
    baseURL,
  }) => {
    await startFromEmpty(page)

    // Three test attempts on the scale for п, the first with a corrected-away wrong key so that
    // the history is not three identical perfect runs.
    const results: string[] = []
    results.push(await completeAttempt(page, FIRST_KEY, 'test', 1))
    results.push(await completeAttempt(page, FIRST_KEY, 'test'))
    results.push(await completeAttempt(page, FIRST_KEY, 'test'))
    results.push(await completeAttempt(page, ANCHORS, 'practice'))

    const before = await snapshot(page, results)
    // The state is a real one: п has unlocked, so this is not a snapshot of nothing.
    expect(before.path.summary).toContain('Наступна до відкриття: р')
    expect(
      before.path.rows.some((row) => row.startsWith('complete|') && row.includes('Ряд · п')),
    ).toBe(true)
    expect(Object.keys(before.history)).toHaveLength(4)

    // A plain reload of the same tab.
    await page.reload()
    const afterReload = await snapshot(page, results)
    expect(afterReload).toEqual(before)

    // And a restart: a new browser context built from nothing but what was written to disk.
    const restarted = await restartBrowser(browser, page.context(), baseURL)
    try {
      // No seed anywhere on this page: a restarted browser has only what the app stored.
      const afterRestart = await snapshot(restarted.page, results)
      expect(afterRestart).toEqual(before)
    } finally {
      await restarted.context.close()
    }
  })
})

/**
 * Opts into the worker the way the `AssetCache` seam does. See the next describe for why a test
 * has to.
 */
async function registerWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { type: 'module' })
    await navigator.serviceWorker.ready
  })
  // Controlling, not merely installed: only a controlled page is served by the worker.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

test.describe('US3 practice with the network away (§8.10)', () => {
  test('after one successful load, an unlocked exercise starts, completes and shows its result offline (scenario 11)', async ({
    page,
    context,
  }) => {
    await seedLearner(page)
    await page.goto('/path')
    await expect(page.getByTestId('keyboard-summary')).toBeVisible()
    await registerWorker(page)

    await context.setOffline(true)
    expect(await page.evaluate(() => navigator.onLine)).toBe(false)
    // The emulation reaches the worker's own network too: a file nobody cached cannot be fetched.
    // If it could, the rest of this test would prove nothing about the cache.
    const reached = await page.evaluate(() =>
      fetch(`/not-cached-${Date.now()}.json`, { cache: 'no-store' }).then(
        () => 'network',
        () => 'offline',
      ),
    )
    expect(reached).toBe('offline')

    // The learner opens the app again: a fresh navigation, answered by the worker.
    await page.goto('/path')
    await expect(page.getByRole('heading', { name: 'Шлях' })).toBeVisible()
    await expect(page.getByTestId('keyboard-summary')).toBeVisible()

    // An unlocked exercise starts...
    await page.getByRole('button', { name: 'Почати вправу Ряд · а' }).click()
    await expect(page).toHaveURL(/\/exercise\//)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()

    // ...completes...
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeText(page, text)

    // ...and its result is read.
    await expect(page).toHaveURL(/\/result\//)
    await expect(page.getByRole('heading', { name: 'Результат спроби' })).toBeVisible()
    await expect(region(page, 'Головні показники')).toContainText(/Помилки\s*0/)
  })

  test('the shipped application registers its own worker on the first load (FR-074)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/path')
    await expect(page.getByTestId('keyboard-summary')).toBeVisible()

    // `seams/cache.ts` says "exactly one test opts into the real adapter". That sentence assumes
    // the product registers the worker somewhere; this asks the running product whether it did.
    // Without a registration there is nothing to serve the app offline on the *next* visit, and
    // scenario 11 holds only for a tab that stays open.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration()
            return registration !== undefined
          }),
        { timeout: 10_000 },
      )
      .toBe(true)
  })
})
