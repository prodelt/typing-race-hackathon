import { cloneElement, type ReactElement, useId, useRef, useState } from 'react'

/**
 * A one-line tooltip for an icon or number control: shown on hover and on keyboard focus, read out
 * through `aria-describedby`, hidden by Esc, and nudged sideways so it never leaves the viewport.
 * `side` puts the bubble to the right of the control (the rail) instead of below it (the bar).
 */
export function Tip({
  text,
  side = false,
  children,
}: {
  readonly text: string
  readonly side?: boolean
  readonly children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const id = useId()
  const bubble = useRef<HTMLSpanElement>(null)
  const [hidden, setHidden] = useState(false)
  const [dx, setDx] = useState(0)

  const show = () => {
    setHidden(false)
    const el = bubble.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    const shift =
      rect.right - dx > window.innerWidth - margin
        ? window.innerWidth - margin - (rect.right - dx)
        : rect.left - dx < margin
          ? margin - (rect.left - dx)
          : 0
    setDx(shift)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: listens for the control's hover, focus and Esc
    <span
      className={`tip tipw${hidden ? ' tip--hidden' : ''}`}
      onPointerEnter={show}
      onFocus={show}
      onPointerLeave={() => setHidden(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !hidden) {
          setHidden(true)
          event.stopPropagation()
        }
      }}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        ref={bubble}
        role="tooltip"
        id={id}
        className={`tip__bubble${side ? ' tip__bubble--side' : ''}`}
        style={dx === 0 ? undefined : { translate: `${dx}px 0` }}
      >
        {text}
      </span>
    </span>
  )
}
