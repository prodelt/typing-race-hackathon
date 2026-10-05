import { useNavigate } from '@tanstack/react-router'
import { boundaryFor, layouts } from '@typing-race/curriculum'
import type { Language, Layout } from '@typing-race/domain'
import { Button, cx } from '@typing-race/ui'
import { useEffect, useReducer, useRef, useState } from 'react'
import { LiveGradient } from '../../app/LiveGradient.js'
import { derive, initialState, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { LAYOUT_NAMES } from '../exercise/labels.js'
import { STARTING_LEVELS } from '../path/labels.js'
import { Diagnostic } from './Diagnostic.js'
import { FingerScheme } from './FingerScheme.js'
import { useFirstRunHold } from './hold.js'
import {
  canContinue,
  type FlowMode,
  type FlowState,
  finishPlan,
  firstExerciseId,
  initialFlow,
  LAYOUT_OF,
  levelOffered,
  type Recorded,
  reduceFlow,
  STEPS,
  stepNumber,
} from './model.js'
import './firstrun.css'

/**
 * First run, in the shell: language → level (an optional short check, or a pick) → the finger
 * scheme → the first exercise, opened straight into Play Mode. One step per screen, a step
 * indicator, and the keyboard drives it: Enter continues, Esc goes back, digits pick.
 *
 * `first` is what a fresh profile sees on Home (and on the Map). `again` is Settings' "start over":
 * the same walk, with the levels already recorded as the forward-only floor and nothing deleted.
 */
export function FirstRun({ mode }: { readonly mode: FlowMode }) {
  const language = useAppStore((state) => state.settings.typingLanguage)
  const recordedStartingLevels = useAppStore((state) => state.recordedStartingLevels)
  const [recorded, setRecorded] = useState<Recorded | null>(null)

  useEffect(() => {
    let live = true
    recordedStartingLevels()
      .catch(() => ({}))
      .then((value) => {
        if (live) setRecorded(value)
      })
    return () => {
      live = false
    }
  }, [recordedStartingLevels])

  // The read is a single IndexedDB get; drawing nothing for it avoids a flow that resets itself.
  if (recorded === null) return <div className="fr" aria-busy="true" />
  return <Flow mode={mode} language={language} recorded={recorded} />
}

const STEP_NAMES: Record<(typeof STEPS)[number], () => string> = {
  language: () => m.firstrun_step_language(),
  level: () => m.firstrun_step_level(),
  fingers: () => m.firstrun_step_fingers(),
}

const LANGUAGES: readonly Language[] = ['uk', 'en']

function Flow(props: {
  readonly mode: FlowMode
  readonly language: Language
  readonly recorded: Recorded
}) {
  const [state, send] = useReducer(reduceFlow, props, initialFlow)
  const navigate = useNavigate()
  const changeSettings = useAppStore((s) => s.changeSettings)
  const chooseStartingLevel = useAppStore((s) => s.chooseStartingLevel)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const layout = layouts[LAYOUT_OF[state.language]]
  const [busy, setBusy] = useState(false)

  // Each step announces itself: focus moves to its heading, which a screen reader reads out and
  // which leaves Enter, Esc and the digits to the flow.
  const step = state.step
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    if (step !== 'diagnostic') titleRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => () => useFirstRunHold.setState({ holding: false }), [])

  const finish = async (): Promise<void> => {
    if (state.level === null || busy) return
    setBusy(true)
    const current = useAppStore.getState().settings.typingLanguage
    const plan = finishPlan({
      currentLanguage: current,
      language: state.language,
      level: state.level,
    })
    useFirstRunHold.setState({ holding: true })
    if (plan.switchLanguage !== null) await changeSettings({ typingLanguage: plan.switchLanguage })
    await chooseStartingLevel(plan.level)
    const store = useAppStore.getState()
    const { nextAction } = derive({ ...initialState, ...store })
    if (nextAction === null) {
      void navigate({ to: '/' })
      return
    }
    void navigate({
      to: '/exercise/$scaleId',
      params: {
        scaleId: firstExerciseId(layout, plan.level, nextAction.startsScaleId),
      },
      search: { mode: 'practice', start: true },
    })
  }

  const next = (): void => {
    if (state.step === 'fingers') void finish()
    else send({ type: 'next' })
  }

  const back = (): void => {
    if (state.step === 'language') {
      if (props.mode === 'again') void navigate({ to: '/settings' })
      return
    }
    send({ type: 'back' })
  }

  /** Digits pick an option on the step that has them; `true` when the digit was used. */
  const pick = (n: number): boolean => {
    if (state.step === 'language') {
      const language = LANGUAGES[n - 1]
      if (language === undefined) return false
      send({ type: 'pickLanguage', language })
      return true
    }
    if (state.step === 'level') {
      if (n === STARTING_LEVELS.length + 1) {
        send({ type: 'startDiagnostic' })
        return true
      }
      const option = STARTING_LEVELS[n - 1]
      if (option === undefined) return false
      send({ type: 'pickLevel', level: option.choice })
      return true
    }
    return false
  }

  const keys = useRef({ next, back, pick, step: state.step })
  keys.current = { next, back, pick, step: state.step }

  // Capture on the window, so the flow sees a key before the shell's 1–5 destination keys do.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const { next, back, pick, step } = keys.current
      if (event.key === 'Escape') {
        if (target?.closest('[role="dialog"]')) return
        event.preventDefault()
        back()
        return
      }
      // The check's typing surface and the finger scheme read keys themselves.
      if (step === 'diagnostic' || step === 'fingers') {
        if (event.key === 'Enter' && step === 'fingers' && !target?.closest('a, button')) {
          event.preventDefault()
          next()
        }
        return
      }
      if (target?.isContentEditable) return
      if (target?.closest('textarea, select, input:not([type="radio"])')) return
      if (event.key === 'Enter') {
        if (target?.closest('a, button, summary')) return
        event.preventDefault()
        next()
        return
      }
      const digit = /^Digit([1-9])$/.exec(event.code) ?? /^Numpad([1-9])$/.exec(event.code)
      if (digit !== null && pick(Number(digit[1]))) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const n = stepNumber(state.step)
  const hints = keyHints(state.step, props.mode)

  return (
    <div className="fr" data-step={state.step} data-testid="first-run">
      <header className="fr-head">
        <p className="fr-kicker">
          <span className="fr-idx">00</span>
          {props.mode === 'first' ? m.firstrun_kicker_first() : m.firstrun_kicker_again()}
        </p>
        <ol className="fr-steps" aria-label={m.firstrun_steps_label()}>
          {STEPS.map((id, i) => {
            const at = i + 1
            const status = at < n ? 'done' : at === n ? 'now' : 'later'
            return (
              <li
                key={id}
                className="fr-steps__item"
                data-status={status}
                aria-current={status === 'now' ? 'step' : undefined}
              >
                <span className="fr-steps__n num">{at}</span>
                <span className="fr-steps__name">{STEP_NAMES[id]()}</span>
              </li>
            )
          })}
          <li className="fr-steps__item fr-steps__item--goal" data-status="later">
            <span className="fr-steps__flag" aria-hidden="true" />
            <span className="fr-steps__name">{m.firstrun_step_play()}</span>
          </li>
        </ol>
        <p className="fr-count">{m.firstrun_step_of({ n })}</p>
      </header>

      <div className="fr-body" key={state.step}>
        {state.step === 'language' && (
          <LanguageStep
            state={state}
            titleRef={titleRef}
            onPick={(language) => send({ type: 'pickLanguage', language })}
          />
        )}
        {state.step === 'level' && (
          <LevelStep
            state={state}
            layout={layout}
            titleRef={titleRef}
            onPick={(level) => send({ type: 'pickLevel', level })}
            onCheck={() => send({ type: 'startDiagnostic' })}
          />
        )}
        {state.step === 'diagnostic' && (
          <Diagnostic
            language={state.language}
            layout={layout}
            onDone={(result) => send({ type: 'diagnosticDone', result })}
          />
        )}
        {state.step === 'fingers' && <FingerScheme layout={layout} titleRef={titleRef} />}
      </div>

      <footer className="fr-foot">
        {state.step === 'language' && props.mode === 'first' ? (
          <span />
        ) : (
          <Button variant="secondary" hint="Esc" aria-keyshortcuts="Escape" onClick={back}>
            {state.step === 'language'
              ? m.firstrun_cancel()
              : state.step === 'diagnostic'
                ? m.firstrun_diag_skip()
                : m.firstrun_back()}
          </Button>
        )}
        <p className="fr-keys">{hints.join(' · ')}</p>
        {state.step === 'diagnostic' ? (
          <span />
        ) : (
          <Button
            variant="primary"
            size="lg"
            hint="Enter"
            aria-keyshortcuts="Enter"
            disabled={!canContinue(state) || busy}
            onClick={next}
            data-testid="first-run-next"
          >
            {state.step === 'fingers'
              ? props.mode === 'first'
                ? m.firstrun_play()
                : m.firstrun_play_again()
              : m.firstrun_next()}
          </Button>
        )}
      </footer>
    </div>
  )
}

