import { paceAt, tempoPlan } from '@typing-race/curriculum'
import type { Scale } from '@typing-race/domain'
import type { Engine, EngineView } from '@typing-race/engine'
import { memo, useCallback, useMemo, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { useEnginePaint } from './engineHooks.js'
import './PaceCue.css'

export interface PaceCueProps {
  readonly engine: Engine
  readonly scale: Scale
  readonly text: string
}

/**
 * The metronome of a tempo scale: a dot that beats once per character at the target pace, the
 * target in SPM, and three ticks for the three steps. The pace rises a step every third of the text
 * (`tempoPlan`: 100 → 120 → 140 SPM), so the learner feels the tempo change rather than reads it.
 *
 * Renders nothing for a scale without a tempo. Like the typing line, it paints imperatively from
 * the engine and never re-renders on a keystroke; the only DOM it touches between keystrokes is its
 * own, and only when the step changes — twice an attempt. The beat itself is a CSS animation, which
 * runs only while the attempt is running and stops entirely when motion is reduced or off.
 */
function PaceCueBase({ engine, scale, text }: PaceCueProps) {
  const plan = useMemo(() => tempoPlan(scale.targetSpm, text), [scale.targetSpm, text])
  const rootRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const step = useRef(0)

  const paint = useCallback(
    (view: EngineView) => {
      const root = rootRef.current
      const label = labelRef.current
      if (root === null || label === null) return
      root.dataset['state'] = view.state
      const segment = paceAt(plan, view.cursor)
      if (segment === undefined || segment.step === step.current) return
      step.current = segment.step
      root.dataset['step'] = String(segment.step)
      root.style.setProperty('--pace-beat', `${Math.round(60_000 / segment.spm)}ms`)
      label.textContent = m.exercise_pace_label({
        spm: segment.spm,
        step: segment.step,
        steps: plan.length,
      })
    },
    [plan],
  )

  useEnginePaint(engine, paint)

  if (plan.length === 0) return null
  return (
    <div ref={rootRef} className="pace-cue" data-testid="pace-cue">
      <span className="pace-cue__dot" aria-hidden="true" />
      <span ref={labelRef} className="pace-cue__label" aria-live="polite" />
      <span className="pace-cue__steps" aria-hidden="true">
        {plan.map((segment) => (
          <span key={segment.step} className="pace-cue__tick" data-step={segment.step} />
        ))}
      </span>
    </div>
  )
}

export const PaceCue = memo(PaceCueBase)
