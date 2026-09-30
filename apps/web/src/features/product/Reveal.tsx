import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react'

export interface RevealProps {
  readonly as?: ElementType
  readonly children: ReactNode
  readonly className?: string
  readonly [key: string]: unknown
}

/**
 * Settles a section into place as it enters the viewport: its `[data-reveal]` children rise
 * 28 px on the brand's long expo-out curve, one after another (`--i` sets the order).
 *
 * `IntersectionObserver`, never a scroll listener: a `scroll` handler runs on every frame and is
 * the usual reason a landing page stutters on a laptop. This fires once per section and then
 * disconnects.
 *
 * **The content is never hidden.** An earlier version set `opacity: 0` until the observer fired,
 * and a full-page screenshot came back blank below the hero, because the capture resizes the
 * viewport instead of scrolling, so the observer never ran. Anything that can happen to a
 * screenshot can happen to a crawler, a print stylesheet or a browser where the script failed. So
 * the reveal is a translate only, armed after mount and only for sections still below the fold:
 * remove the JavaScript and you lose the animation, not the page.
 */
export function Reveal({ as, children, className, ...rest }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver !== 'function') {
      setShown(true)
      return
    }

    // Already on screen at mount? Then there is nothing to reveal, and offsetting it would be a
    // visible jolt on load rather than a reveal.
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.88) {
      setShown(true)
      return
    }
    setArmed(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      data-armed={armed}
      data-shown={shown}
      className={`reveal ${className ?? ''}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
