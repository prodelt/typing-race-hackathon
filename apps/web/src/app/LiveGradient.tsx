/**
 * The live gradient behind the stage: a port of the brand site's `grad.js`, slowed and softened
 * for an app that is looked at for twenty minutes rather than twenty seconds.
 *
 * Pure CSS once rendered: a handful of large radial blobs drifting on long, alternating keyframes,
 * plus a grain layer. No script runs per frame. It is **static in Play Mode** and under reduced
 * motion (`shell.css`), so nothing moves behind the typing line.
 */

type Blob = readonly [color: string, alpha: number, size: number]

interface Palette {
  readonly base: string
  readonly grain: number
  /** Lower is slower: a blob's cycle is `(16 + 4i) / speed` seconds. */
  readonly speed: number
  readonly alpha: number
  readonly blobs: readonly Blob[]
}

export type GradientTone = 'bright' | 'ember' | 'soft'

const PALETTES: Record<GradientTone, Palette> = {
  bright: {
    base: '#fbebe8',
    grain: 0.04,
    speed: 0.28,
    alpha: 0.5,
    blobs: [
      ['#f0aca4', 1, 1.05],
      ['#f9dcd8', 1, 1.15],
      ['#c21f13', 0.18, 0.85],
      ['#ea948a', 0.7, 0.9],
      ['#fff4f2', 0.9, 0.75],
      ['#f4c2bc', 1, 1],
    ],
  },
  ember: {
    base: '#8f150c',
    grain: 0.06,
    speed: 0.4,
    alpha: 0.8,
    blobs: [
      ['#c21f13', 1, 1.15],
      ['#6e0f08', 0.9, 0.95],
      ['#b41c11', 1, 1],
      ['#c21f13', 0.9, 0.85],
      ['#7d1109', 0.8, 0.8],
    ],
  },
  soft: {
    base: '#fcf0ee',
    grain: 0.03,
    speed: 0.2,
    alpha: 0.35,
    blobs: [
      ['#f4c2bc', 1, 1.1],
      ['#fff6f4', 1, 1],
      ['#f9dcd8', 1, 1.2],
    ],
  },
}

const POSITIONS: readonly (readonly [number, number])[] = [
  [18, 22],
  [78, 30],
  [30, 78],
  [86, 82],
  [55, 48],
  [62, 12],
]

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function LiveGradient({
  tone,
  seed = 0,
}: {
  readonly tone: GradientTone
  readonly seed?: number
}) {
  const palette = PALETTES[tone]
  return (
    <span className="gp-layer" aria-hidden="true" style={{ backgroundColor: palette.base }}>
      {palette.blobs.map(([color, alpha, size], i) => {
        const [left, top] = POSITIONS[(i + seed) % POSITIONS.length] ?? [50, 50]
        const vmax = Math.round(78 * size)
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed palette; the order never changes
            key={i}
            className="gp-blob"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${vmax}vmax`,
              height: `${vmax}vmax`,
              background: `radial-gradient(closest-side, ${rgba(color, alpha * palette.alpha)}, ${rgba(color, 0)})`,
              animationName: `gp-drift-${i % 4}`,
              animationDuration: `${Math.round((16 + i * 4) / palette.speed)}s`,
              animationDelay: `-${i * 7 + seed * 5}s`,
            }}
          />
        )
      })}
      <span className="gp-grain" style={{ opacity: palette.grain }} />
    </span>
  )
}
