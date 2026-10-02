import type { Browser, BrowserContext, Locator, Page } from '@playwright/test'
import { openLevelStep, walkFirstRun } from './harness/firstRun.js'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import { typeChar, typeText } from './harness/type.js'

/**
 * T123, T124. User Story 5, "Settings and accessibility presets", and the cross-cutting checks of
 * FR-066 and SC-011: keyboard-only operation and a clean axe audit of every F1 screen.
 *
 * Independent Test: change every setting, confirm each takes effect immediately, reload, and
 * confirm each is still in force.
 *
 * Persistence tests use the bare `page` and seed nothing: a seed written by an init script is
 * rewritten on every load, so it could never show that a setting survived one.
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
const FIRST_KEY = 'yq.run.KeyG'

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One radio of one group, by the group's legend and the option's own label. */
function radio(page: Page, legend: string, label: string): Locator {
  return page
    .getByRole('group', { name: legend, exact: true })
    .getByRole('radio', { name: new RegExp(`^${escaped(label)}`) })
}

function html(page: Page): Locator {
  return page.locator('html')
}

function primaryNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Основна навігація' })
}

/** Walks the first run with the given level and lands on Today. */
async function startFromEmpty(page: Page, level = /Ще не друкую наосліп/): Promise<void> {
  await page.goto('/today')
  await walkFirstRun(page, { level })
  // The first run ends in a running exercise; leaving it records nothing.
  await page.goto('/')
  await expect(page.getByTestId('home-continue')).toBeVisible()
}

async function background(page: Page): Promise<string> {
  // The shell's own root carries the paper colour; `body` itself is transparent.
  return page
    .locator('#root > div')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor)
}

/** The longest transition or animation anywhere on the page, in seconds. */
async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const seconds = (list: string): number[] =>
      list.split(',').map((part) => {
        const value = Number.parseFloat(part)
        return part.trim().endsWith('ms') ? value / 1000 : value
      })
    let longest = 0
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      longest = Math.max(
        longest,
        ...seconds(style.transitionDuration),
        ...seconds(style.animationDuration),
      )
    }
    return longest
  })
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

