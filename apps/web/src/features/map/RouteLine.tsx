import { type ReactNode, type RefObject, useLayoutEffect, useState } from 'react'
import type { RouteGeometry } from './model.js'
import './route.css'

/**
 * B's route line, shared by the Map and Home's mini-map: the region bands, the dotted route still
 * ahead, and the solid red route walked so far. Geometry comes from `routeGeometry` in real pixels,
 * so text placed beside it is drawn at its true size at any width.
 */

/** The size of an element, kept current as it resizes. Zero until the first layout. */
export function useSize(ref: RefObject<HTMLElement | null>): {
  readonly width: number
  readonly height: number
} {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const node = ref.current
    if (node === null) return
    const measure = () => {
      const box = node.getBoundingClientRect()
      setSize((old) =>
        Math.abs(old.width - box.width) < 0.5 && Math.abs(old.height - box.height) < 0.5
          ? old
          : { width: box.width, height: box.height },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return size
}

export interface RouteLineProps {
  readonly geometry: RouteGeometry
  readonly width: number
  readonly height: number
  /** How far along the route the solid red line reaches. */
  readonly walked: number
  /** A class per band, for its state (`is-cur`, `is-lock`). */
  readonly bandClass?: (index: number) => string
  readonly className?: string
  /** Anything else drawn in the same coordinates (Home's node glyphs and band names). */
  readonly children?: ReactNode
}

export function RouteLine(props: RouteLineProps) {
  const { geometry, width, height, walked } = props
  if (width <= 0 || height <= 0) return null
  return (
    <svg
      className={`route${props.className === undefined ? '' : ` ${props.className}`}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {geometry.bands.map((band, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: the three bands are positional
          key={i}
          className={`route__band ${props.bandClass?.(i) ?? ''}`}
          x={band.x}
          y={0}
          width={band.width}
          height={height}
        />
      ))}
      <path className="route__line route__line--todo" d={geometry.d} />
      <path
        className="route__line route__line--done"
        d={geometry.d}
        style={{ strokeDasharray: `${Math.max(0, walked)} ${geometry.length + 10}` }}
      />
      {props.children}
    </svg>
  )
}
