import { layouts } from '@typing-race/curriculum'
import type { InputEvent, InputSource, KeystrokeEventLog, Language } from '@typing-race/domain'
import { createEngine, type Engine } from '@typing-race/engine'
import { useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { domInputSource, systemClock } from '../../seams/index.js'
import { TypingLine } from '../exercise/TypingLine.js'

/** A racer who types nothing for this long steps back to watching. */
const IDLE_MS = 25_000
/** Two progress messages a second: enough for smooth lanes, well inside the Realtime budget. */
const PROGRESS_EVERY_MS = 500

export interface RaceRunProps {
  readonly text: string
  readonly language: Language
  /** `false` during the countdown: the line is visible, but nothing typed counts yet. */
  readonly live: boolean
  readonly sizePx: number
  readonly onProgress: (cursor: number, total: number, spm: number) => void
  readonly onFinish: (log: KeystrokeEventLog, elapsedMs: number) => void
  readonly onIdle: () => void
}

/**
 * Wraps the page's input source so that nothing reaches the engine before the start. The engine
 * starts on its first printable character, so without this gate a key pressed during "2" would
 * start the race early.
 */
function gated(source: InputSource, open: () => boolean): InputSource {
  return {
    subscribe(listener) {
      return source.subscribe((event: InputEvent) => {
        if (open()) listener(event)
      })
    },
    probeLayout: () => source.probeLayout(),
    focus: () => source.focus(),
  }
}

/**
 * The typing half of a race. The keystroke path is the exercise screen's, unchanged: a hidden
 * textarea read through `beforeinput`/`compositionend`, an engine outside React, and the same
 * imperatively painted `TypingLine`. The only additions sit at the edges: a start gate, a
 * half-second progress sampler, and an idle watch.
 */
export function RaceRun({
  text,
  language,
  live,
  sizePx,
  onProgress,
  onFinish,
  onIdle,
}: RaceRunProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const liveRef = useRef(live)
  const sourceRef = useRef<InputSource | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const spmRef = useRef<HTMLSpanElement>(null)
  const callbacks = useRef({ onProgress, onFinish, onIdle })
  callbacks.current = { onProgress, onFinish, onIdle }

  useEffect(() => {
    const element = textareaRef.current
    if (element === null) return
    const layout = layouts[language === 'uk' ? 'yq' : 'qwerty']
    // One DOM source per textarea: a development double-mount must not attach its listeners twice.
    sourceRef.current ??= domInputSource(element, systemClock, { expectedLayoutId: layout.id })
    const source = gated(sourceRef.current, () => liveRef.current)
    // A race is always stop-on-letter: it is the only mode the server replays.
    const created = createEngine({
      text,
      errorMode: 'stopOnLetter',
      input: source,
      clock: systemClock,
      layout,
    })
    let done = false
    const stop = created.onChange((view) => {
      if (view.state !== 'completed' || done) return
      done = true
      const total = Array.from(text).length
      callbacks.current.onProgress(total, total, speedOf(total, view.elapsedMs))
      callbacks.current.onFinish(created.finish(), view.elapsedMs)
    })
    setEngine(created)
    return () => {
      stop()
      if (!done) created.abandon()
      setEngine(null)
    }
  }, [text, language])

  // The start: open the gate, start the clock, take the focus.
  useEffect(() => {
    liveRef.current = live
    if (!live || engine === null) return
    if (engine.view.state === 'idle') engine.start()
    textareaRef.current?.focus()
  }, [live, engine])

  // Progress and idleness, sampled rather than per keystroke.
  useEffect(() => {
    if (!live || engine === null) return
    const total = Array.from(text).length
    let lastActivity = -1
    let lastMoveAt = Date.now()
    const id = setInterval(() => {
      const view = engine.view
      if (view.state !== 'running') return
      const spm = speedOf(view.cursor, view.elapsedMs)
      if (spmRef.current !== null) spmRef.current.textContent = String(Math.round(spm))
      // A wrong key is still a racer at the keyboard; only silence counts as idle.
      const activity = view.cursor + view.errorCount
      if (activity !== lastActivity) {
        lastActivity = activity
        lastMoveAt = Date.now()
        callbacks.current.onProgress(view.cursor, total, spm)
      } else if (Date.now() - lastMoveAt > IDLE_MS) {
        clearInterval(id)
        engine.abandon()
        callbacks.current.onIdle()
      }
    }, PROGRESS_EVERY_MS)
    return () => clearInterval(id)
  }, [live, engine, text])

  const refocus = () => {
    if (liveRef.current) textareaRef.current?.focus()
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a click anywhere on the race only returns focus to the hidden textarea, which is itself the keyboard path
    <div className="race-run" onClick={refocus}>
      <textarea
        ref={textareaRef}
        data-testid="typing-input"
        className="sr-only"
        aria-label={m.race_input_label()}
        tabIndex={-1}
        rows={1}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onBlur={() => {
          if (liveRef.current && document.hasFocus()) textareaRef.current?.focus()
        }}
      />
      <div className="race-run__meter" aria-live="off">
        <span ref={spmRef} className="race-run__spm" data-testid="race-live-spm">
          0
        </span>
        <span className="race-run__spm-unit">{m.race_live_spm()}</span>
      </div>
      <div className="race-run__line" data-live={live || undefined}>
        {engine === null ? null : <TypingLine engine={engine} text={text} sizePx={sizePx} />}
      </div>
    </div>
  )
}

/** Characters per minute from correct characters so far, as the lanes show it. */
function speedOf(cursor: number, elapsedMs: number): number {
  return elapsedMs > 0 ? (cursor * 60_000) / elapsedMs : 0
}
