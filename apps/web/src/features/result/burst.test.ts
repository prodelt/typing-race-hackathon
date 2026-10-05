import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The unlock burst under the site's Content-Security-Policy (`worker-src 'self'`).
 *
 * `canvas-confetti` reads `useWorker` only when a cannon is *created* (`confetti.create`); the default
 * instance behind `confetti(options)` is created with `useWorker: true`, so it builds a `blob:` Worker the
 * policy blocks: a red console error at every key unlock, and a promise that never settles because
 * nothing is left to draw. The burst therefore owns its cannon and asks for no worker.
 */
const fire = vi.fn<(options: Record<string, unknown>) => Promise<null>>()
const create = vi.fn<(canvas: HTMLCanvasElement, options: Record<string, unknown>) => typeof fire>()
const defaultFire = vi.fn()

vi.mock('canvas-confetti', () => ({ default: Object.assign(defaultFire, { create }) }))

const { burst, burstOrigin } = await import('./burst.js')

const VIEWPORT = { width: 1000, height: 800 }

beforeEach(() => {
  fire.mockReset().mockResolvedValue(null)
  create.mockReset().mockReturnValue(fire)
  defaultFire.mockReset()
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('burst', () => {
  it('draws on its own cannon with no worker', async () => {
    await burst({ left: 0, top: 0, width: 100, height: 100 }, VIEWPORT)

    expect(create).toHaveBeenCalledTimes(1)
    const [, globals] = create.mock.calls[0] ?? []
    expect(globals).toMatchObject({ useWorker: false, disableForReducedMotion: true })
    expect(fire).toHaveBeenCalledTimes(1)
    // The default instance is the one that builds the blocked worker: never touch it.
    expect(defaultFire).not.toHaveBeenCalled()
  })

  it('keeps the canvas decorative and out of the way while it draws', async () => {
    let seen: HTMLCanvasElement | null = null
    fire.mockImplementation(async () => {
      seen = document.body.querySelector('canvas')
      return null
    })

    await burst(undefined, VIEWPORT)

    expect(seen).not.toBeNull()
    const canvas = seen as unknown as HTMLCanvasElement
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.style.pointerEvents).toBe('none')
    expect(canvas.style.position).toBe('fixed')
    // The cannon was handed that very canvas.
    expect(create.mock.calls[0]?.[0]).toBe(canvas)
  })

  it('removes its canvas when the burst is over', async () => {
    await burst(undefined, VIEWPORT)

    expect(document.body.querySelector('canvas')).toBeNull()
  })

  it('removes its canvas even when drawing fails', async () => {
    fire.mockRejectedValue(new Error('no 2d context'))

    await expect(burst(undefined, VIEWPORT)).rejects.toThrow('no 2d context')

    expect(document.body.querySelector('canvas')).toBeNull()
  })

  it('bursts from the card, as a fraction of the viewport', async () => {
    await burst({ left: 100, top: 200, width: 200, height: 400 }, VIEWPORT)

    const [options] = fire.mock.calls[0] ?? []
    expect(options).toMatchObject({ origin: { x: 0.2, y: 0.5 }, particleCount: 40 })
  })
})

describe('burstOrigin', () => {
  it('is the centre of the card over the viewport', () => {
    expect(burstOrigin({ left: 0, top: 0, width: 1000, height: 800 }, VIEWPORT)).toEqual({
      x: 0.5,
      y: 0.5,
    })
    expect(burstOrigin({ left: 500, top: 0, width: 500, height: 200 }, VIEWPORT)).toEqual({
      x: 0.75,
      y: 0.125,
    })
  })

  it('falls back to the middle of the viewport with no card', () => {
    expect(burstOrigin(undefined, VIEWPORT)).toEqual({ x: 0.5, y: 0.5 })
  })
})
