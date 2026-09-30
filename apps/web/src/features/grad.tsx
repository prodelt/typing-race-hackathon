import { type CSSProperties, useEffect, useRef } from 'react'
import './grad.css'

/**
 * The brand site's live gradient (b-red v4 `grad.js`, scheme B), ported as a React layer.
 *
 * Soft radial-gradient blobs drift behind an emphasis panel; only `transform` moves, so the
 * compositor does all the work and nothing is repainted. Two palettes, as on the brand site:
 * `bright` (blush, for light panels, ink text) and `ember` (brand red to its dark step, white text:
 * its lightest point is #c21f13, so white text stays at 6:1 or better anywhere on it).
 *
 * Motion follows the one app-level flag: at `reduced` every blob holds still in its own phase (a
 * static frame), at `off` the tokens stop every animation, and the panel's own CSS background (a
 * static gradient under the layer) is the whole picture. A layer out of view, or in a background
 * tab, is paused.
 *
 * Blob positions come from a seeded generator, so a panel looks the same on every visit.
 */

export type GradTone = 'bright' | 'ember'

interface Palette {
  readonly base: string
  readonly speed: number
  readonly grain: number
  /** [colour, opacity at the centre, relative size] */
  readonly blobs: readonly (readonly [string, number, number])[]
}

/** The two palettes, value for value from b-red v4 `grad.js`. */
const PALETTES: Record<GradTone, Palette> = {
  bright: {
    base: '#fbe8e5',
    speed: 0.7,
    grain: 0.05,
    blobs: [
      ['#f0aca4', 1, 1.05],
      ['#f9dcd8', 1, 1.15],
      ['#c21f13', 0.25, 0.85],
      ['#ea948a', 0.8, 0.9],
      ['#fff4f2', 0.9, 0.75],
      ['#f4c2bc', 1, 1],
    ],
  },
  ember: {
    base: '#8f150c',
    speed: 1,
    grain: 0.07,
    blobs: [
      ['#c21f13', 1, 1.15],
      ['#6e0f08', 0.9, 0.95],
      ['#b41c11', 1, 1],
      ['#c21f13', 0.9, 0.85],
      ['#7d1109', 0.8, 0.8],
    ],
  },
}

function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`
}

function blobs(palette: Palette, seed: number, count: number): CSSProperties[] {
  const rnd = rng(seed * 97 + 13)
  const side = seed % 2
  return Array.from({ length: count }, (_, i) => {
    const [colour, alpha, size] = palette.blobs[(i + seed) % palette.blobs.length] ?? [
      '#c21f13',
      1,
      1,
    ]
    const width = 64 * size * (0.85 + rnd() * 0.3)
    const y = count === 1 ? 50 : (i / (count - 1)) * 100 + (rnd() - 0.5) * (100 / count) * 0.6
    const x = ((i + side) % 2 ? 10 : 88) + (rnd() - 0.5) * 24
    const a = (k: number) => rgba(colour, alpha * k)
    return {
      left: `${x.toFixed(1)}%`,
      top: `${y.toFixed(1)}%`,
      width: `${width.toFixed(1)}%`,
      background: `radial-gradient(closest-side, ${a(1)} 0%, ${a(0.86)} 22%, ${a(0.56)} 46%, ${a(0.22)} 72%, ${a(0)} 100%)`,
      animationName: `gp-drift-${(i + seed) % 4}`,
      animationDuration: `${((20 + rnd() * 14) * palette.speed).toFixed(1)}s`,
      animationDelay: `-${(rnd() * 30).toFixed(1)}s`,
    }
  })
}

export interface GradLayerProps {
  readonly tone: GradTone
  /** Picks the arrangement; different panels on one screen should differ. */
  readonly seed?: number
  /** How many blobs; the brand site uses 3 to 9 by the panel's height. */
  readonly count?: number
}

/**
 * The layer itself: put it as the first child of a panel that has `gp-host` (and the tone's text
 * colour). It is decorative and hidden from assistive technology.
 */
export function GradLayer({ tone, seed = 1, count = 4 }: GradLayerProps) {
  const layer = useRef<HTMLDivElement>(null)
  const palette = PALETTES[tone]

  useEffect(() => {
    const node = layer.current
    if (node === null || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      ([entry]) => node.classList.toggle('gp-sleep', entry !== undefined && !entry.isIntersecting),
      { rootMargin: '15% 0px' },
    )
    observer.observe(node)
    const onVisibility = () =>
      node.classList.toggle('gp-sleep', document.visibilityState !== 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div
      ref={layer}
      className={`gp-layer gp-${tone}`}
      aria-hidden="true"
      style={{ backgroundColor: palette.base }}
    >
      {blobs(palette, seed, count).map((style, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, seeded arrangement that never reorders
        <i key={i} className="gp-blob" style={style} />
      ))}
      <i className="gp-grain" style={{ opacity: palette.grain }} />
    </div>
  )
}
