import { useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import './specimen.css'

/**
 * The hero's live demo: the product typing, for real.
 *
 * A landing page for a typing trainer does not need a photograph of hands on a keyboard. It needs
 * to show the one thing that makes this trainer different, and the quickest way to say it is to
 * do it: type a line, hit a wrong key, watch the awaited character get marked **in place** with
 * nothing moving, correct it with Backspace, and watch the error count stay at one while the
 * accuracy stays honest.
 *
 * The same font and the same error mark as the real typing line, so nobody arrives at the product
 * and finds it looks different from the advert.
 */

interface Script {
  readonly text: string
  /** Where the deliberate mistake happens, and what gets typed instead. */
  readonly wrongAt: number
  readonly wrongChar: string
}

const SCRIPTS: Record<string, Script> = {
  uk: { text: 'фіва олдж фіва', wrongAt: 5, wrongChar: 'ж' },
  en: { text: 'asdf jkl; asdf', wrongAt: 5, wrongChar: ';' },
}

type Step =
  | { kind: 'type'; index: number }
  | { kind: 'wrong' }
  | { kind: 'backspace' }
  | { kind: 'hold' }

function buildSteps(script: Script): Step[] {
  const steps: Step[] = []
  const characters = [...script.text]
  for (let i = 0; i < characters.length; i += 1) {
    if (i === script.wrongAt) steps.push({ kind: 'wrong' }, { kind: 'backspace' })
    steps.push({ kind: 'type', index: i })
  }
  steps.push({ kind: 'hold' })
  return steps
}

/** Unequal delays, because an even cadence reads as a machine rather than as someone typing. */
function delayFor(step: Step): number {
  if (step.kind === 'hold') return 2600
  if (step.kind === 'wrong') return 320
  if (step.kind === 'backspace') return 480
  return 115 + (step.index % 3) * 50
}

interface SpecimenState {
  readonly cursor: number
  readonly marked: boolean
  readonly errors: number
}

const START: SpecimenState = { cursor: 0, marked: false, errors: 0 }

export interface TypingSpecimenProps {
  /** False freezes the demo where it is (the hero's pause button, or motion turned down). */
  readonly playing: boolean
  /** True shows the finished line with its one error, for motion-off and reduced motion. */
  readonly still: boolean
}

export function TypingSpecimen({ playing, still }: TypingSpecimenProps) {
  const script = SCRIPTS[getLocale()] ?? (SCRIPTS['uk'] as Script)
  const characters = [...script.text]
  const final: SpecimenState = { cursor: characters.length, marked: false, errors: 1 }

  const [state, setState] = useState<SpecimenState>(still ? final : START)
  const step = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (still) {
      setState({ cursor: [...script.text].length, marked: false, errors: 1 })
      return
    }
    if (!playing) return

    const steps = buildSteps(script)
    const advance = () => {
      const current = steps[step.current % steps.length]
      if (current === undefined) return

      setState((previous) => {
        if (current.kind === 'hold') return previous
        if (current.kind === 'wrong')
          return { ...previous, marked: true, errors: previous.errors + 1 }
        // The whole demonstration: the mark clears, the count does not.
        if (current.kind === 'backspace') return { ...previous, marked: false }
        return { ...previous, cursor: current.index + 1, marked: false }
      })

      step.current += 1
      if (step.current % steps.length === 0) {
        timer.current = setTimeout(() => {
          setState(START)
          advance()
        }, 700)
        return
      }
      timer.current = setTimeout(advance, delayFor(current))
    }

    timer.current = setTimeout(advance, step.current === 0 ? 1400 : 300)
    return () => clearTimeout(timer.current)
  }, [playing, still, script])

  // Accuracy exactly as the product computes it: correct keystrokes over all character
  // keystrokes, the wrong one included for ever.
  const keystrokes = state.cursor + state.errors
  const accuracy = keystrokes === 0 ? 100 : Math.round((state.cursor / keystrokes) * 100)

  return (
    <figure className="specimen" aria-hidden="true">
      <figcaption className="specimen__bar">
        <span className="specimen__live" data-playing={(playing && !still) || undefined} />
        {m.product_specimen_label()}
        <span className="specimen__layout">{getLocale() === 'en' ? 'QWERTY' : 'ЙЦУКЕН'}</span>
      </figcaption>

      <p className="specimen__line">
        {characters.map((char, index) => {
          const key = `${index}-${char}`
          const awaited = index === state.cursor
          const charState =
            index < state.cursor ? 'typed' : awaited && state.marked ? 'marked' : 'upcoming'
          return (
            <span key={key} className="specimen__char" data-state={charState}>
              {char}
              {awaited && !state.marked && <i className="specimen__caret" />}
              {awaited && state.marked && (
                <i className="specimen__typed-wrong">{script.wrongChar}</i>
              )}
            </span>
          )
        })}
        {state.cursor === characters.length && (
          <span className="specimen__char">
            {' '}
            <i className="specimen__caret" />
          </span>
        )}
      </p>

      <div className="specimen__readout">
        <div>
          <span className="specimen__k">{m.product_specimen_errors()}</span>
          <b className="specimen__v specimen__v--error">{state.errors}</b>
        </div>
        <div>
          <span className="specimen__k">{m.product_specimen_accuracy()}</span>
          <b className="specimen__v">
            {accuracy}
            <small>%</small>
          </b>
        </div>
      </div>
      <p className="specimen__note">{m.product_specimen_note()}</p>
    </figure>
  )
}
