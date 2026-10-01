import { keyOf } from '@typing-race/curriculum'
import type { Language, Layout } from '@typing-race/domain'
import { createEngine, type Engine } from '@typing-race/engine'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { domInputSource, systemClock } from '../../seams/index.js'
import { LAYOUT_NAMES } from '../exercise/labels.js'
import { TypingLine } from '../exercise/TypingLine.js'
import { DIAGNOSTIC_TEXT, type DiagnosticResult, diagnosticScore } from './model.js'

/**
 * The short, skippable check: one line typed on the real input path (the hidden textarea read
 * through `beforeinput`/`compositionend`, ADR-0002) and the real engine, drawn by the exercise's
 * own typing line. It records nothing — no attempt, no log — and only hands its two figures back,
 * from which the flow suggests a level.
 */
export function Diagnostic(props: {
  readonly language: Language
  readonly layout: Layout
  readonly onDone: (result: DiagnosticResult) => void
}) {
  const { language, layout } = props
  const text = DIAGNOSTIC_TEXT[language]
  const sizePx = useAppStore((state) => state.settings.textSizePx)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [wrongLayout, setWrongLayout] = useState(false)
  const [focused, setFocused] = useState(true)
  const done = useRef(props.onDone)
  done.current = props.onDone

  useEffect(() => {
    const element = areaRef.current
    if (element === null) return
    const input = domInputSource(element, systemClock, { expectedLayoutId: layout.id })
    const created = createEngine({
      text,
      errorMode: 'stopOnLetter',
      input,
      clock: systemClock,
      layout,
    })
    let finished = false
    const stopChange = created.onChange((view) => {
      if (view.state !== 'completed' || finished) return
      finished = true
      done.current(
        diagnosticScore({
          chars: Array.from(text).length,
          errors: view.errorCount,
          elapsedMs: view.elapsedMs,
        }),
      )
    })
    // A letter the chosen layout cannot produce means the keyboard is on the other one.
    const stopInput = input.subscribe((event) => {
      if (event.kind !== 'char' || !/\p{L}/u.test(event.char)) return
      setWrongLayout(keyOf(layout, event.char.toLowerCase()) === undefined)
    })
    setEngine(created)
    input.focus()
    return () => {
      stopChange()
      stopInput()
      if (!finished) created.abandon()
      setEngine(null)
    }
  }, [text, layout])

  return (
    <section className="fr-step fr-step--check" aria-labelledby="fr-check-title">
      <div className="fr-intro">
        <h1 className="fr-title" id="fr-check-title">
          {m.firstrun_diag_title()}
        </h1>
        <p className="fr-lead">{m.firstrun_diag_lead()}</p>
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: a click only returns focus to the textarea, which the keyboard already has */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: as above */}
      <div
        className="fr-run"
        data-firstrun-typing=""
        data-focused={focused || undefined}
        onClick={() => areaRef.current?.focus()}
      >
        <textarea
          ref={areaRef}
          className="sr-only"
          aria-label={m.firstrun_diag_input()}
          rows={1}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {engine === null ? null : <TypingLine engine={engine} text={text} sizePx={sizePx} />}
        {focused ? null : (
          <p className="fr-run__focus" aria-hidden="true">
            {m.firstrun_diag_focus()}
          </p>
        )}
      </div>

      {wrongLayout ? (
        <p className="fr-warn" role="alert" data-testid="first-run-layout">
          {m.firstrun_diag_layout({ layout: LAYOUT_NAMES[layout.id] })}
        </p>
      ) : null}
    </section>
  )
}
