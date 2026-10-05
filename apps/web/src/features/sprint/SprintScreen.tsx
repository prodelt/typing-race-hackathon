import { Link, useNavigate } from '@tanstack/react-router'
import { candidateWords, initialUnlockedSet } from '@typing-race/curriculum'
import type { InputSource, Layout } from '@typing-race/domain'
import type { Engine } from '@typing-race/engine'
import { Button, buttonClass, Card } from '@typing-race/ui'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useHoldPlayMode } from '../../app/playMode.js'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { domInputSource, seededRandom, systemClock } from '../../seams/index.js'
import { useEnginePaused } from '../exercise/engineHooks.js'
import { LayoutStatus, useLayoutCheck } from '../exercise/LayoutCheck.js'
import { PauseOverlay } from '../exercise/PauseOverlay.js'
import { TypedLayoutNotice, useTypedWrongLayout } from '../exercise/TypedLayoutNotice.js'
import { TypingLine } from '../exercise/TypingLine.js'
import '../exercise/play.css'
import { useWordBank } from '../words/useWordBank.js'
import {
  browserStore,
  isNewBest,
  readBest,
  SPRINT_SECONDS,
  type SprintScore,
  sprintText,
  startSprint,
  writeBest,
} from './model.js'

/**
 * Sprint 60 s: free practice against the clock. The words come from the learner's open letters
 * only; the layout is checked before the start, and the timer starts on the first keystroke. It
 * records no Attempt, so no XP, mastery or sync.
 */
export function SprintScreen() {
  const { layout, progress } = useDerived()
  const bank = useWordBank(layout.language)
  const [round, setRound] = useState(0)

  if (bank.status === 'loading') {
    return (
      <p role="status" className="py-16 font-ui text-ink-soft">
        {m.sprint_loading()}
      </p>
    )
  }
  const unlocked = progress?.unlockedSet ?? initialUnlockedSet(layout)
  const words =
    bank.status === 'ready'
      ? candidateWords(bank.bank, { unlocked, maxLength: 8, limit: 400 }).map((w) => w.word)
      : []
  if (words.length < 3) {
    return (
      <section className="mx-auto max-w-xl py-16">
        <h1 className="font-ui text-2xl font-bold">{m.sprint_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.sprint_locked()}</p>
        <Link to="/" className={`${buttonClass('primary', 'md')} mt-6`}>
          {m.sprint_home()}
        </Link>
      </section>
    )
  }
  return <SprintRun key={round} words={words} onAgain={() => setRound((r) => r + 1)} />
}

