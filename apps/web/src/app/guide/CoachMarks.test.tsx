import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScreenKeys } from '../screenKeys.js'
import CoachMarks from './CoachMarks.js'

/**
 * The guide's keys: Enter steps on, Esc closes from wherever focus is, and neither reaches the
 * screen's own Enter and Esc underneath (Home's Esc, the result's Enter).
 */

const screenKeys = { Enter: vi.fn(), Escape: vi.fn() }

/** Home, as far as its guide can tell: the four things it points at, and Home's own shortcuts. */
function Home() {
  useScreenKeys(screenKeys)
  return (
    <main>
      <button type="button" data-guide="home-start">
        Почати
      </button>
      <a href="/races" data-guide="home-race">
        Перегони
      </a>
      <nav data-guide="rail" />
      <button type="button" data-guide="help">
        ?
      </button>
    </main>
  )
}

beforeEach(() => {
  // jsdom lays nothing out: every target reports one box so the guide counts it as on screen.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
    new DOMRect(0, 0, 10, 10),
  ] as unknown as DOMRectList)
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  screenKeys.Enter.mockReset()
  screenKeys.Escape.mockReset()
})

function open() {
  const onClose = vi.fn()
  const view = (guide: boolean) => (
    <>
      <Home />
      {guide ? <CoachMarks screen="home" onClose={onClose} /> : null}
    </>
  )
  // The guide opens over a screen that is already there, as the shell opens it.
  const { rerender } = render(view(false))
  rerender(view(true))
  return { onClose, close: () => rerender(view(false)) }
}

describe('CoachMarks keys', () => {
  it('steps on with Enter, without the screen taking it', async () => {
    const user = userEvent.setup()
    const { onClose } = open()
    expect(screen.getByText('1/4')).toBeTruthy()

    await user.keyboard('{Enter}')

    expect(screen.getByText('2/4')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(screenKeys.Enter).not.toHaveBeenCalled()
  })

  it('closes with Esc even when focus has left the bubble, before the screen can act on it', async () => {
    const user = userEvent.setup()
    const { onClose } = open()
    screen.getByText('Почати').focus()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(screenKeys.Escape).not.toHaveBeenCalled()
  })

  it('gives Esc back to the screen once it has closed', async () => {
    const user = userEvent.setup()
    const { onClose, close } = open()
    close()
    screen.getByText('Почати').focus()

    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screenKeys.Escape).toHaveBeenCalledOnce()
  })
})
