import { buttonClass } from '@typing-race/ui'
import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { m } from '../../paraglide/messages.js'
import { takeKey } from '../../seams/keys.js'
import { type GuideScreen, type GuideStep, guideTarget, presentSteps } from './model.js'
import './guide.css'

/**
 * The coach-mark bubbles: one at a time, next to its target, with a ring around the target, a step
 * counter, «Далі» (Enter) and «Пропустити» (Esc). Lazy — loaded only when a guide opens.
 */

const STEPS: Readonly<Record<GuideScreen, () => readonly GuideStep[]>> = {
  home: () => [
    { target: guideTarget('home-start'), text: m.guide_home_start() },
    { target: guideTarget('home-race'), text: m.guide_home_race() },
    { target: guideTarget('rail'), text: m.guide_home_rail() },
    { target: guideTarget('help'), text: m.guide_home_help() },
  ],
  map: () => [
    { target: guideTarget('map-here'), text: m.guide_map_here() },
    { target: guideTarget('map-route'), text: m.guide_map_route() },
    { target: guideTarget('map-legend'), text: m.guide_map_legend() },
  ],
  prestart: () => [
    { target: guideTarget('prestart-goal'), text: m.guide_prestart_goal() },
    { target: guideTarget('prestart-mode'), text: m.guide_prestart_mode() },
    { target: guideTarget('prestart-start'), text: m.guide_prestart_start() },
  ],
  result: () => [
    { target: guideTarget('result-score'), text: m.guide_result_score() },
    { target: guideTarget('result-tiles'), text: m.guide_result_tiles() },
    { target: guideTarget('result-next'), text: m.guide_result_next() },
  ],
}

const GAP = 14
const MARGIN = 12
const RING = 6

type Side = 'below' | 'above' | 'right'

interface Placement {
  readonly ring: { left: number; top: number; width: number; height: number }
  readonly left: number
  readonly top: number
  readonly side: Side
  readonly arrow: number
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high))

/** Below the target, else above it, else (a tall target such as the rail) to its right; clamped. */
function place(target: DOMRect, bubble: { width: number; height: number }): Placement {
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const ring = {
    left: target.left - RING,
    top: target.top - RING,
    width: target.width + RING * 2,
    height: target.height + RING * 2,
  }
  const need = bubble.height + GAP + MARGIN
  const side: Side =
    vh - target.bottom >= need
      ? 'below'
      : target.top >= need
        ? 'above'
        : vw - target.right >= bubble.width + GAP + MARGIN
          ? 'right'
          : 'below'
  if (side === 'right') {
    const middle = Math.max(target.top, 0) + Math.min(target.height, vh) / 2
    const top = clamp(middle - bubble.height / 2, MARGIN, vh - bubble.height - MARGIN)
    return {
      ring,
      left: target.right + GAP,
      top,
      side,
      arrow: clamp(middle - top, 18, bubble.height - 18),
    }
  }
  const rawTop = side === 'below' ? target.bottom + GAP : target.top - GAP - bubble.height
  const top = clamp(rawTop, MARGIN, vh - bubble.height - MARGIN)
  const centre = target.left + target.width / 2
  const left = clamp(centre - bubble.width / 2, MARGIN, vw - bubble.width - MARGIN)
  return { ring, left, top, side, arrow: clamp(centre - left, 18, bubble.width - 18) }
}

export default function CoachMarks({
  screen,
  onClose,
}: {
  readonly screen: GuideScreen
  readonly onClose: () => void
}) {
  const steps = useMemo(
    () => presentSteps(STEPS[screen](), (selector) => document.querySelector(selector)),
    [screen],
  )
  const [index, setIndex] = useState(0)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const textId = useId()
  const step = steps[index]
  const last = index === steps.length - 1

  // Focus moves into the bubble and goes back where it was when the guide closes.
  useEffect(() => {
    const before = document.activeElement
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (steps.length === 0) onClose()
  }, [steps.length, onClose])

  useLayoutEffect(() => {
    if (step === undefined) return
    const target = document.querySelector(step.target)
    if (target === null) {
      // The target left the screen since the guide opened: skip to the next one.
      if (last) onClose()
      else setIndex((i) => i + 1)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    })
    const update = (): void => {
      const el = bubble.current
      if (el === null) return
      setPlacement(
        place(target.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }),
      )
    }
    update()
    next.current?.focus({ preventScroll: true })
    const settle = setTimeout(update, 320)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      clearTimeout(settle)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step, last, onClose])

  // Esc closes the guide wherever focus is, before the screen's own Esc can act on it.
  useEffect(() => takeKey('Escape', onClose), [onClose])

  if (step === undefined) return null

  const advance = (): void => {
    if (last) onClose()
    else setIndex(index + 1)
  }

  return createPortal(
    <>
      {placement === null ? null : (
        <div className="coach-ring" aria-hidden="true" style={placement.ring} />
      )}
      <div
        ref={bubble}
        role="dialog"
        aria-modal="false"
        aria-labelledby={textId}
        className={`coach coach--${placement?.side ?? 'below'}`}
        style={
          placement === null
            ? { opacity: 0, left: 0, top: 0 }
            : ({
                left: placement.left,
                top: placement.top,
                '--coach-arrow': `${placement.arrow}px`,
              } as CSSProperties)
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            advance()
          }
        }}
      >
        <span className="coach__arrow" aria-hidden="true" />
        <p className="coach__count num">
          <span aria-hidden="true">
            {index + 1}/{steps.length}
          </span>
          <span className="sr-only">
            {m.guide_label({ n: String(index + 1), total: String(steps.length) })}
          </span>
        </p>
        <p className="coach__text" id={textId}>
          {step.text}
        </p>
        <div className="coach__actions">
          <button type="button" className="coach__skip" onClick={onClose}>
            {m.guide_skip()}
            <span className="kbd" aria-hidden="true">
              Esc
            </span>
          </button>
          <button
            ref={next}
            type="button"
            className={buttonClass('primary', 'sm')}
            aria-keyshortcuts="Enter"
            onClick={advance}
          >
            {last ? m.guide_done() : m.guide_next()}
            <span className="kbd" aria-hidden="true">
              Enter
            </span>
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