test.describe('US5 settings', () => {
  test('system, light, dark and the low-vision preset are offered, light is the default, and each applies at once (scenario 1)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    await page.goto('/settings')

    const theme = page.getByRole('group', { name: 'Тема', exact: true })
    await expect(theme.getByRole('radio')).toHaveCount(4)
    for (const label of ['Як у системі', 'Світла', 'Темна', 'Для слабкого зору']) {
      await expect(radio(page, 'Тема', label)).toBeVisible()
    }

    // Light by default, before the learner has touched anything.
    await expect(radio(page, 'Тема', 'Світла')).toBeChecked()
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    const light = await background(page)

    // Each choice re-themes the page in place: no reload, and a different ground every time.
    await radio(page, 'Тема', 'Темна').check()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    const dark = await background(page)

    await radio(page, 'Тема', 'Для слабкого зору').check()
    await expect(html(page)).toHaveAttribute('data-theme', 'low-vision')
    const lowVision = await background(page)

    expect(new Set([light, dark, lowVision]).size).toBe(3)

    // "System" follows the operating system.
    await radio(page, 'Тема', 'Як у системі').check()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })

  test('the low-vision preset is a theme of its own, not the light one made larger (scenario 1, FR-062)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/settings')

    const fontSize = () => page.evaluate(() => getComputedStyle(document.body).fontSize)
    const light = await fontSize()
    await radio(page, 'Тема', 'Для слабкого зору').check()
    await expect(html(page)).toHaveAttribute('data-theme', 'low-vision')

    // A palette of its own: the ground and the ink both differ from the light theme's.
    const ink = await page.evaluate(() => getComputedStyle(document.body).color)
    await radio(page, 'Тема', 'Світла').check()
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    const lightInk = await page.evaluate(() => getComputedStyle(document.body).color)
    expect(ink).not.toBe(lightInk)
    expect(await fontSize()).toBe(light)
  })

  test('system, reduced and off are offered; a system preference seeds the initial value (scenario 2)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/settings')

    await expect(
      page.getByRole('group', { name: 'Рух', exact: true }).getByRole('radio'),
    ).toHaveCount(3)
    for (const label of ['Як у системі', 'Зменшений', 'Вимкнений']) {
      await expect(radio(page, 'Рух', label)).toBeVisible()
    }
    // The operating system asked for less motion, so that is where the page starts.
    await expect(radio(page, 'Рух', 'Як у системі')).toBeChecked()
    await expect(html(page)).toHaveAttribute('data-motion', 'reduced')
  })

  test('with no system preference the initial motion is full, and Off removes every animation (scenario 2)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/settings')
    await expect(html(page)).toHaveAttribute('data-motion', 'full')
    // The attribute is written before React mounts; measure the screen, not the empty document.
    await expect(page.getByRole('heading', { level: 1, name: 'Налаштування' })).toBeVisible()
    // A control: with motion on, something on this page does animate, so "none" below means
    // something rather than "the page never animated".
    expect(await longestMotion(page)).toBeGreaterThan(0.05)

    await radio(page, 'Рух', 'Вимкнений').check()
    await expect(html(page)).toHaveAttribute('data-motion', 'off')
    // Nothing anywhere: a hundredth of a millisecond is the flag's "instant".
    expect(await longestMotion(page)).toBeLessThan(0.001)

    // And no sound, which is the same switch: the control says so and cannot be used.
    await expect(
      page.getByText('Рух вимкнено: нічого не анімується і нічого не звучить.'),
    ).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Звук' })).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: 'Звук' })).not.toBeChecked()
  })

  test('sound is off by default, and starting an attempt plays nothing (scenario 3)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const played: string[] = []
      ;(window as unknown as { __sounds: string[] }).__sounds = played
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function (...args) {
        played.push('media.play')
        return play.apply(this, args)
      }
      for (const name of ['AudioContext', 'webkitAudioContext', 'Audio'] as const) {
        const Original = (window as unknown as Record<string, new (...a: unknown[]) => unknown>)[
          name
        ]
        if (Original === undefined) continue
        ;(window as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
          played.push(name)
          return new Original(...args)
        }
      }
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    await page.goto('/settings')
    await expect(page.getByRole('checkbox', { name: 'Звук' })).not.toBeChecked()
    await expect(html(page)).toHaveAttribute('data-sound', 'off')

    // Start and finish an attempt: the moment most likely to be given a sound.
    await page.goto(`/exercise/${ANCHORS}?mode=practice`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeText(page, text)
    await expect(page).toHaveURL(/\/result\//)

    const sounds = await page.evaluate(() => (window as unknown as { __sounds: string[] }).__sounds)
    expect(sounds).toEqual([])
  })

  test('any size from 24 to 40 px is selectable and the preview and the typing line follow at once (scenario 4)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/settings')

    const slider = page.getByRole('slider', { name: 'Розмір тексту вправи' })
    await expect(slider).toHaveAttribute('min', '24')
    await expect(slider).toHaveAttribute('max', '40')

    const preview = page.getByTestId('text-size-preview')
    for (const size of [24, 31, 40]) {
      await slider.fill(String(size))
      await expect(preview).toHaveCSS('font-size', `${size}px`)
      await expect(page.locator('output')).toHaveText(`${size} пікселів`)
    }

    // The range has ends: asking for more or less lands on them, never outside.
    await slider.press('Home')
    await expect(slider).toHaveValue('24')
    await slider.press('ArrowLeft')
    await expect(slider).toHaveValue('24')
    await slider.press('End')
    await expect(slider).toHaveValue('40')
    await slider.press('ArrowRight')
    await expect(slider).toHaveValue('40')

    // And the typing line changes size: the setting is for the exercise text, not just a preview.
    await slider.fill('36')
    await page.goto(`/exercise/${ANCHORS}?mode=practice`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line').locator('.typing-line__stage')).toHaveCSS(
      'font-size',
      '36px',
    )
  })

  test('changing the typing language or the layout switches Path and keeps the other language (scenario 5)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startFromEmpty(page)

    // A real piece of Ukrainian progress: one Test Attempt on the scale for п.
    await page.goto(`/exercise/${FIRST_KEY}?mode=test`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    await typeText(
      page,
      (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? '',
    )
    await expect(page).toHaveURL(/\/result\//)

    await page.goto('/map')
    await expect(page.getByTestId('keyboard').locator('[data-code="KeyQ"]')).toHaveText(/^й$/i)
    const row = page.locator('li[data-state]').filter({ hasText: 'Ряд · п' }).first()
    await expect(row).toContainText('Серія 1 з 3')

    // Typing language: English. The layout follows it, and Path is the English catalogue.
    await primaryNavigation(page).getByRole('link', { name: 'Головна' }).click()
    await page.goto('/settings')
    await radio(page, 'Мова набору', 'English').check()
    await expect(radio(page, 'Розкладка', 'QWERTY')).toBeChecked()
    await primaryNavigation(page).getByRole('link', { name: 'Мапа' }).click()
    await expect(page.getByTestId('keyboard').locator('[data-code="KeyQ"]')).toHaveText(/^q$/i)
    await expect(
      page.locator('li[data-state]').filter({ hasText: 'Ряд · f' }).first(),
    ).toBeVisible()

    // Back to Ukrainian: nothing was discarded.
    await page.goto('/settings')
    await radio(page, 'Мова набору', 'Українська').check()
    await expect(radio(page, 'Розкладка', 'ЙЦУКЕН')).toBeChecked()
    await primaryNavigation(page).getByRole('link', { name: 'Мапа' }).click()
    await expect(page.getByTestId('keyboard').locator('[data-code="KeyQ"]')).toHaveText(/^й$/i)
    await expect(
      page.locator('li[data-state]').filter({ hasText: 'Ряд · п' }).first(),
    ).toContainText('Серія 1 з 3')
  })

  test('the layout alone can be changed, and Path follows it (scenario 5)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startFromEmpty(page)
    await page.goto('/settings')

    await radio(page, 'Розкладка', 'QWERTY').check()
    await primaryNavigation(page).getByRole('link', { name: 'Мапа' }).click()
    await expect(page.getByTestId('keyboard').locator('[data-code="KeyQ"]')).toHaveText(/^q$/i)
  })

  test('the interface language switches every string and leaves the exercise text alone (scenario 6)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startFromEmpty(page)

    const exerciseText = async (): Promise<string> => {
      await page.goto(`/exercise/${ANCHORS}?mode=practice`)
      await page.getByRole('button', { name: /^(Почати|Start)$/ }).click()
      return (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    }
    const before = await exerciseText()

    await page.goto('/settings')
    // The choice reloads the document. A click, not `check()`: check re-reads the radio after
    // clicking, and once the reload has switched the page to English its Ukrainian legend no
    // longer matches, so the re-read waits for ever whenever the reload wins the race.
    await radio(page, 'Мова інтерфейсу', 'English').click({ noWaitAfter: true })
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    // The rail, the status bar, the page and the «About the game» menu have all switched.
    await expect(html(page)).toHaveAttribute('lang', 'en')
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(navigation.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Map' })).toBeVisible()
    await page.getByRole('button', { name: 'About the game' }).click()
    await expect(page.getByRole('link', { name: 'Formulas' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible()
    await expect(page.getByText('Формули')).toHaveCount(0)
    await expect(page.getByText('Налаштування')).toHaveCount(0)

    // Typing stays Ukrainian, and the text of the very same exercise is character for character
    // what it was: the interface language never reaches the generator.
    const after = await exerciseText()
    expect(after).toBe(before)
    expect(after).toMatch(/[а-яіїєґ]/i)

    // The pre-start screen speaks English while the exercise beneath it stays Ukrainian.
    await page.goto(`/exercise/${ANCHORS}?mode=practice`)
    await expect(page.getByRole('heading', { name: /^Scale: / })).toBeVisible()
  })

  test('every setting is still in force after a reload, and after a browser restart (scenario 7)', async ({
    page,
    browser,
    baseURL,
  }) => {
    // Three full app starts plus the walk through the first run's steps.
    test.setTimeout(45_000)
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    await startFromEmpty(page)
    await page.goto('/settings')

    await radio(page, 'Тема', 'Темна').check()
    await radio(page, 'Рух', 'Зменшений').check()
    await page.getByRole('checkbox', { name: 'Звук' }).check()
    await page.getByRole('slider', { name: 'Розмір тексту вправи' }).fill('34')
    await radio(page, 'Помилки під час набору', 'Виправляти вільно').check()
    await radio(page, 'Мова набору', 'English').check()
    await radio(page, 'Розкладка', 'QWERTY').check()
    // Last, because it reloads the document.
    // The choice reloads the document. A click, not `check()`: check re-reads the radio after
    // clicking, and once the reload has switched the page to English its Ukrainian legend no
    // longer matches, so the re-read waits for ever whenever the reload wins the race.
    await radio(page, 'Мова інтерфейсу', 'English').click({ noWaitAfter: true })
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    const expectAllInForce = async (target: Page): Promise<void> => {
      await expect(target.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
      await expect(radio(target, 'Theme', 'Dark')).toBeChecked()
      await expect(html(target)).toHaveAttribute('data-theme', 'dark')
      await expect(radio(target, 'Motion', 'Reduced')).toBeChecked()
      await expect(html(target)).toHaveAttribute('data-motion', 'reduced')
      await expect(target.getByRole('checkbox', { name: 'Sound' })).toBeChecked()
      await expect(html(target)).toHaveAttribute('data-sound', 'on')
      await expect(target.getByRole('slider', { name: 'Exercise text size' })).toHaveValue('34')
      await expect(radio(target, 'Mistakes while typing', 'Correct freely')).toBeChecked()
      await expect(radio(target, 'Typing language', 'English')).toBeChecked()
      await expect(radio(target, 'Keyboard layout', 'QWERTY')).toBeChecked()
      await expect(radio(target, 'Interface language', 'English')).toBeChecked()
    }

    await page.reload()
    await expectAllInForce(page)

    const restarted = await restartBrowser(browser, page.context(), baseURL)
    try {
      await restarted.page.goto('/settings')
      await expectAllInForce(restarted.page)
    } finally {
      await restarted.context.close()
    }
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
  })
  return { context, page: await context.newPage() }
}

// ---------------------------------------------------------------------------------------------
// Keyboard-only operation (FR-066, SC-011)
// ---------------------------------------------------------------------------------------------

/** A seeded learner with one recorded attempt, so that every screen has something to show. */
async function seedLearner(page: Page, theme: 'light' | 'dark' | 'lowVision' = 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const completedAt = Date.now() - 3_600_000
  const envelope = {
    settings: { ...MOTION_OFF_SETTINGS, theme },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts: [
      {
        id: 'r1',
        scaleId: ANCHORS,
        layoutId: 'yq',
        language: 'uk',
        mode: 'test',
        seed: 1,
        startedAt: completedAt - 15_000,
        completedAt,
        elapsedMs: 15_000,
        metrics: {
          spm: 240,
          wpm: 48,
          accuracy: 0.98,
          errorCount: 1,
          errorsByChar: { а: 1 },
          rhythmConsistency: { value: 88, breaksExcluded: 0 },
          meanIkiByKey: { а: 210, о: 380 },
          meanIkiByTransition: { 'ф>і': 520, 'і>в': 250, 'в>а': 210 },
        },
        aggregates: { keys: {}, transitions: {} },
      },
    ],
  }
  await seedStore(page, envelope)
}

interface Traversal {
  readonly reached: readonly string[]
  readonly missed: readonly string[]
  readonly invisibleFocus: readonly string[]
}

/**
 * Whether Tab stops on links in this engine. WebKit follows Safari's platform default: Tab moves
 * between form controls only, and links join the order only with "Press Tab to highlight each
 * item" switched on (or Option+Tab on macOS, which Playwright's WebKit on other platforms does not
 * emulate). That is the browser's choice, not a gap in the page, so on WebKit the traversal expects
 * every control *except* plain links; Chromium and Firefox still prove the links are reachable.
 */
function tabStopsOnLinks(page: Page): boolean {
  return page.context().browser()?.browserType().name() !== 'webkit'
}

/**
 * Tabs through the page and reports which tab stops were reached, which were not, and where focus
 * gave no visible sign. Radio groups are one tab stop each, by the platform's own rule, so the
 * expectation counts a group once; arrow keys inside a group are checked separately.
 */
async function traverse(page: Page): Promise<Traversal> {
  await page.evaluate((linksTabbable) => {
    const ids = new Map<Element, number>()
    const label = (element: Element): string => {
      // A number makes two radios, or two links with one name, two different stops.
      if (!ids.has(element)) ids.set(element, ids.size)
      const text = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim()
      return `${element.tagName.toLowerCase()}:${text.slice(0, 40)}#${ids.get(element)}`
    }
    const visible = (element: Element): boolean => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
    }
    const candidates = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, summary, [tabindex]',
      ),
    ].filter((element) => {
      if ((element as HTMLButtonElement).disabled) return false
      if (element.tabIndex < 0) return false
      if (
        !linksTabbable &&
        element instanceof HTMLAnchorElement &&
        !element.hasAttribute('tabindex')
      ) {
        return false
      }
      // The skip link is visually hidden until focused; it is still a real tab stop.
      return visible(element) || element.classList.contains('sr-only')
    })
    const seenGroups = new Set<string>()
    const stops = candidates.filter((element) => {
      if (!(element instanceof HTMLInputElement) || element.type !== 'radio') return true
      if (seenGroups.has(element.name)) return false
      const checked = document.querySelector(`input[type="radio"][name="${element.name}"]:checked`)
      if (checked !== null && checked !== element) return false
      seenGroups.add(element.name)
      return true
    })
    const bag = window as unknown as { __stops: HTMLElement[]; __label: typeof label }
    bag.__stops = stops
    bag.__label = label
    for (const stop of stops)
      label(stop)
      // Start from the top of the document. A screen may autofocus its main action (the pre-start
      // focuses «Почати»); `body.focus()` alone moves Chromium's starting point but not Firefox's,
      // which then tabs on from the autofocused button and wraps through the browser's own UI.
      // A focusable body, focused and released, resets the starting point in every engine.
    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.tabIndex = -1
    document.body.focus()
    document.body.removeAttribute('tabindex')
  }, tabStopsOnLinks(page))

  const expected = await page.evaluate(
    () =>
      (window as unknown as { __stops: HTMLElement[]; __label: (e: Element) => string }).__stops
        .length,
  )
  const reached = new Set<string>()
  const invisibleFocus: string[] = []

  for (let i = 0; i < expected + 4; i += 1) {
    await page.keyboard.press('Tab')
    const step = await page.evaluate(() => {
      const bag = window as unknown as { __stops: HTMLElement[]; __label: (e: Element) => string }
      const active = document.activeElement
      if (active === null || active === document.body) return null
      const style = getComputedStyle(active)
      const outlined = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
      const shadowed = style.boxShadow !== 'none'
      return {
        label: bag.__label(active),
        known: bag.__stops.includes(active as HTMLElement),
        focusVisible: active.matches(':focus-visible'),
        visibleRing: outlined || shadowed,
      }
    })
    if (step === null) continue
    if (reached.has(step.label) && step.known) break
    reached.add(step.label)
    if (!step.focusVisible || !step.visibleRing) invisibleFocus.push(step.label)
  }

  const missed = await page.evaluate(
    (stops) => {
      const bag = window as unknown as { __stops: HTMLElement[]; __label: (e: Element) => string }
      return bag.__stops
        .map((element) => bag.__label(element))
        .filter((label) => !stops.includes(label))
    },
    [...reached],
  )
  return { reached: [...reached], missed, invisibleFocus }
}

test.describe('US5 keyboard only (scenario 8, FR-066)', () => {
  for (const [name, path] of [
    ['the product page', '/'],
    ['Today', '/today'],
    ['Map', '/map'],
    ['the exercise pre-start', `/exercise/${ANCHORS}?mode=practice`],
    ['a result', '/result/r1'],
    ['the session intro', '/session'],
    ['Settings', '/settings'],
    ['Formulas', '/formulas'],
  ] as const) {
    test(`${name}: every action is reachable by Tab and focus is always visible`, async ({
      page,
    }) => {
      await seedLearner(page)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

      const result = await traverse(page)
      expect(result.reached.length, 'Tab reached something').toBeGreaterThan(2)
      expect(result.missed, `tab stops never reached on ${path}`).toEqual([])
      expect(result.invisibleFocus, `focus with no visible ring on ${path}`).toEqual([])
    })
  }

  test('a radio group is operable with the arrow keys and shows which option is chosen (scenario 8)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/settings')

    await radio(page, 'Тема', 'Світла').focus()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, 'Тема', 'Темна')).toBeChecked()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await page.keyboard.press('ArrowLeft')
    await expect(radio(page, 'Тема', 'Світла')).toBeChecked()
  })

  test('a whole attempt can be started, paused and left from the keyboard alone (scenario 8)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto('/today')

    // Tab to a named control and press Enter: no pointer anywhere in this test.
    const press = async (name: string | RegExp): Promise<void> => {
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press('Tab')
        const match = await page.evaluate(
          ({ source, flags }) => {
            const active = document.activeElement
            const text = active?.getAttribute('aria-label') ?? active?.textContent ?? ''
            return new RegExp(source, flags).test(text.trim())
          },
          name instanceof RegExp
            ? { source: name.source, flags: name.flags }
            : { source: `^${escaped(name)}$`, flags: '' },
        )
        if (match) {
          await page.keyboard.press('Enter')
          return
        }
      }
      throw new Error(`Tab never reached ${String(name)}`)
    }

    await press('Почати')
    await expect(page).toHaveURL(/\/exercise\//)
    await press('Почати')
    await expect(page.getByTestId('typing-line')).toBeVisible()

    // Escape pauses a running attempt, and an attempt runs from its first character.
    const first = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeChar(page, [...first][0] ?? '')
    // Escape pauses, Enter on the focused Resume carries on, and the attempt is still running.
    await page.keyboard.press('Escape')
    const dialog = page.getByRole('dialog', { name: 'Пауза' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Продовжити' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
  })

  test('a marked error is not colour alone: it carries an underline and sits beside a count (scenario 8)', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto(`/exercise/${ANCHORS}?mode=test`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()

    await typeChar(page, 'ъ')
    const marked = page.getByTestId('typing-line').locator('[data-mark="wrong"]')
    await expect(marked).toHaveCount(1)
    const shadow = await marked.evaluate((node) => getComputedStyle(node).boxShadow)
    // The inset bar under the glyph: a shape, which survives a colour-blind reader.
    expect(shadow).toContain('inset')
    await expect(page.getByTestId('error-count')).toHaveText('1')
  })
})

