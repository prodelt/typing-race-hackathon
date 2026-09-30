import type { Locator, Page } from '@playwright/test'
import { attachPhysicalLayout } from './harness/cdp-layout.js'
import {
  expect,
  expectNoAxeViolations,
  test as fixtureTest,
  MOTION_OFF_SETTINGS,
  seedStore,
} from './harness/fixtures.js'
import {
  composeText,
  pressBackspace,
  typeChar,
  typeText,
  typeWithCorrectedError,
  typingSurface,
} from './harness/type.js'

/**
 * T075, T076, T077. User Story 1, "Typing an exercise".
 *
 * Independent Test: open a Stage 1 scale in each language, type it once with a deliberate wrong key
 * and a Backspace correction, then type the same scale as a Test Attempt; the guides are rendered
 * in the first and absent in the second, and both attempts reach completion.
 *
 * Every keystroke here goes through the harness driver, because Playwright's keyboard API cannot
 * type Cyrillic in any engine. The input-path tests carry `@input` and so run on all three engines
 * from their first commit (ADR-0009): Firefox ignores `preventDefault()` on `beforeinput`, so a
 * Chromium-only pass on this path would be misleading rather than merely weaker.
 */

/**
 * The harness drives `getByTestId('typing-input')`, but the hidden textarea carries an accessible
 * name and no test id. The application is not ours to change, so this gives the one textarea the id
 * the driver expects, from outside, before any script of the app runs. It is a finding as well as
 * a shim: `data-testid="typing-input"` is missing from the exercise screen.
 */
const test = fixtureTest.extend({
  // The harness's own `calmPage` seeds an envelope without `startingLevelByLanguage`, and the
  // application then never leaves "Завантаження…" (boot reads a field that is not there). So this
  // spec seeds the complete envelope itself; the defect is in the report.
  calmPage: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      ...STARTING_LEVEL,
    })
    await use(page)
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const name = () => {
        for (const node of document.querySelectorAll('main textarea')) {
          // Only when missing: re-setting the same value is still an attribute mutation, and the
          // FR-069 observer below would count the shim's own writes against the application.
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

const STARTING_LEVEL = {
  startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
}

const UK_SCALE = 'yq.run.anchors'
const EN_SCALE = 'qwerty.run.anchors'

async function openExercise(
  page: Page,
  scaleId: string,
  mode: 'practice' | 'test' = 'practice',
): Promise<void> {
  await page.goto(`/exercise/${scaleId}?mode=${mode}`)
  await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeEnabled()
}

/** Leaves the pre-start screen. The attempt itself only begins on the first character (FR-012). */
async function begin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
}

function line(page: Page): Locator {
  return page.getByTestId('typing-line')
}

function characters(page: Page): Locator {
  return line(page).locator('.typing-line__char')
}

/** The exercise text, read the way a screen reader reads it: once, in full. */
async function exerciseText(page: Page): Promise<string> {
  return (await line(page).locator('p.sr-only').textContent()) ?? ''
}

async function states(page: Page): Promise<string[]> {
  return characters(page).evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset['state'] ?? ''),
  )
}

/** `offsetLeft` of every character: if any character moved, this list changes. */
async function positions(page: Page): Promise<number[]> {
  return characters(page).evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).offsetLeft),
  )
}

async function glyphs(page: Page): Promise<string[]> {
  return characters(page).evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''))
}

const SAME_AS_TYPED = (text: string): string => text.replace(/'/g, '’')

/**
 * Installs a `MutationObserver` over the whole document that records everything *outside* the typing
 * line. FR-069 is a claim about the DOM, so it is proved on the DOM: a number, a highlight or a
 * position that changed would show up here as a record, whatever caused it.
 */
async function watchOutsideTypingLine(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: string[] = []
    const describe = (node: Node): string | null => {
      const element = node instanceof Element ? node : node.parentElement
      if (element === null) return 'detached'
      if (element.closest('[data-testid="typing-line"]') !== null) return null
      const owner = element.closest('[data-testid]')
      return owner?.getAttribute('data-testid') ?? element.tagName.toLowerCase()
    }
    const record = (records: MutationRecord[]): void => {
      for (const entry of records) {
        const where = describe(entry.target)
        if (where !== null) seen.push(`${entry.type}:${entry.attributeName ?? ''}@${where}`)
      }
    }
    const observer = new MutationObserver(record)
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    const bag = window as unknown as {
      __outside: () => string[]
    }
    bag.__outside = () => {
      record(observer.takeRecords())
      return [...seen]
    }
  })
}

