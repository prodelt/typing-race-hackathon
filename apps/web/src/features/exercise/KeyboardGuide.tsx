import { keyOf, SHIFT_TOKEN } from '@typing-race/curriculum'
import type { Key, Layout, Row } from '@typing-race/domain'
import type { Engine, EngineView } from '@typing-race/engine'
import { Keycap } from '@typing-race/ui'
import { memo, useCallback, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { useEnginePaint } from './engineHooks.js'
import { tierOf } from './labels.js'

export interface KeyboardGuideProps {
  readonly engine: Engine
  readonly text: string
  readonly layout: Layout
  readonly unlocked: readonly string[]
  readonly keyConfidence: Readonly<Record<string, number | undefined>>
}

const ROWS: readonly Row[] = ['digit', 'top', 'home', 'bottom']

/** Half-key stagger of a physical keyboard, in pixels of a 44 px key plus its 4 px gap. */
const ROW_INSET: Record<Row, number> = { digit: 0, top: 24, home: 36, bottom: 60 }

/**
 * T088. The full layout in finger colours, fading across Confidence tiers (FR-060, FR-061).
 *
 * The letter is drawn by `Keycap` in full finger ink at every tier, so the tier fades the prompt
 * and never the legibility. Colour is not the only carrier of a finger's identity: the next-key
 * card names the finger in words (FR-061).
 *
 * Which key is awaited changes on every keystroke, so it is **not** a prop. `paint` flips a
 * `data-awaited` attribute on the two keycaps involved, straight on the DOM, for the same reason
 * TypingLine does: a React render here would be a change outside the typing line per keystroke.
 * That highlight is the one thing in a Practice Attempt that moves outside the line, and it is the
 * guide itself (acceptance scenario 4); a Test Attempt does not render this component at all.
 */
function KeyboardGuideBase({ engine, text, layout, unlocked, keyConfidence }: KeyboardGuideProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const chars = useRef(Array.from(text))
  const lit = useRef<readonly HTMLElement[]>([])

  const paint = useCallback(
    (view: EngineView) => {
      const root = rootRef.current
      if (root === null) return
      for (const element of lit.current) element.removeAttribute('data-awaited')

      const char = chars.current[view.cursor]
      const key = char === undefined ? undefined : keyOf(layout, char)
      if (key === undefined || char === undefined) {
        lit.current = []
        return
      }
      // A capital is typed with the opposite hand's Shift (FR-004), so both keys light up.
      const folded = char === '’' ? "'" : char
      const needsShift = key.shifted === folded
      const codes = needsShift
        ? [key.code, key.hand === 'left' ? 'ShiftRight' : 'ShiftLeft']
        : [key.code]
      const found: HTMLElement[] = []
      for (const code of codes) {
        const element = root.querySelector<HTMLElement>(`[data-code="${code}"]`)
        if (element !== null) {
          element.dataset['awaited'] = 'true'
          found.push(element)
        }
      }
      lit.current = found
    },
    [layout],
  )

  useEnginePaint(engine, paint)

  const unlockedSet = new Set(unlocked)

  const renderKey = (key: Key) => {
    const isShift = key.kind === 'modifier'
    const token = isShift ? SHIFT_TOKEN : key.plain
    const locked = !unlockedSet.has(token)
    const confidence = keyConfidence[token]
    return (
      <Keycap
        key={key.code}
        data-code={key.code}
        glyph={isShift ? '⇧' : key.plain}
        finger={key.finger}
        tier={tierOf(confidence)}
        locked={locked}
        width={isShift ? 'wide' : key.kind === 'space' ? 'space' : 'unit'}
        // Below 0.5 the guide adds a terracotta ring (ticket 20, addendum 18): the one place the
        // tier speaks louder, because that is the key the learner most needs prompted.
        className={
          !locked && confidence !== undefined && confidence < 0.5
            ? 'kb-key outline-1 outline-terracotta'
            : 'kb-key'
        }
      />
    )
  }

  const keys = layout.keys
  return (
    <div
      ref={rootRef}
      data-testid="keyboard-guide"
      role="img"
      aria-label={m.exercise_guide_label()}
      className="flex flex-col gap-1"
    >
      {ROWS.map((row) => {
        const rowKeys = keys.filter((key) => key.row === row && key.kind !== 'space')
        const shifts = row === 'bottom' ? rowKeys.filter((key) => key.kind === 'modifier') : []
        const plain = rowKeys.filter((key) => key.kind !== 'modifier')
        const left = shifts.find((key) => key.code === 'ShiftLeft')
        const right = shifts.find((key) => key.code === 'ShiftRight')
        return (
          <div key={row} className="flex gap-1" style={{ paddingLeft: ROW_INSET[row] }}>
            {left === undefined ? null : renderKey(left)}
            {plain.map(renderKey)}
            {right === undefined ? null : renderKey(right)}
          </div>
        )
      })}
      <div className="flex gap-1" style={{ paddingLeft: 120 }}>
        {keys.filter((key) => key.kind === 'space').map(renderKey)}
      </div>
    </div>
  )
}

export const KeyboardGuide = memo(KeyboardGuideBase)
