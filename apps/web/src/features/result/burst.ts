/**
 * The Key Unlock burst: one puff of confetti from the unlock card.
 *
 * `canvas-confetti` is imported dynamically (and only once `allowsCelebration` says yes, see
 * `UnlockCard`), so with motion reduced or off the chunk is never fetched.
 *
 * It draws on a canvas of its own, through its own cannon, and asks for **no worker**. The library's
 * default instance (`confetti(options)`) is created with `useWorker: true` and builds a `blob:` Worker;
 * the site's Content-Security-Policy says `worker-src 'self'`, so that worker is blocked: a red console
 * error at every unlock and a promise that never settles. The option is only read when a cannon is
 * created (`confetti.create`), never from a call's options, hence the cannon. Forty particles are
 * nothing for the main thread.
 */

/**
 * The confetti palette. Canvas cannot read CSS custom properties, so these repeat two tokens from
 * `tokens.css`: sage and cream paper.
 */
const CONFETTI_COLOURS = ['#4a7c59', '#faf9f5']

/** Above the shell, below nothing that can take focus: the canvas never receives input. */
const CANVAS_Z_INDEX = '100'

export interface BurstRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface BurstViewport {
  readonly width: number
  readonly height: number
}

/** One burst from the card's centre, as a fraction of the viewport; the middle with no card. */
export function burstOrigin(
  rect: BurstRect | undefined,
  viewport: BurstViewport,
): { readonly x: number; readonly y: number } {
  if (rect === undefined) return { x: 0.5, y: 0.5 }
  return {
    x: (rect.left + rect.width / 2) / viewport.width,
    y: (rect.top + rect.height / 2) / viewport.height,
  }
}

/** Resolves when the burst has been drawn and its canvas removed; rejects if drawing fails. */
export async function burst(rect: BurstRect | undefined, viewport: BurstViewport): Promise<void> {
  const { default: confetti } = await import('canvas-confetti')
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  // CSSOM writes, not a `style` attribute: the policy allows the first and blocks the second.
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = CANVAS_Z_INDEX
  document.body.appendChild(canvas)
  try {
    const fire = confetti.create(canvas, {
      resize: true,
      useWorker: false,
      disableForReducedMotion: true,
    })
    await fire({
      particleCount: 40,
      spread: 70,
      colors: CONFETTI_COLOURS,
      origin: burstOrigin(rect, viewport),
    })
  } finally {
    canvas.remove()
  }
}
