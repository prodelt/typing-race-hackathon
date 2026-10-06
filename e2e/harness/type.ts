import type { Locator, Page } from '@playwright/test'

/**
 * T068. The text-input driver.
 *
 * Research 06 proved by experiment that **Playwright cannot type Cyrillic through the keyboard
 * API in any engine** — `page.keyboard.press('й')` throws, and no engine produces a `keydown` for
 * it. Every Ukrainian scenario in this suite therefore drives the same path the browser itself
 * uses for an input method: `beforeinput` and `compositionend` on the hidden textarea.
 *
 * That is not a workaround around the product; it *is* the product's input path (ADR-0003). A test
 * that used the keyboard API would be exercising something the application never reads.
 *
 * Specs that use this driver carry the `@input` tag and run on all three engines from their first
 * commit — Firefox ignores `preventDefault()` on `beforeinput`, so a Chromium-only pass here would
 * be misleading rather than merely weaker (ADR-0009).
 */

/** The hidden textarea the engine listens on. */
export function typingSurface(page: Page): Locator {
  return page.getByTestId('typing-input')
}

async function dispatchBeforeInput(
  target: Locator,
  inputType: string,
  data: string | null,
): Promise<void> {
  await target.evaluate(
    (element, payload) => {
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: payload.inputType,
          data: payload.data,
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    { inputType, data },
  )
}

/**
 * Types one character, exactly as an ordinary keypress would arrive.
 *
 * One event per character rather than one for the whole string, because the engine judges per
 * keystroke and a single batched event would silently test the composition path instead.
 */
export async function typeChar(page: Page, char: string): Promise<void> {
  await dispatchBeforeInput(typingSurface(page), 'insertText', char)
}

/**
 * The gap between two characters typed by the harness, in milliseconds: about 1 300 SPM over an
 * exercise. Fast, but a hand's pace. The product does not count typing whose median interval is
 * under 25 ms or whose speed is above 1 500 SPM (ADR-0003, 2026-10-06), and 45 ms keeps a line of
 * a dozen characters or more under that ceiling with room for a timer that fires a little early.
 * The product has no test-only escape from the rule, so the harness types like a person instead.
 */
export const HAND_GAP_MS = 45

/**
 * Types a whole string, still one `beforeinput` per character, from **inside** the page.
 *
 * One Playwright round trip per character made a 60-character exercise cost 60 CDP calls, and under
 * a parallel full-suite run each call queues behind every other worker's: that, not the app, was
 * what pushed the long scenarios past their timeout. The loop yields a macrotask between characters
 * (`gapMs`, {@link HAND_GAP_MS} unless a longer delay is asked for) so the engine, React and the
 * router see the same sequence of separate keystrokes a learner produces, just without the
 * transport cost, and at a pace the product counts as typing by hand.
 */
export async function typeText(page: Page, text: string, delayMs = 0): Promise<void> {
  if (text.length === 0) return
  await typingSurface(page).evaluate(
    async (element, payload) => {
      for (const char of payload.chars) {
        element.dispatchEvent(
          new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: char,
            bubbles: true,
            cancelable: true,
          }),
        )
        await new Promise((resolve) => setTimeout(resolve, payload.gapMs))
      }
    },
    { chars: [...text], gapMs: Math.max(delayMs, HAND_GAP_MS) },
  )
}

export async function pressBackspace(page: Page): Promise<void> {
  await dispatchBeforeInput(typingSurface(page), 'deleteContentBackward', null)
}

/**
 * An input method committing several characters at once. The engine must judge them one at a time,
 * in order, never skipping one — and this is the only way to make that happen from a test.
 */
export async function composeText(page: Page, text: string): Promise<void> {
  const surface = typingSurface(page)
  await surface.evaluate((element, value) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertCompositionText',
        data: value,
        bubbles: true,
        cancelable: true,
      }),
    )
    element.dispatchEvent(new CompositionEvent('compositionend', { data: value, bubbles: true }))
  }, text)
}

/**
 * Types the awaited text but with one deliberate wrong character at `wrongAt`, corrected by
 * Backspace. This is requirements check §8.2 in one call: the error must stay counted afterwards.
 */
export async function typeWithCorrectedError(
  page: Page,
  text: string,
  wrongAt: number,
  wrongChar = 'ъ',
): Promise<void> {
  const characters = [...text]
  await typeText(page, characters.slice(0, wrongAt).join(''))
  await typeChar(page, wrongChar)
  await pressBackspace(page)
  await typeText(page, characters.slice(wrongAt).join(''))
}