// ---------------------------------------------------------------------------------------------
// The axe audit across every F1 screen (SC-011)
// ---------------------------------------------------------------------------------------------

test.describe('US5 accessibility audit of every screen (SC-011)', () => {
  for (const [name, path] of [
    ['the product page', '/'],
    ['Today', '/today'],
    ['Map', '/map'],
    ['the exercise pre-start', `/exercise/${ANCHORS}?mode=practice`],
    ['a result', '/result/r1'],
    ['the session intro', '/session'],
    ['Settings', '/settings'],
    ['Formulas', '/formulas'],
    ['Licences', '/licences'],
    ['Privacy', '/privacy'],
    ['About', '/about'],
  ] as const) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await seedLearner(page)
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await audit(page)
    })
  }

  test('every step of the first run has no accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/today')
    await expect(page.getByRole('heading', { name: 'Якою мовою друкуємо?' })).toBeVisible()
    await audit(page)
    await openLevelStep(page)
    await audit(page)
    await page.getByRole('button', { name: /Не знаю — перевірити себе/ }).click()
    await expect(page.getByRole('heading', { name: 'Надрукуй рядок' })).toBeVisible()
    await audit(page)
    await page.keyboard.press('Escape')
    await page.getByRole('radio', { name: /Ще не друкую наосліп/ }).check()
    await page.getByTestId('first-run-next').click()
    await expect(page.getByRole('heading', { name: 'Кожна клавіша — своєму пальцю' })).toBeVisible()
    await audit(page)
  })

  test('the typing screen and its pause dialog have no accessibility violations', async ({
    page,
  }) => {
    await seedLearner(page)
    await page.goto(`/exercise/${ANCHORS}?mode=practice`)
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    await expect(page.getByTestId('typing-line')).toBeVisible()
    await audit(page)

    // Escape pauses a running attempt, and an attempt runs from its first character.
    const first = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
    await typeChar(page, [...first][0] ?? '')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Пауза' })).toBeVisible()
    await audit(page)
  })

  // The dark theme and the low-vision preset are themes of their own, so a pass in light proves
  // nothing about them: contrast is a property of the palette.
  for (const theme of ['dark', 'lowVision'] as const) {
    for (const [name, path] of [
      ['Today', '/today'],
      ['Map', '/map'],
      ['a result', '/result/r1'],
      ['Settings', '/settings'],
      ['Formulas', '/formulas'],
      ['the exercise pre-start', `/exercise/${ANCHORS}?mode=practice`],
    ] as const) {
      test(`${name} in the ${theme} theme has no accessibility violations`, async ({ page }) => {
        await seedLearner(page, theme)
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await expect(html(page)).toHaveAttribute(
          'data-theme',
          theme === 'lowVision' ? 'low-vision' : theme,
        )
        await audit(page)
      })
    }
  }

  // The screens the game shell added after the audit above was written, in all three themes. The
  // Races lobby and Community ask the backend for their content (or say calmly that it is away),
  // so the audit waits for the network to go quiet: either way it audits the settled screen.
  for (const theme of ['light', 'dark', 'lowVision'] as const) {
    for (const [name, path] of [
      ['the Races lobby', '/races'],
      ['Profile', '/profile'],
      ['Community', '/groups'],
      ['the leaderboards', '/leaderboards'],
    ] as const) {
      test(`${name} in the ${theme} theme has no accessibility violations`, async ({ page }) => {
        await seedLearner(page, theme)
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expect(html(page)).toHaveAttribute(
          'data-theme',
          theme === 'lowVision' ? 'low-vision' : theme,
        )
        await audit(page)
      })
    }

    test(`the running typing screen with its keyboard in the ${theme} theme has no accessibility violations`, async ({
      page,
    }) => {
      await seedLearner(page, theme)
      await page.goto(`/exercise/${ANCHORS}?mode=practice`)
      await page.getByRole('button', { name: 'Почати', exact: true }).click()
      await expect(page.getByTestId('keyboard-guide')).toBeVisible()
      await audit(page)
    })

    test(`the first run's finger scheme in the ${theme} theme has no accessibility violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await seedStore(page, {
        settings: { ...MOTION_OFF_SETTINGS, theme },
        startingLevelByLanguage: {},
      } as never)
      await page.goto('/today')
      await openLevelStep(page)
      await page.getByRole('radio', { name: /Ще не друкую наосліп/ }).check()
      await page.getByTestId('first-run-next').click()
      await expect(page.getByTestId('finger-scheme')).toBeVisible()
      await audit(page)
    })
  }
})