/** The keys that work on this step, said once in the foot bar. */
function keyHints(step: FlowState['step'], mode: FlowMode): readonly string[] {
  switch (step) {
    case 'language':
      return [
        m.firstrun_keys_pick({ keys: '1 · 2' }),
        m.firstrun_keys_next(),
        ...(mode === 'again' ? [m.firstrun_keys_back()] : []),
      ]
    case 'level':
      return [
        m.firstrun_keys_pick({ keys: '1 · 2 · 3 · 4' }),
        m.firstrun_keys_next(),
        m.firstrun_keys_back(),
      ]
    case 'diagnostic':
      return [m.firstrun_keys_skip()]
    default:
      return [m.firstrun_keys_try(), m.firstrun_keys_play(), m.firstrun_keys_back()]
  }
}

type TitleRef = React.RefObject<HTMLHeadingElement | null>

function StepTitle({
  titleRef,
  children,
}: {
  readonly titleRef: TitleRef
  readonly children: string
}) {
  return (
    <h1 className="fr-title" ref={titleRef} tabIndex={-1}>
      {children}
    </h1>
  )
}

/* ---- 1 Language ------------------------------------------------------------------------- */

function LanguageStep(props: {
  readonly state: FlowState
  readonly titleRef: TitleRef
  readonly onPick: (language: Language) => void
}) {
  return (
    <section className="fr-step" aria-labelledby="fr-lang-title">
      <div className="fr-intro" id="fr-lang-title">
        <StepTitle titleRef={props.titleRef}>{m.firstrun_lang_title()}</StepTitle>
        <p className="fr-lead">{m.firstrun_lang_lead()}</p>
      </div>
      <fieldset className="fr-choices fr-choices--2">
        <legend className="sr-only">{m.firstrun_lang_group()}</legend>
        {LANGUAGES.map((language, i) => {
          const layout = layouts[LAYOUT_OF[language]]
          const on = props.state.language === language
          return (
            <label key={language} className={cx('fr-choice fr-choice--lang', on && 'is-on')}>
              {on ? <LiveGradient tone="ember" /> : null}
              <input
                type="radio"
                name="fr-language"
                className="fr-choice__radio"
                checked={on}
                onChange={() => props.onPick(language)}
              />
              <span className="fr-choice__top">
                <span className="kbd" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="fr-choice__code num">{language === 'uk' ? 'УКР' : 'ENG'}</span>
              </span>
              <span className="fr-choice__name">
                {language === 'uk' ? m.firstrun_lang_uk() : m.firstrun_lang_en()}
              </span>
              <span className="fr-choice__sub">
                {m.firstrun_lang_layout({ layout: LAYOUT_NAMES[layout.id] })}
              </span>
              <HomeRow layout={layout} />
            </label>
          )
        })}
      </fieldset>
    </section>
  )
}

