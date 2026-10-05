import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeKey } from './keys.js'

/** The screen under an overlay: its own shortcuts listen on the document, bubbling, like `useScreenKeys`. */
const screen = vi.fn()
const releases: (() => void)[] = []

function mount(): HTMLButtonElement {
  document.addEventListener('keydown', screen)
  releases.push(() => document.removeEventListener('keydown', screen))
  return document.body.appendChild(document.createElement('button'))
}

function press(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  for (const release of releases.splice(0)) release()
  screen.mockReset()
  document.body.replaceChildren()
})

describe('takeKey: a key an overlay takes before the screen under it', () => {
  it('reaches its handler wherever focus is, and the screen never sees it', () => {
    const elsewhere = mount()
    const handler = vi.fn()
    releases.push(takeKey('Escape', handler))

    const event = press(elsewhere, 'Escape')

    expect(handler).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
    expect(screen).not.toHaveBeenCalled()
  })

  it('lets every other key through to the screen untouched', () => {
    const elsewhere = mount()
    const handler = vi.fn()
    releases.push(takeKey('Escape', handler))

    const event = press(elsewhere, 'Enter')

    expect(handler).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(screen).toHaveBeenCalledOnce()
  })

  it('gives the key back once released', () => {
    const elsewhere = mount()
    const handler = vi.fn()
    const release = takeKey('Escape', handler)

    release()
    press(elsewhere, 'Escape')

    expect(handler).not.toHaveBeenCalled()
    expect(screen).toHaveBeenCalledOnce()
  })
})
