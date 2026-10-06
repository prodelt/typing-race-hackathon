import type { Page } from '@playwright/test'
import { keyOf, layouts } from '../../packages/curriculum/src/layout/index'
import type { LayoutId } from '../../packages/domain/src/index'
import { HAND_GAP_MS } from './type.js'

/**
 * The real-input driver — Chromium only, through the DevTools Protocol.
 *
 * `e2e/harness/type.ts` feeds the product's input path (`beforeinput`) straight into the hidden
 * textarea. That judges characters well, but it cannot see whether the page has keyboard focus, and
 * it cannot see a key that never arrives: a Race whose textarea was never focused passed every such
 * spec. This driver sends `Input.dispatchKeyEvent` instead, the same stream a physical keyboard
 * makes, so a key reaches the page only if the page can actually receive keys.
 *
 * `code` (the physical key) and `text` (what the active layout produces) are sent independently,
 * which is what makes a wrong Active layout expressible: the learner presses the keys of a ЙЦУКЕН
 * text while the operating system is on US.
 *
 * Specs using it carry `@cdp` and run in the `cdp` project, which is Chromium only.
 */

export interface RealKeyboard {
  /**
   * Presses the physical keys of `text` as written on the `intended` layout (default: the active
   * one), letting the active layout decide what each key produces.
   */
  type(text: string, options?: { intended?: LayoutId; delayMs?: number }): Promise<void>
  backspace(): Promise<void>
  escape(): Promise<void>
  /** The page's focused element is a textarea: the one place the product reads typing from. */
  focusIsOnTypingSurface(): Promise<boolean>
  detach(): Promise<void>
}

// CDP wants a Windows virtual key code for keys that produce no text.
const BACKSPACE = { code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 } as const
const ESCAPE = { code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 } as const
const SHIFT = 8

/**
 * What a real US layout prints on the keys the curriculum's QWERTY leaves out. The curriculum lists
 * only the keys an English exercise uses, but the operating system's layout has them all: on US the
 * ЙЦУКЕН keys of «х», «ї», «ґ» and «.» print signs. Typing the ЙЦУКЕН letter for them instead made
 * a US keyboard that types «ї», a learner nobody can be.
 */
const US_KEYS_OUTSIDE_THE_CURRICULUM: Readonly<Record<string, readonly [string, string]>> = {
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Slash: ['/', '?'],
}

/**
 * What `active` prints on the physical key `code`, with whether Shift was held. A shifted sign the
 * curriculum does not list is typed as the key's plain sign: still a sign, which is all a layout
 * check reads. A key the layout has no entry for throws rather than guessing.
 */
function produced(active: LayoutId, code: string, shifted: boolean): string {
  const key = layouts[active].keys.find((candidate) => candidate.code === code)
  if (key !== undefined) return shifted ? (key.shifted ?? key.plain) : key.plain
  const outside = active === 'qwerty' ? US_KEYS_OUTSIDE_THE_CURRICULUM[code] : undefined
  if (outside === undefined) throw new Error(`the ${active} layout has no key ${code}`)
  return shifted ? outside[1] : outside[0]
}

/** One physical key press: the key, what the active layout types with it, and whether Shift is held. */
export interface Keystroke {
  readonly code: string
  readonly text: string
  readonly shifted: boolean
}

/** The key that types `char` on the `intended` layout, pressed with the system on `active`. */
export function keystrokeOf(char: string, active: LayoutId, intended: LayoutId): Keystroke {
  if (char === ' ') return { code: 'Space', text: ' ', shifted: false }
  const key = keyOf(layouts[intended], char)
  if (key === undefined) throw new Error(`${intended} has no key for «${char}»`)
  const shifted = key.shifted === char
  return { code: key.code, text: produced(active, key.code, shifted), shifted }
}

export async function realKeyboard(page: Page, active: LayoutId): Promise<RealKeyboard> {
  const context = page.context()
  if (context.browser()?.browserType().name() !== 'chromium') {
    throw new Error('realKeyboard needs the DevTools Protocol and is Chromium only')
  }
  const session = await context.newCDPSession(page)

  const press = async (code: string, text: string, shifted: boolean): Promise<void> => {
    const modifiers = shifted ? SHIFT : 0
    await session.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code,
      key: text,
      text,
      modifiers,
    })
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text, modifiers })
  }

  const tap = async (spec: typeof BACKSPACE | typeof ESCAPE): Promise<void> => {
    await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...spec })
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...spec })
  }

  return {
    async type(text, options = {}) {
      const intended = options.intended ?? active
      for (const char of text) {
        const stroke = keystrokeOf(char, active, intended)
        await press(stroke.code, stroke.text, stroke.shifted)
        // A hand's pace by default: the product does not count typing faster than a hand can type
        // (ADR-0003, 2026-10-06), and two CDP calls a key alone are far faster than that.
        await page.waitForTimeout(options.delayMs ?? HAND_GAP_MS)
      }
    },
    backspace: () => tap(BACKSPACE),
    escape: () => tap(ESCAPE),
    focusIsOnTypingSurface: () =>
      page.evaluate(() => document.activeElement instanceof HTMLTextAreaElement),
    async detach() {
      await session.detach()
    },
  }
}