async function outsideTypingLine(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __outside: () => string[] }).__outside())
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

test.describe('US1 typing an exercise', { tag: '@input' }, () => {
  test('the attempt begins on the first printable character and shows it as correct (scenario 1)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)
    await begin(page)

    // Starting is not typing: the line is idle until a character arrives, so a learner who
    // pauses on the pre-start screen is never already being timed.
    await expect(line(page)).not.toHaveAttribute('data-state', 'running')
    await expect(characters(page).first()).toHaveAttribute('data-state', 'awaited')

    const text = await exerciseText(page)
    await typeChar(page, [...text][0] ?? '')

    await expect(line(page)).toHaveAttribute('data-state', 'running')
    await expect(characters(page).first()).toHaveAttribute('data-state', 'typed')
    await expect(characters(page).nth(1)).toHaveAttribute('data-state', 'awaited')
    await expect(page.getByTestId('error-count')).toHaveText('0')
  })

  test('a wrong key marks the awaited character in place and moves nothing (scenario 2, §8.2)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)
    await begin(page)

    const text = await exerciseText(page)
    await typeText(page, [...text].slice(0, 2).join(''))

    const glyphsBefore = await glyphs(page)
    const positionsBefore = await positions(page)
    const statesBefore = await states(page)

    await typeChar(page, 'ъ')

    const awaited = characters(page).nth(2)
    await expect(awaited).toHaveAttribute('data-mark', 'wrong')
    await expect(awaited).toHaveAttribute('data-state', 'awaited')
    await expect(page.getByTestId('error-count')).toHaveText('1')

    // "Colour, a tint and an underline" (FR-016): three cues, so that none is colour alone.
    const marked = await awaited.evaluate((node) => {
      const style = getComputedStyle(node)
      return { color: style.color, background: style.backgroundColor, shadow: style.boxShadow }
    })
    expect(marked.shadow).toContain('inset')
    expect(marked.background).not.toBe('rgba(0, 0, 0, 0)')

    // Nothing moved: same glyphs, same x positions, same state for every character.
    expect(await glyphs(page)).toEqual(glyphsBefore)
    expect(await positions(page)).toEqual(positionsBefore)
    expect(await states(page)).toEqual(statesBefore)

    // The marked character does not look like the unmarked awaited one.
    await pressBackspace(page)
    await expect(awaited).not.toHaveAttribute('data-mark', 'wrong')
    const unmarked = await awaited.evaluate((node) => {
      const style = getComputedStyle(node)
      return { color: style.color, background: style.backgroundColor }
    })
    expect(marked.color).not.toBe(unmarked.color)
    expect(marked.background).not.toBe(unmarked.background)
  })

  test('Backspace then the right key clears the mark, advances, and never lowers the error count (scenario 3, §8.2)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)
    await begin(page)

    const text = [...(await exerciseText(page))]
    await typeText(page, text.slice(0, 2).join(''))
    await typeChar(page, 'ъ')
    await expect(page.getByTestId('error-count')).toHaveText('1')

    await pressBackspace(page)
    // The Backspace alone must not refund the error: that is the whole of requirement §8.2.
    await expect(page.getByTestId('error-count')).toHaveText('1')
    await expect(characters(page).nth(2)).not.toHaveAttribute('data-mark', 'wrong')

    await typeChar(page, text[2] ?? '')
    await expect(characters(page).nth(2)).toHaveAttribute('data-state', 'typed')
    await expect(characters(page).nth(3)).toHaveAttribute('data-state', 'awaited')
    await expect(page.getByTestId('error-count')).toHaveText('1')

    // And it is still 1 at the end: type the rest and read the result.
    await typeText(page, text.slice(3).join(''))
    await expect(page).toHaveURL(/\/result\//)
    await expect(page.getByRole('region', { name: 'Головні показники' })).toContainText(
      /Помилки\s*1/,
    )
  })

  for (const [language, settings, scaleId, wrong] of [
    ['Ukrainian', { ...MOTION_OFF_SETTINGS }, UK_SCALE, 'ъ'],
    [
      'English',
      { ...MOTION_OFF_SETTINGS, typingLanguage: 'en', layoutId: 'qwerty' },
      EN_SCALE,
      '7',
    ],
  ] as const) {
    test(`the ${language} scale is typed with a corrected error, then as a Test Attempt (Independent Test)`, async ({
      page,
    }) => {
      await seedStore(page, { settings, ...STARTING_LEVEL })

      // First pass: a Practice Attempt with one deliberate wrong key and its Backspace.
      await openExercise(page, scaleId, 'practice')
      await begin(page)
      await expect(page.getByTestId('keyboard-guide')).toBeVisible()
      await typeWithCorrectedError(page, await exerciseText(page), 3, wrong)
      await expect(page).toHaveURL(/\/result\//)
      await expect(page.getByRole('region', { name: 'Головні показники' })).toContainText(
        /Помилки\s*1/,
      )

      // Second pass: the same scale as a Test Attempt. Guides gone, and it still completes.
      await openExercise(page, scaleId, 'test')
      await begin(page)
      await expect(page.getByTestId('keyboard-guide')).toHaveCount(0)
      await typeText(page, await exerciseText(page))
      await expect(page).toHaveURL(/\/result\//)
      await expect(page.getByRole('region', { name: 'Головні показники' })).toContainText(
        /Помилки\s*0/,
      )
    })
  }

  test('a Practice Attempt shows the keyboard, the next-key highlight and the finger diagram (scenario 4)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE, 'practice')
    await begin(page)

    await expect(page.getByTestId('keyboard-guide')).toBeVisible()
    await expect(page.getByTestId('next-key')).toBeVisible()
    await expect(page.getByTestId('finger-diagram')).toBeVisible()

    const text = [...(await exerciseText(page))]
    const first = text[0] ?? ''

    // The awaited key is the one highlighted: filled solid in the brand red and ringed in the same
    // red, with its letter in white, so it is found without searching.
    const awaited = page.getByTestId('keyboard-guide').locator('[data-awaited="true"]')
    await expect(awaited).toHaveCount(1)
    await expect(awaited).toHaveText(first)
    const ring = await awaited.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        style: style.outlineStyle,
        outline: style.outlineColor,
        fill: style.backgroundColor,
        ink: style.color,
      }
    })
    expect(ring.style).toBe('solid')
    expect(ring.fill).toBe('rgb(194, 31, 19)')
    expect(ring.outline).toBe(ring.fill)
    expect(ring.ink).toBe('rgb(255, 255, 255)')

    // The finger is named in words as well as colour (FR-061).
    await expect(page.getByTestId('next-key')).toContainText(/мізинець|палець/)
    await expect(
      page.getByTestId('finger-diagram').locator('[data-active="true"]'),
    ).not.toHaveCount(0)

    // And the highlight follows the learner.
    await typeChar(page, first)
    const second = text[1] ?? ''
    await expect(page.getByTestId('keyboard-guide').locator('[data-awaited="true"]')).toHaveText(
      second,
    )
  })

  test('a Test Attempt has none of the four guides in the page at all (scenario 5, FR-037, SC-007)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE, 'test')
    await begin(page)

    const text = await exerciseText(page)
    await typeText(page, [...text].slice(0, 12).join(''))

    // Absent from the DOM, never merely hidden: a hidden node is still readable by an extension,
    // still in the accessibility tree, and one `display` toggle from a learner's curiosity.
    for (const id of [
      'keyboard-guide',
      'next-key',
      'finger-diagram',
      'live-metrics',
      'live-speed',
      'live-accuracy',
      'live-errors',
      'live-time',
    ]) {
      await expect(page.getByTestId(id), `${id} must not exist in a Test Attempt`).toHaveCount(0)
    }

    // What remains is feedback, not a secret: time, errors and progress.
    await expect(page.getByTestId('elapsed-time')).toBeVisible()
    await expect(page.getByTestId('error-count')).toBeVisible()
    await expect(page.getByTestId('progress')).toBeVisible()
    await expect(page.getByTestId('progress')).not.toHaveAttribute('aria-valuenow', '0')
  })

  test('Alt, an input-method key and a dead key end nothing, consume nothing and count nothing (scenario 6, FR-020)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)
    await begin(page)

    const text = [...(await exerciseText(page))]
    await typeChar(page, text[0] ?? '')

    const statesBefore = await states(page)

    const surface = typingSurface(page)
    await surface.focus()
    await page.keyboard.press('Alt')
    // A dead key resolves later and fires no input event of its own.
    await surface.evaluate((node) => {
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Dead', bubbles: true }))
    })
    // An input method that opens and closes a composition without committing anything.
    await composeText(page, '')

    await expect(page.getByTestId('error-count')).toHaveText('0')
    expect(await states(page)).toEqual(statesBefore)
    await expect(line(page)).toHaveAttribute('data-state', 'running')

    // The attempt is still alive: finish it.
    await typeText(page, text.slice(1).join(''))
    await expect(page).toHaveURL(/\/result\//)
    await expect(page.getByRole('region', { name: 'Головні показники' })).toContainText(
      /Помилки\s*0/,
    )
  })

  test('Escape pauses, names the finger for the last error, and resuming does not restart (scenario 7, FR-022)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)
    await begin(page)

    const text = [...(await exerciseText(page))]
    await typeText(page, text.slice(0, 3).join(''))
    await typeChar(page, 'ъ')

    // FR-022: the sentence exists on request only, never inline while the attempt runs.
    await expect(page.getByTestId('pause-sentence')).toHaveCount(0)

    await typingSurface(page).focus()
    await page.keyboard.press('Escape')

    const dialog = page.getByRole('dialog', { name: 'Пауза' })
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('pause-sentence')).toContainText('натиснуто «ъ»')
    await expect(page.getByTestId('pause-sentence')).toContainText(/мізинець|палець/)

    await dialog.getByRole('button', { name: 'Продовжити' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('pause-sentence')).toHaveCount(0)

    // Not a restart: three characters are still typed, and the error is still counted.
    const after = await states(page)
    expect(after.slice(0, 3)).toEqual(['typed', 'typed', 'typed'])
    await expect(page.getByTestId('error-count')).toHaveText('1')

    // Typing carries on from where it stopped.
    await pressBackspace(page)
    await typeText(page, text.slice(3).join(''))
    await expect(page).toHaveURL(/\/result\//)
  })

  test('between two keystrokes nothing outside the typing line changes in a Test Attempt (scenario 9, FR-069)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE, 'test')
    await begin(page)
    await watchOutsideTypingLine(page)

    const text = [...(await exerciseText(page))]
    // Right keys, a wrong key, a Backspace and the keys after it: every kind of keystroke.
    await typeText(page, text.slice(0, 8).join(''))
    await typeChar(page, 'ъ')
    await pressBackspace(page)
    await typeText(page, text.slice(8, 20).join(''))

    expect(await outsideTypingLine(page)).toEqual([])

    // A control, so that an empty list means "nothing changed" and not "the observer is deaf".
    await page.evaluate(() => document.body.setAttribute('data-probe', 'x'))
    expect(await outsideTypingLine(page)).toEqual(['attributes:data-probe@body'])
  })

  test('in a Practice Attempt only the guide itself follows the keystroke (scenario 9, FR-069)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE, 'practice')
    await begin(page)
    await watchOutsideTypingLine(page)

    const text = [...(await exerciseText(page))]
    await typeText(page, text.slice(0, 8).join(''))
    await typeChar(page, 'ъ')
    await pressBackspace(page)
    await typeText(page, text.slice(8, 20).join(''))

    // Scenario 4 requires the awaited key to be highlighted, so the three guide components *must*
    // move with the keystroke; that is the guide itself, and ticket 20 names it as the one
    // exception. Everything else — the rail, the last-result figures (FR-059), the navigation —
    // must not change by so much as an attribute. A record anywhere else fails this test.
    const guides = new Set(['keyboard-guide', 'next-key', 'finger-diagram'])
    const seen = await outsideTypingLine(page)
    // The guides did move, so the observer is alive; and nothing else did.
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter((entry) => !guides.has(entry.slice(entry.lastIndexOf('@') + 1)))).toEqual([])
  })

  for (const [char, scaleId, substitute] of [
    ['і', UK_SCALE, 'и'],
    ['є', 'yq.run.Quote', 'е'],
    ['ї', 'yq.vertical.BracketRight', 'і'],
    ['ґ', 'yq.modifiers.Backslash', 'г'],
  ] as const) {
    test(`«${char}» is judged as itself and never substituted (scenario 10, FR-006, §8.5)`, async ({
      page,
    }) => {
      // Every letter open, so the exercise can carry the four Ukrainian-only characters.
      const envelope = {
        settings: { ...MOTION_OFF_SETTINGS },
        startingLevelByLanguage: { uk: 'touchTypesWantsAccuracy' },
      }
      await seedStore(page, envelope)
      await openExercise(page, scaleId)
      await begin(page)

      const text = [...SAME_AS_TYPED(await exerciseText(page))]
      const at = text.indexOf(char)
      expect(at, `the exercise should contain «${char}»`).toBeGreaterThanOrEqual(0)

      await typeText(page, text.slice(0, at).join(''))
      const errorsBefore = Number(await page.getByTestId('error-count').textContent())

      // The look-alike is a different letter: it is an error, and the caret does not move.
      await typeChar(page, substitute)
      await expect(page.getByTestId('error-count')).toHaveText(String(errorsBefore + 1))
      await expect(characters(page).nth(at)).toHaveAttribute('data-state', 'awaited')
      await expect(characters(page).nth(at)).toHaveAttribute('data-mark', 'wrong')
      await pressBackspace(page)

      // The character itself is accepted as the character itself.
      await typeChar(page, char)
      await expect(characters(page).nth(at)).toHaveAttribute('data-state', 'typed')
      await expect(characters(page).nth(at)).toHaveText(char)
    })
  }

  test('the typing screen has no accessibility violations in either mode (T077)', async ({
    calmPage: page,
  }) => {
    for (const mode of ['practice', 'test'] as const) {
      await openExercise(page, UK_SCALE, mode)
      await audit(page)
      await begin(page)
      await audit(page)
    }
  })
})

