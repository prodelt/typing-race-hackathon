import { fingerOf, keyOf, shiftFingerOf } from '@typing-race/curriculum'
import type { Finger, FingerAssignment, Layout } from '@typing-race/domain'
import type { Engine, EngineView } from '@typing-race/engine'
import { memo, useCallback, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { useEnginePaint } from './engineHooks.js'
import { fingerLabel, glyphFor } from './labels.js'
import './Guides.css'

/**
 * T089. The next-key card and the finger diagram: the only elements that name a finger without
 * naming a key (ticket 20, decision 3).
 *
 * Both are Practice-only and both repaint imperatively from `engine.onChange`; see KeyboardGuide
 * for why that highlight is not React state. In a Test Attempt neither is rendered (FR-037).
 */

interface Awaited {
  readonly main: FingerAssignment
  readonly shift: FingerAssignment | undefined
}

function fingersFor(layout: Layout, char: string | undefined): Awaited | undefined {
  if (char === undefined || keyOf(layout, char) === undefined) return undefined
  const main = fingerOf(layout, char)
  return main === undefined ? undefined : { main, shift: shiftFingerOf(layout, char) }
}

export interface NextKeyProps {
  readonly engine: Engine
  readonly text: string
  readonly layout: Layout
}

function NextKeyCardBase({ engine, text, layout }: NextKeyProps) {
  const glyphRef = useRef<HTMLSpanElement>(null)
  const fingerRef = useRef<HTMLParagraphElement>(null)
  const shiftRef = useRef<HTMLParagraphElement>(null)
  const chars = useRef(Array.from(text))

  const paint = useCallback(
    (view: EngineView) => {
      const char = chars.current[view.cursor]
      const info = fingersFor(layout, char)
      if (glyphRef.current !== null)
        glyphRef.current.textContent = char === undefined ? '' : glyphFor(char)
      if (fingerRef.current !== null) {
        fingerRef.current.textContent = info === undefined ? '' : fingerLabel(info.main)
      }
      if (shiftRef.current !== null) {
        shiftRef.current.textContent =
          info?.shift === undefined
            ? ''
            : m.exercise_next_key_shift({ finger: fingerLabel(info.shift) })
      }
    },
    [layout],
  )

  useEnginePaint(engine, paint)

  return (
    <div data-testid="next-key" className="next-key">
      <span ref={glyphRef} className="next-key__glyph" />
      <div className="min-w-0">
        <p className="label">{m.exercise_next_key_title()}</p>
        <p ref={fingerRef} className="next-key__finger" />
        <p ref={shiftRef} className="next-key__shift" />
      </div>
    </div>
  )
}

export const NextKeyCard = memo(NextKeyCardBase)

/** Bar heights follow real finger lengths, so the diagram reads as a hand and not as a legend. */
const FINGERS: readonly { side: 'left' | 'right'; finger: Finger; height: number }[] = [
  { side: 'left', finger: 'pinky', height: 28 },
  { side: 'left', finger: 'ring', height: 38 },
  { side: 'left', finger: 'middle', height: 44 },
  { side: 'left', finger: 'index', height: 40 },
  { side: 'left', finger: 'thumb', height: 26 },
  { side: 'right', finger: 'thumb', height: 26 },
  { side: 'right', finger: 'index', height: 40 },
  { side: 'right', finger: 'middle', height: 44 },
  { side: 'right', finger: 'ring', height: 38 },
  { side: 'right', finger: 'pinky', height: 28 },
]

function FingerDiagramBase({ engine, text, layout }: NextKeyProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const chars = useRef(Array.from(text))

  const paint = useCallback(
    (view: EngineView) => {
      const root = rootRef.current
      if (root === null) return
      const info = fingersFor(layout, chars.current[view.cursor])
      const active = new Set<string>()
      for (const assignment of [info?.main, info?.shift]) {
        if (assignment === undefined) continue
        // Both thumbs are lit for the space bar: either one may press it.
        if (assignment.hand === 'thumbs') {
          active.add('left-thumb')
          active.add('right-thumb')
        } else {
          active.add(`${assignment.hand}-${assignment.finger}`)
        }
      }
      for (const bar of root.querySelectorAll<HTMLElement>('[data-finger]')) {
        bar.dataset['active'] = String(active.has(bar.dataset['finger'] ?? ''))
      }
    },
    [layout],
  )

  useEnginePaint(engine, paint)

  return (
    <div
      ref={rootRef}
      data-testid="finger-diagram"
      role="img"
      aria-label={m.exercise_finger_diagram_label()}
      className="flex items-end gap-1.5 h-11"
    >
      {FINGERS.map(({ side, finger, height }) => (
        <span
          key={`${side}-${finger}`}
          data-finger={`${side}-${finger}`}
          data-kind={finger}
          data-active="false"
          className="finger-bar w-3.5"
          style={{ height }}
        />
      ))}
    </div>
  )
}

export const FingerDiagram = memo(FingerDiagramBase)