/** The eight anchor keys, the way the fingers will rest on them. */
function HomeRow({ layout }: { readonly layout: Layout }) {
  const half = layout.homeAnchors.length / 2
  return (
    <span className="fr-home" aria-hidden="true">
      {layout.homeAnchors.map((char, i) => (
        <span key={char} className={cx('fr-home__key', i === half && 'fr-home__key--gap')}>
          {char}
        </span>
      ))}
    </span>
  )
}

/* ---- 2 Level ---------------------------------------------------------------------------- */

function LevelStep(props: {
  readonly state: FlowState
  readonly layout: Layout
  readonly titleRef: TitleRef
  readonly onPick: (level: FlowState['level'] & string) => void
  readonly onCheck: () => void
}) {
  const { state, layout } = props
  const recorded = state.recorded[state.language]
  const advised = state.recommended

  return (
    <section className="fr-step" aria-labelledby="fr-level-title">
      <div className="fr-intro" id="fr-level-title">
        <StepTitle titleRef={props.titleRef}>{m.path_start_title()}</StepTitle>
        <p className="fr-lead">{m.path_start_lead()}</p>
      </div>
      <fieldset className="fr-choices fr-choices--4">
        <legend className="sr-only">{m.firstrun_level_group()}</legend>
        {STARTING_LEVELS.map((option, i) => {
          const offered = levelOffered(layout, option.choice, recorded)
          const on = state.level === option.choice
          const opens = layout.homeAnchors.length + boundaryFor(layout, option.choice)
          return (
            <label
              key={option.choice}
              className={cx('fr-choice fr-choice--level', on && 'is-on', !offered && 'is-off')}
            >
              {on ? <LiveGradient tone="ember" /> : null}
              <input
                type="radio"
                name="fr-level"
                className="fr-choice__radio"
                checked={on}
                disabled={!offered}
                onChange={() => props.onPick(option.choice)}
              />
              <span className="fr-choice__top">
                <span className="kbd" aria-hidden="true">
                  {i + 1}
                </span>
                {advised === option.choice ? (
                  <span className="fr-tag">{m.firstrun_level_advised()}</span>
                ) : recorded === option.choice ? (
                  <span className="fr-tag">{m.firstrun_level_recorded()}</span>
                ) : null}
              </span>
              <span className="fr-choice__name">{option.title()}</span>
              <span className="fr-choice__sub">{option.body()}</span>
              <span className="fr-choice__opens" data-opens={opens}>
                <span className="num">{opens}</span>
                <span>{offered ? m.firstrun_level_keys() : m.path_start_lower_disabled()}</span>
              </span>
            </label>
          )
        })}
        <button type="button" className="fr-choice fr-choice--check" onClick={props.onCheck}>
          <span className="fr-choice__top">
            <span className="kbd" aria-hidden="true">
              4
            </span>
          </span>
          <span className="fr-choice__name">{m.firstrun_level_test_title()}</span>
          <span className="fr-choice__sub">{m.firstrun_level_test_body()}</span>
          <span className="fr-check__line" aria-hidden="true">
            {CHECK_DOTS.map((dot) => (
              <span key={dot} />
            ))}
          </span>
        </button>
      </fieldset>
      <Advice state={state} />
    </section>
  )
}

/** The check tile's little track: four typed, the caret, four to go. */
const CHECK_DOTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const

function Advice({ state }: { readonly state: FlowState }) {
  const advice = state.advice
  if (advice === null || state.recommended === null) return null
  const option = STARTING_LEVELS.find((o) => o.choice === state.recommended)
  return (
    <p className="fr-advice" role="status" data-testid="first-run-advice">
      {m.firstrun_level_advice({
        cpm: advice.cpm,
        accuracy: Math.round(advice.accuracy * 100),
        level: option?.title() ?? '',
      })}
    </p>
  )
}