test.describe('US1 layout check', { tag: '@cdp' }, () => {
  test('a Ukrainian exercise on an English layout reports the mismatch and does not start (scenario 8, FR-021)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)

    // The operating system is on a US layout: physical F produces `f`, not `а`.
    const driver = await attachPhysicalLayout(page, 'qwerty')
    await typingSurface(page).focus()
    await driver.pressPhysical('KeyF')

    const mismatch = page.getByTestId('layout-mismatch')
    await expect(mismatch).toBeVisible()
    // It names the layout the exercise needs, in words (FR-066: never colour alone).
    await expect(mismatch).toContainText('ЙЦУКЕН')
    await expect(mismatch).toHaveAttribute('role', 'alert')

    // The attempt does not start: Start is unavailable and no typing line exists.
    await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeDisabled()
    await expect(page.getByTestId('typing-line')).toHaveCount(0)

    await driver.detach()
  })

  test('the same exercise on a ЙЦУКЕН layout starts normally (scenario 8, the converse)', async ({
    calmPage: page,
  }) => {
    await openExercise(page, UK_SCALE)

    // Without this, a check that always reported a mismatch would pass the test above.
    const driver = await attachPhysicalLayout(page, 'yq')
    await typingSurface(page).focus()
    await driver.pressPhysical('KeyF')

    await expect(page.getByTestId('layout-mismatch')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Почати', exact: true })).toBeEnabled()
    await driver.detach()
  })
})
