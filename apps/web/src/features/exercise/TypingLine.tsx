import type { Engine, EngineView } from '@typing-race/engine'
import { memo, useCallback, useEffect, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { useEnginePaint } from './engineHooks.js'
import { displayChar, formatElapsed } from './labels.js'
import './TypingLine.css'

export interface TypingLineProps {
  readonly engine: Engine
  readonly text: string
  readonly sizePx: number
}

/**
 * T086. The one region an engine event repaints (FR-069).
 *
 * React renders this once: a span per character, a caret, a rule and two readouts. After that
 * `paint` edits attributes and text on those nodes directly, from `engine.onChange`, and never
 * calls `setState` — so a keystroke cannot cause a render, a reconciliation or a change to any node
 * outside this section. The three things the specification keeps visible in a Test Attempt (time,
 * errors, progress; FR-037) live **inside** it for exactly that reason: they change between
 * keystrokes, and only here may anything do that.
 *
 * Nothing in the JSX carries a per-character state, so a parent re-render, which React would
 * otherwise reconcile against the initial markup, has nothing to overwrite.
 */
function TypingLineBase({ engine, text, sizePx }: TypingLineProps) {
  const regionRef = useRef<HTMLElement>(null)
  const runRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const errorsRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  const previous = useRef<{ cursor: number; marks: ReadonlySet<number> }>({
    cursor: -1,
    marks: new Set(),
  })

  const chars = Array.from(text)

  const paint = useCallback((view: EngineView) => {
    const region = regionRef.current
    const run = runRef.current
    if (region === null || run === null) return
    const spans = run.children
    const last = spans.length - 1
    const { cursor, markedAt } = view
    const before = previous.current

    region.dataset['state'] = view.state

    if (cursor !== before.cursor) {
      // Only the characters between the old and the new cursor can have changed state. On the
      // first paint `before.cursor` is -1, which repaints them all.
      const first = before.cursor < 0
      const from = first ? 0 : Math.min(before.cursor, cursor)
      const to = first ? last : Math.min(last, Math.max(before.cursor, cursor))
      for (let i = from; i <= to; i++) {
        const span = spans.item(i)
        if (span instanceof HTMLElement) {
          span.dataset['state'] = i < cursor ? 'typed' : i === cursor ? 'awaited' : 'upcoming'
        }
      }
      const awaited = spans.item(Math.min(cursor, last))
      if (awaited instanceof HTMLElement) {
        run.style.setProperty('--shift', `${awaited.offsetLeft}px`)
      }
      const done = cursor / (last + 1)
      if (fillRef.current !== null) fillRef.current.style.transform = `scaleX(${done})`
      meterRef.current?.setAttribute('aria-valuenow', String(Math.round(done * 100)))
    }

    // Every position holding a wrong character is marked, not only the earliest: under
    // freeBackspace each wrong keystroke stays visibly wrong until the learner erases it. Under
    // stopOnLetter `wrong` is empty and `markedAt` is the awaited character, marked in place.
    const marks = new Set(view.wrong)
    if (markedAt !== null) marks.add(markedAt)
    for (const index of before.marks) {
      if (marks.has(index)) continue
      const cleared = spans.item(index)
      if (cleared instanceof HTMLElement) cleared.removeAttribute('data-mark')
    }
    for (const index of marks) {
      if (before.marks.has(index)) continue
      const marked = spans.item(index)
      if (marked instanceof HTMLElement) marked.dataset['mark'] = 'wrong'
    }

    const errors = errorsRef.current
    if (errors !== null && errors.textContent !== String(view.errorCount)) {
      errors.textContent = String(view.errorCount)
    }
    if (timeRef.current !== null) timeRef.current.textContent = formatElapsed(view.elapsedMs)

    previous.current = { cursor, marks }
  }, [])

  useEnginePaint(engine, paint)

  // Elapsed time must advance while the learner hesitates. It is written into the same section,
  // so the ticking is invisible to FR-069; `elapsedMs` is the engine's, which excludes pauses.
  useEffect(() => {
    const id = setInterval(() => {
      if (timeRef.current !== null) {
        timeRef.current.textContent = formatElapsed(engine.view.elapsedMs)
      }
    }, 250)
    return () => clearInterval(id)
  }, [engine])

  // Web fonts change glyph widths after first paint; re-measure once they have loaded.
  useEffect(() => {
    let live = true
    void document.fonts?.ready.then(() => {
      if (!live) return
      previous.current = { cursor: -1, marks: previous.current.marks }
      paint(engine.view)
    })
    return () => {
      live = false
    }
  }, [engine, paint])

  return (
    <section
      ref={regionRef}
      data-testid="typing-line"
      data-state="idle"
      aria-label={m.exercise_line_label()}
      className="typing-line"
    >
      <div
        className="typing-line__stage"
        // The same box in every exercise type and every mode: the height depends on the size
        // setting alone, so the line never moves vertically (FR-058).
        style={{ fontSize: sizePx, height: sizePx * 3 }}
      >
        {/* The text is read once, in full, by assistive technology; the repainting characters
            below are decoration and must not be announced one by one. */}
        <p className="sr-only">{text}</p>
        <div className="typing-line__viewport">
          <div ref={runRef} aria-hidden="true" className="typing-line__run">
            {chars.map((char, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the text never reorders, and the index is the character's position in the exercise
              <span key={index} className="typing-line__char">
                {displayChar(char)}
              </span>
            ))}
          </div>
          <span aria-hidden="true" className="typing-line__caret" />
        </div>
        <div
          ref={meterRef}
          role="progressbar"
          aria-label={m.exercise_progress()}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          data-testid="progress"
          className="typing-line__rule"
        >
          <div ref={fillRef} className="typing-line__rule-fill" />
        </div>
        <p className="typing-line__hint">{m.exercise_type_to_begin()}</p>
      </div>

      <dl className="typing-line__readouts">
        <div>
          <dt>{m.exercise_time()}</dt>
          <dd>
            <span ref={timeRef} data-testid="elapsed-time">
              0:00
            </span>
          </dd>
        </div>
        <div>
          <dt>{m.exercise_errors()}</dt>
          <dd>
            <span ref={errorsRef} data-testid="error-count">
              0
            </span>
          </dd>
        </div>
      </dl>
    </section>
  )
}

export const TypingLine = memo(TypingLineBase)
