import type { Browser, BrowserContext, Page } from '@playwright/test'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * T133, T134. User Story 6, "Running a guided session".
 *
 * Independent Test: start a session from Today, run it to the end through all four blocks, and
 * confirm the between-blocks screen appears twice, the expected length was stated up front, the
 * fourth block is real words or text (never pseudo-words), and abandoning mid-block keeps the
 * attempts already recorded.
 *
 * A session is long by design (15 to 25 minutes of typing), so the seeded learner is a slow one:
 * at 25 characters a minute the planner sizes the three exercise blocks at six attempts (2 warm-up,
 * 2 target, 2 consolidation) and the real-text block at a short one, which is what makes running it
 * end to end affordable. The plan is sized from
 * the learner's own recent speed (FR-077), so this is not a shortcut around the rule — it is the
 * rule, applied to a learner for whom it yields a short list.
 *
 * The session lives in memory and is not persisted (see `session/store.ts`), so every test moves
 * between screens through the application's own links. A `page.goto` is a reload, and a reload is
 * exactly the restart scenario, which has its own test.
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

interface Learner {
  readonly spm: number
  readonly transitions?: Record<
    string,
    { count: number; misses: number; sumIki: number; sumIkiSq: number }
  >
}

/** One clean, slow Test Attempt: enough history to size a session and to name a next action. */
function history(learner: Learner) {
  const completedAt = Date.now() - 3_600_000
  return [
    {
      id: 'earlier',
      scaleId: ANCHORS,
      layoutId: 'yq',
      language: 'uk',
      mode: 'test',
      seed: 1,
      startedAt: completedAt - 15_000,
      completedAt,
      elapsedMs: 15_000,
      metrics: {
        spm: learner.spm,
        wpm: learner.spm / 5,
        accuracy: 0.98,
        errorCount: 0,
        errorsByChar: {},
        rhythmConsistency: { value: 90, breaksExcluded: 0 },
        meanIkiByKey: {},
        meanIkiByTransition: {},
      },
      aggregates: { keys: {}, transitions: learner.transitions ?? {} },
    },
  ]
}

async function seedLearner(page: Page, learner?: Learner): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const envelope = {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: learner === undefined ? [] : history(learner),
  }
  await seedStore(page, envelope)
}

const SLOW: Learner = { spm: 25 }

/** Twelve observations of ф→в, eight missed: a weak Transition by any reading. */
const WEAK_TRANSITION: Learner = {
  spm: 20,
  transitions: { 'ф>в': { count: 12, misses: 8, sumIki: 5400, sumIkiSq: 2_430_000 } },
}

function primaryNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Основна навігація' })
}