function SprintRun({
  words,
  onAgain,
}: {
  readonly words: readonly string[]
  readonly onAgain: () => void
}) {
  const { layout, accuracyFloor } = useDerived()
  const settings = useAppStore((state) => state.settings)
  const navigate = useNavigate()
  // A fresh seed per sprint, through the seam: the line is new each time and still reproducible.
  const [text] = useState(() => sprintText(words, seededRandom(Date.now() >>> 0), 90))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sourceRef = useRef<InputSource | null>(null)
  const [input, setInput] = useState<InputSource | null>(null)
  const [started, setStarted] = useState(false)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [left, setLeft] = useState(SPRINT_SECONDS)
  const [score, setScore] = useState<{ value: SprintScore; best: boolean } | null>(null)
  const [best, setBest] = useState(() => readBest(browserStore(), layout.language))

  // The input source exists before the start, as in an exercise, so the layout is checked first.
  useEffect(() => {
    const element = textareaRef.current
    if (element === null || sourceRef.current !== null) return
    const source = domInputSource(element, systemClock, { expectedLayoutId: layout.id })
    sourceRef.current = source
    setInput(source)
    source.focus()
  }, [layout.id])

  useEffect(() => {
    if (!started || input === null) return
    const sprint = startSprint({
      text,
      errorMode: settings.errorMode,
      input,
      clock: systemClock,
      layout,
      onEnd: (value) => {
        const newBest = isNewBest(value, readBest(browserStore(), layout.language), accuracyFloor)
        if (newBest) {
          writeBest(browserStore(), layout.language, value)
          setBest(value)
        }
        setScore({ value, best: newBest })
      },
    })
    const timer = window.setInterval(() => setLeft(sprint.tick()), 200)
    setEngine(sprint.engine)
    input.focus()
    return () => {
      window.clearInterval(timer)
      sprint.dispose()
      setEngine(null)
    }
  }, [started, input, text, settings.errorMode, layout, accuracyFloor])

  const running = started && score === null
  useHoldPlayMode(running)
  const paused = useEnginePaused(engine)
  const typedWrong = useTypedWrongLayout(input, layout, running)

  const resume = (): void => {
    engine?.resume()
    input?.focus()
  }

  // Escape pauses and resumes, as in an exercise; it reads no character and feeds no engine.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || engine === null) return
    if (engine.view.state === 'running') engine.pause()
    else if (engine.view.state === 'paused') resume()
  }

  // A click inside the page takes the focus back; leaving the window pauses the clock.
  const onBlur = (): void => {
    if (engine === null || input === null || engine.view.state !== 'running') return
    if (document.hasFocus()) input.focus()
    else engine.pause()
  }

  if (score !== null) {
    return (
      <section className="sprint mx-auto max-w-xl py-16 text-center" aria-live="polite">
        <h1 className="font-ui text-2xl font-bold">
          {score.best ? m.sprint_new_best() : m.sprint_done()}
        </h1>
        <dl className="sprint__stats">
          <div>
            <dt>{m.sprint_pace()}</dt>
            <dd data-testid="sprint-spm">{score.value.spm}</dd>
          </div>
          <div>
            <dt>{m.sprint_accuracy()}</dt>
            <dd data-testid="sprint-accuracy">{Math.round(score.value.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>{m.sprint_best()}</dt>
            <dd data-testid="sprint-best">{best === null ? '—' : best.spm}</dd>
          </div>
        </dl>
        {score.value.accuracy < accuracyFloor ? (
          <p className="mt-4 font-ui text-ink-soft">
            {m.sprint_below_floor({ floor: Math.round(accuracyFloor * 100) })}
          </p>
        ) : null}
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" size="md" onClick={onAgain}>
            {m.sprint_again()}
          </Button>
          <Link to="/" className={buttonClass('secondary', 'md')}>
            {m.sprint_home()}
          </Link>
        </div>
      </section>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a keydown on a wrapper is how Escape reaches the pause from the textarea and the dialog; every action here is also a real button
    <div onKeyDown={onKeyDown}>
      <textarea
        ref={textareaRef}
        className="sr-only"
        aria-label={m.exercise_input_label()}
        tabIndex={-1}
        rows={1}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onBlur={onBlur}
      />
      {!started && input !== null ? (
        <SprintStart layout={layout} input={input} best={best} onStart={() => setStarted(true)} />
      ) : null}
      {engine === null ? null : (
        <div className="play sprint">
          <section className="sprint__hud" aria-label={m.sprint_title()}>
            <h1 className="font-ui text-lg font-bold">{m.sprint_title()}</h1>
            <p className="sprint__timer" role="timer" aria-live="off" data-testid="sprint-timer">
              {left}
            </p>
            <p className="font-ui text-ink-soft">{m.sprint_instruction()}</p>
          </section>
          <div className="play__line">
            <TypingLine engine={engine} text={text} sizePx={settings.textSizePx} />
          </div>
          <TypedLayoutNotice layout={layout} wrong={typedWrong} />
          {paused ? (
            <PauseOverlay
              layout={layout}
              mode="practice"
              lastError={engine.view.lastError}
              onResume={resume}
              onLeave={() => void navigate({ to: '/' })}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Before the clock: what a sprint is, the best to beat, and the layout check (TZ §4.2). */
function SprintStart({
  layout,
  input,
  best,
  onStart,
}: {
  readonly layout: Layout
  readonly input: InputSource
  readonly best: SprintScore | null
  readonly onStart: () => void
}) {
  const check = useLayoutCheck(input, layout)
  return (
    <section aria-labelledby="sprint-title" className="mx-auto w-full max-w-2xl">
      <Card raised className="p-8">
        <h1 id="sprint-title" className="font-ui text-3xl font-semibold">
          {m.sprint_title()}
        </h1>
        <p className="mt-4 max-w-[60ch] font-ui text-lg leading-relaxed">{m.sprint_intro()}</p>
        {best === null ? null : (
          <p className="mt-2 font-ui text-sm text-ink/80" data-testid="sprint-start-best">
            {m.sprint_best()}: {best.spm} {m.sprint_pace()}
          </p>
        )}
        <LayoutStatus layout={layout} check={check} />
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" variant="primary" disabled={check.mismatch} onClick={onStart}>
            {m.exercise_start()}
          </Button>
          <Link to="/" className="font-ui text-sm text-sage underline underline-offset-4">
            {m.sprint_home()}
          </Link>
        </div>
        <p className="mt-3 font-ui text-xs text-ink/70">{m.sprint_instruction()}</p>
      </Card>
    </section>
  )
}
