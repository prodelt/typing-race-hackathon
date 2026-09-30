import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react'

export interface RevealProps {
  readonly as?: ElementType
  readonly children: ReactNode
  readonly className?: string
  readonly [key: string]: unknown
}

/**
 * Reveals a section as it enters the viewport.
 *
 * `IntersectionObserver`, never a scroll listener: a `scroll` handler runs on every frame, cannot
 * be batched, and is the usual reason a landing page stutters on a laptop. This fires once per
 * section and then disconnects.
 *
 * **The content is never hidden.** The first version of this set `opacity: 0` until the observer
 * fired, and a full-page screenshot of the built site came back blank below the hero — because the
 * capture resizes the viewport instead of scrolling, so the observer never ran. Anything that can
 * happen to a screenshot can happen to a crawler, a print stylesheet, a reader-mode extension or a
 * browser where the script failed. So the reveal is a **translate only**: the section is readable
 * at all times and merely settles into place.
 *
 * It is also armed only after mount, so the pre-hydration paint is the final position rather than
 * the offset one. Motion here is progressive enhancement in the literal sense: remove the
 * JavaScript and you lose the animation, not the page.
 *
 * The motion is motivated rather than decorative — it gives the page a reading order, so the eye
 * lands on the stage ladder before the principles instead of taking in four blocks at once.
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
    if (rect.top < window.innerHeight * 0.9) {
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
      // A third of the section, so it commits when the reader has clearly arrived rather than
      // when one pixel has crossed the line.
      { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      data-armed={armed}
      data-shown={shown}
      className={`product__reveal ${className ?? ''}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
