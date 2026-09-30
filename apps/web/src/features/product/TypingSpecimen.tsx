import { useEffect, useRef, useState } from 'react'
import './specimen.css'

/**
 * The hero's visual asset: the product typing, for real.
 *
 * A landing page for a typing trainer does not need a stock photograph of hands on a keyboard.
 * It needs to show the one thing that makes this trainer different from every other one, and the
 * quickest way to say it is to do it: type a line, hit a wrong key, watch the awaited character
 * get marked **in place** with nothing moving, correct it with Backspace, and watch the error
 * counter stay at one.
 *
 * That is FR-016, FR-017 and FR-024 demonstrated in eight seconds without a word of copy. It is
 * also honest — the same tokens, the same font, the same mark treatment as the real typing line,
 * so nobody arrives at the product and finds it looks different from the advert.
 *
 * Motion lives here rather than in the typing line itself: ticket 20's rule is expressive frame,
 * calm text, and this *is* the frame.
 */

const TEXT = 'фіва олдж фіва'
/** Where the deliberate mistake happens, and what gets typed instead. */
const WRONG_AT = 5
const WRONG_CHAR = 'ж'

type Step =
  | { kind: 'type'; index: number }
  | { kind: 'wrong' }
  | { kind: 'backspace' }
  | { kind: 'hold' }

/** Built once. The sequence is fixed, so there is nothing to compute per frame. */
function buildScript(): Step[] {
  const steps: Step[] = []
  const characters = [...TEXT]
  for (let i = 0; i < characters.length; i += 1) {
    if (i === WRONG_AT) {
      steps.push({ kind: 'wrong' }, { kind: 'backspace' })
    }
    steps.push({ kind: 'type', index: i })
  }
  steps.push({ kind: 'hold' })
  return steps
}

const SCRIPT = buildScript()

/** Unequal delays, because an even cadence reads as a machine rather than as someone typing. */
function delayFor(step: Step): number {
  if (step.kind === 'hold') return 2600
  if (step.kind === 'wrong') return 260
  if (step.kind === 'backspace') return 420
  return 110 + (step.index % 3) * 45
}

interface SpecimenState {
  readonly cursor: number
  readonly marked: boolean
  readonly errors: number
}

const FINAL: SpecimenState = { cursor: [...TEXT].length, marked: false, errors: 1 }
const START: SpecimenState = { cursor: 0, marked: false, errors: 0 }

export function TypingSpecimen() {
  // Read once rather than subscribed to: the specimen is decorative, and a learner who changes
  // the system setting mid-visit is not owed a re-render of an advertisement.
  const [reduced] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [state, setState] = useState<SpecimenState>(reduced ? FINAL : START)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // Reduced motion still gets the *point* — the finished line with its mark and its error count
    // — rather than a blank box. Turning motion off should cost the animation, not the message.
    if (reduced) return

    let step = 0
    const advance = () => {
      const current = SCRIPT[step % SCRIPT.length]
      if (!current) return

      setState((previous) => {
        if (current.kind === 'hold') return previous
        if (current.kind === 'wrong') {
          return { ...previous, marked: true, errors: previous.errors + 1 }
        }
        if (current.kind === 'backspace') {
          // The whole demonstration: the mark clears, the count does not (FR-024).
          return { ...previous, marked: false }
        }
        return { ...previous, cursor: current.index + 1, marked: false }
      })

      step += 1
      if (step % SCRIPT.length === 0) {
        timer.current = setTimeout(() => {
          setState(START)
          advance()
        }, 700)
        return
      }
      timer.current = setTimeout(advance, delayFor(current))
    }

    timer.current = setTimeout(advance, 900)
    return () => clearTimeout(timer.current)
  }, [reduced])

  const characters = [...TEXT]

  return (
    <figure className="specimen" aria-hidden="true">
      <div className="specimen__frame">
        <p className="specimen__line">
          {characters.map((char, index) => {
            const key = `${index}-${char}`
            const awaited = index === state.cursor
            const state_ =
              index < state.cursor ? 'typed' : awaited && state.marked ? 'marked' : 'upcoming'
            return (
              <span key={key} className="specimen__char" data-state={state_}>
                {char === ' ' ? ' ' : char}
                {awaited && !state.marked && <i className="specimen__caret" />}
                {awaited && state.marked && <i className="specimen__typed-wrong">{WRONG_CHAR}</i>}
              </span>
            )
          })}
        </p>

        <div className="specimen__readout">
          <span>
            <b>{state.errors}</b> помилка
          </span>
          <span className="specimen__note">не зменшується після виправлення</span>
        </div>
      </div>
    </figure>
  )
}
