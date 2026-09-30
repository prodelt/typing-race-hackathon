import type { Page } from '@playwright/test'

/**
 * T069. The physical-layout driver — Chromium only, and the one thing in this suite that genuinely
 * cannot be done any other way.
 *
 * Research 06 established two facts. Playwright's keyboard API cannot type Cyrillic in **any**
 * engine, so `e2e/harness/type.ts` drives text-input events instead — that covers every scenario
 * about *judging* characters. But one scenario is about the keyboard itself: a learner whose
 * operating system is on a US layout opens a Ukrainian exercise, and FR-021 says the app must
 * notice before they start rather than after they have earned a screen of errors.
 *
 * Proving that needs a real physical layout, which means the DevTools Protocol:
 * `Input.dispatchKeyEvent` carries `code` (the physical key) and `text` (what the layout produces)
 * as independent fields, so a ЙЦУКЕН keyboard is `KeyF` producing `ф` while a US one is `KeyF`
 * producing `f`. Nothing in Playwright's own API can express that pair.
 *
 * Every spec using this is tagged `@cdp` and runs only in the `cdp` project.
 */

/** `KeyA`-style physical codes to what each layout produces, for the home row plus the probe key. */
const YQ_LAYOUT: Record<string, string> = {
  KeyA: 'ф',
  KeyS: 'і',
  KeyD: 'в',
  KeyF: 'а',
  KeyJ: 'о',
  KeyK: 'л',
  KeyL: 'д',
  Semicolon: 'ж',
}

const QWERTY_LAYOUT: Record<string, string> = {
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  KeyF: 'f',
  KeyJ: 'j',
  KeyK: 'k',
  KeyL: 'l',
  Semicolon: ';',
}

export const PHYSICAL_LAYOUTS = { yq: YQ_LAYOUT, qwerty: QWERTY_LAYOUT } as const
export type PhysicalLayoutId = keyof typeof PHYSICAL_LAYOUTS

export interface LayoutDriver {
  /** Presses one physical key and delivers whatever the active layout produces from it. */
  pressPhysical(code: string): Promise<void>
  detach(): Promise<void>
}

/**
 * Attaches a CDP session that types as if the operating system were on `layoutId`.
 *
 * Chromium only. Calling it elsewhere throws rather than degrading, because a silently degraded
 * layout test is worse than an absent one: it would pass while proving nothing.
 */
export async function attachPhysicalLayout(
  page: Page,
  layoutId: PhysicalLayoutId,
): Promise<LayoutDriver> {
  const context = page.context()
  if (context.browser()?.browserType().name() !== 'chromium') {
    throw new Error('attachPhysicalLayout needs the DevTools Protocol and is Chromium only')
  }

  const session = await context.newCDPSession(page)
  const layout = PHYSICAL_LAYOUTS[layoutId]

  return {
    async pressPhysical(code) {
      const text = layout[code]
      if (text === undefined) {
        throw new Error(`${layoutId} has no mapping for the physical key ${code}`)
      }
      // `code` is the physical key and `text` is what the layout produces from it. Sending both,
      // independently, is the whole point — it is what makes this a layout simulation rather than
      // a character injection.
      await session.send('Input.dispatchKeyEvent', { type: 'keyDown', code, text, key: text })
      await session.send('Input.dispatchKeyEvent', { type: 'char', text })
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text })
    },
    async detach() {
      await session.detach()
    },
  }
}