/** Back to the session through the application's own links, so nothing reloads. */
async function toSession(page: Page): Promise<void> {
  await primaryNavigation(page).getByRole('link', { name: 'Головна' }).click()
  await page.getByRole('button', { name: /Продовжити заняття/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Сесія' })).toBeVisible()
}

/** The session's own screen, with its plan before the first block. Home starts it directly. */
async function openSessionFromToday(page: Page): Promise<void> {
  await page.goto('/session')
  await expect(page.getByRole('heading', { level: 1, name: 'Сесія' })).toBeVisible()
}

/** From the pre-start screen of an exercise to its result, typing it for real. */
async function typeExerciseThroughToResult(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
  const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
  await typeText(page, text)
  await expect(page).toHaveURL(/\/result\//)
}

/** The "N from M" attempt counter a running block shows. */
async function expectBlock(
  page: Page,
  n: number,
  name: string,
  done: number,
  total: number,
): Promise<void> {
  await expect(page.getByText(`Блок ${n} з 4: ${name}`)).toBeVisible()
  await expect(page.getByText(`Виконано спроб: ${done} з ${total}`)).toBeVisible()
}

function minutesStated(text: string): number {
  const match = /близько (\d+) хв/.exec(text)
  if (match === null) throw new Error(`no expected length in: ${text}`)
  return Number(match[1])
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

test.describe('US6 a guided session', () => {
  test('the expected length is stated before the first block, between 15 and 25 minutes (scenario 1)', async ({
    page,
  }) => {
    await seedLearner(page, SLOW)
    await openSessionFromToday(page)

    // Stated on the intro screen: no exercise has been opened, no attempt has begun.
    await expect(page).toHaveURL(/\/session$/)
    await expect(page.getByTestId('typing-line')).toHaveCount(0)
    const stated = page.getByTestId('expected-length')
    await expect(stated).toBeVisible()
    const minutes = minutesStated(await stated.innerText())
    expect(minutes).toBeGreaterThanOrEqual(15)
    expect(minutes).toBeLessThanOrEqual(25)

    // The four blocks are laid out before anything starts, the last one named for what it is.
    const blocks = page.getByRole('region', { name: 'Чотири блоки' })
    for (const name of ['Розминка', 'Головна навичка', 'Закріплення', 'Справжній текст']) {
      await expect(blocks).toContainText(name)
    }
  })

  test('the expected length stays inside 15 to 25 minutes for a fast learner too (scenario 1, FR-077)', async ({
    page,
  }) => {
    await seedLearner(page, { spm: 240 })
    await openSessionFromToday(page)

    const minutes = minutesStated(await page.getByTestId('expected-length').innerText())
    expect(minutes).toBeGreaterThanOrEqual(15)
    expect(minutes).toBeLessThanOrEqual(25)
  })

  test('with a previous weak Transition the warm-up is built around it (scenario 2)', async ({
    page,
  }) => {
    await seedLearner(page, WEAK_TRANSITION)
    await openSessionFromToday(page)

    const warmUp = page.getByRole('listitem').filter({ hasText: 'Розминка' }).first()
    await expect(warmUp).toContainText(
      'Вправа навколо найслабших переходів між клавішами з ваших попередніх спроб.',
    )
    await expect(warmUp).toContainText('Фокус: ф')
    await expect(warmUp).not.toContainText('Слабких переходів ще не виявлено')

    // And the first exercise the session opens is that one, not the target skill.
    await page.getByRole('button', { name: 'Почати першу вправу' }).click()
    await expect(page.getByRole('heading', { name: 'Гама: клавіша ф' })).toBeVisible()
  })

  test('with no previous session the warm-up falls back to the target skill, visibly (scenario 3)', async ({
    page,
  }) => {
    await seedLearner(page)
    await openSessionFromToday(page)

    const warmUp = page.getByRole('listitem').filter({ hasText: 'Розминка' }).first()
    await expect(warmUp).toContainText(
      'Слабких переходів ще не виявлено, тому розминка йде на головній навичці.',
    )
    // Not skipped, not failing: the warm-up still has attempts to do and a focus to do them on.
    await expect(warmUp).toContainText(/Спроб: \d+/)
    await expect(warmUp).toContainText(/Фокус: \S+/)

    await page.getByRole('button', { name: 'Почати першу вправу' }).click()
    // The target skill for a learner with no history is the first key of the Unlock Order, п.
    await expect(page.getByRole('heading', { name: 'Гама: клавіша п' })).toBeVisible()
  })

  test('it runs through all four blocks, with the between-blocks screen twice and real words from open keys to finish (scenarios 4 and 6, Independent Test)', async ({
    page,
  }) => {
    // Seven attempts typed one event per character, with five accessibility audits: about a minute
    // on its own, and more under a parallel run.
    test.setTimeout(180_000)
    await seedLearner(page, SLOW)
    await openSessionFromToday(page)
    await audit(page)

    // Warm-up: two practice attempts.
    await page.getByRole('button', { name: 'Почати першу вправу' }).click()
    await expect(page).toHaveURL(/mode=practice/)
    await typeExerciseThroughToResult(page)
    await toSession(page)
    await expectBlock(page, 1, 'Розминка', 1, 2)
    await audit(page)
    await page.getByRole('button', { name: 'Почати спробу 2 з 2' }).click()
    await typeExerciseThroughToResult(page)
    await toSession(page)

    // Between blocks, first time: it names the block just done and the one coming.
    let betweenScreens = 0
    const between = page.getByTestId('between-blocks')
    await expect(between).toBeVisible()
    betweenScreens += 1
    await expect(between).toContainText('Щойно завершено: Розминка')
    await expect(between).toContainText('Далі: Головна навичка')
    await audit(page)
    await between.getByRole('button', { name: 'Перейти до наступного блоку' }).click()

    // Target skill: two practice attempts.
    await expect(page).toHaveURL(/mode=practice/)
    await typeExerciseThroughToResult(page)
    await toSession(page)
    await expectBlock(page, 2, 'Головна навичка', 1, 2)
    await page.getByRole('button', { name: 'Почати спробу 2 з 2' }).click()
    await typeExerciseThroughToResult(page)
    await toSession(page)

    // Between blocks, second time.
    await expect(between).toBeVisible()
    betweenScreens += 1
    await expect(between).toContainText('Щойно завершено: Головна навичка')
    await expect(between).toContainText('Далі: Закріплення')
    await between.getByRole('button', { name: 'Перейти до наступного блоку' }).click()

    // Consolidation: Test Attempts, which are the ones that count for mastery (FR-039).
    await expect(page).toHaveURL(/mode=test/)
    await typeExerciseThroughToResult(page)
    await toSession(page)
    await expectBlock(page, 3, 'Закріплення', 1, 2)
    await page.getByRole('button', { name: 'Почати спробу 2 з 2' }).click()
    await expect(page).toHaveURL(/mode=test/)
    await typeExerciseThroughToResult(page)
    await toSession(page)

    // Twice in a full run, and only twice: the fourth block is not a between-blocks screen.
    expect(betweenScreens).toBe(2)
    await expect(between).toHaveCount(0)

    // Scenario 6, the fourth block. This learner has only the home row open: too few keys for
    // whole sentences, so the block is real words from open keys, and it says so.
    const block = page.getByTestId('real-text-block')
    await expect(block).toBeVisible()
    await expect(block.getByTestId('real-text-kind')).toHaveAttribute('data-kind', 'words')
    await expect(block).toContainText('Слова з відкритих клавіш')
    const preview = ((await block.getByTestId('real-text-preview').textContent()) ?? '').trim()
    // Every character is a home-row key or a space: nothing locked, nothing made up.
    expect(preview).toMatch(/^[фівапролдж ]+$/)
    await audit(page)

    await block.getByRole('button', { name: 'Набрати текст' }).click()
    await expect(page).toHaveURL(/\/exercise\/yq\.realtext/)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const typed = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    // The exercise types exactly the text the session previewed.
    expect(typed.trim()).toBe(preview)
    await typeText(page, typed)
    await expect(page).toHaveURL(/\/result\//)
    await toSession(page)

    await expect(block).toContainText('Текст набрано')
    await block.getByRole('button', { name: 'Завершити сесію' }).click()
    await expect(page.getByRole('heading', { name: 'Сесію завершено' })).toBeVisible()
    await expect(page.getByText('За цю сесію записано спроб: 7.')).toBeVisible()
    await audit(page)
  })

  test('leaving after one completed attempt keeps it, and the session can be resumed or abandoned (scenario 5)', async ({
    page,
  }) => {
    await seedLearner(page, SLOW)
    await openSessionFromToday(page)
    await page.getByRole('button', { name: 'Почати першу вправу' }).click()
    await typeExerciseThroughToResult(page)

    // Leaving: straight to Today, mid-block, with no ceremony.
    await primaryNavigation(page).getByRole('link', { name: 'Головна' }).click()

    // Resumable: the session is still there, and it knows one attempt is done.
    await page.getByRole('button', { name: /Продовжити заняття/ }).click()
    await expectBlock(page, 1, 'Розминка', 1, 2)
    await expect(page.getByRole('button', { name: 'Почати спробу 2 з 2' })).toBeVisible()

    // Abandoned, deliberately: it says what that does and does not do.
    await expect(page.getByText('Завершені спроби залишаються записаними')).toBeVisible()
    await page.getByRole('button', { name: 'Залишити сесію' }).click()
    await expect(page.getByRole('button', { name: 'Почати першу вправу' })).toBeVisible()

    // The attempt is kept "with everything it implies for progress": a Practice Attempt on the
    // exercise screen shows the last completed one, which it could not if it had been thrown away.
    await primaryNavigation(page).getByRole('link', { name: 'Мапа' }).click()
    await page.getByRole('button', { name: 'Почати вправу Ряд · а' }).click()
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('live-speed')).not.toHaveText('—')
    await expect(page.getByText('Завершених вправ ще немає')).toHaveCount(0)
  })

  test('any unlocked exercise starts on its own from Path, outside any session (scenario 7)', async ({
    page,
  }) => {
    await seedLearner(page, SLOW)
    await page.goto('/path')
    await page.getByRole('button', { name: 'Почати вправу Дзеркало · о' }).click()
    await expect(page).toHaveURL(/\/exercise\/yq\.mirror\.anchors/)

    await typeExerciseThroughToResult(page)

    // No session was started by doing that: Home offers a fresh start, not a resume, and the
    // session screen is still at its intro.
    await primaryNavigation(page).getByRole('link', { name: 'Головна' }).click()
    await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Продовжити заняття' })).toHaveCount(0)
    await openSessionFromToday(page)
    await expect(page.getByRole('button', { name: 'Почати першу вправу' })).toBeVisible()
    await expect(page.getByText(/Блок \d з 4/)).toHaveCount(0)
  })
})

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

test.describe('US6 a session interrupted by a restart (FR-078)', () => {
  test('it ends deliberately, strands nobody, and keeps every attempt already recorded (T134)', async ({
    page,
    browser,
    baseURL,
  }) => {
    await seedLearner(page, SLOW)
    await openSessionFromToday(page)
    await page.getByRole('button', { name: 'Почати першу вправу' }).click()
    await typeExerciseThroughToResult(page)
    const recorded = new URL(page.url()).pathname
    await toSession(page)
    await expectBlock(page, 1, 'Розминка', 1, 2)

    // The browser restarts in the middle of the session. The session is in memory; what is on disk
    // is the learner's progress.
    const restarted = await restartBrowser(browser, page.context(), baseURL)
    try {
      const after = restarted.page

      // Not stuck: the session screen opens at its intro, with a way to begin again.
      await after.goto('/session')
      await expect(after.getByRole('heading', { level: 1, name: 'Сесія' })).toBeVisible()
      await expect(after.getByRole('button', { name: 'Почати першу вправу' })).toBeVisible()
      await expect(after.getByText(/Блок \d з 4/)).toHaveCount(0)

      // Every other way out still works.
      await primaryNavigation(after).getByRole('link', { name: 'Мапа' }).click()
      await expect(after.getByRole('heading', { level: 1, name: 'Шлях' })).toBeVisible()
      await primaryNavigation(after).getByRole('link', { name: 'Головна' }).click()
      await expect(after.getByTestId('next-action')).toBeVisible()

      // The attempt recorded before the restart is still there, result and all.
      await after.goto(recorded)
      await expect(after.getByTestId('result-score')).toBeVisible()
      await expect(after.getByRole('region', { name: 'Головні показники' })).toBeVisible()
    } finally {
      await restarted.context.close()
    }
  })
})
