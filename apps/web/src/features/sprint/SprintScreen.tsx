import { Link } from '@tanstack/react-router'
import { candidateWords, initialUnlockedSet } from '@typing-race/curriculum'
import type { InputSource } from '@typing-race/domain'
import { createEngine, type Engine } from '@typing-race/engine'
import { Button, buttonClass } from '@typing-race/ui'
import { useEffect, useRef, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { domInputSource, systemClock } from '../../seams/index.js'
import { TypingLine } from '../exercise/TypingLine.js'
import '../exercise/play.css'
import { useWordBank } from '../words/useWordBank.js'
import {
  browserStore,
  isNewBest,
  readBest,
  SPRINT_MS,
  type SprintScore,
  secondsLeft,
  sprintText,
  writeBest,
} from './model.js'

/**
 * Sprint 60 s: free practice against the clock. The words come from the learner's open letters
 * only; the timer starts on the first keystroke. It records no Attempt, so no XP, mastery or sync.
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
  const errorMode = useAppStore((state) => state.settings.errorMode)
  const [text] = useState(() => sprintText(words, Math.random, 90))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState<InputSource | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [left, setLeft] = useState(60)
  const [score, setScore] = useState<{ value: SprintScore; best: boolean } | null>(null)
  const [best, setBest] = useState(() => readBest(browserStore(), layout.language))

  useEffect(() => {
    const element = textareaRef.current
    if (element === null) return
    const source = domInputSource(element, systemClock, { expectedLayoutId: layout.id })
    setInput(source)
    source.focus()
  }, [layout.id])

  useEffect(() => {
    if (input === null) return
    const created = createEngine({ text, errorMode, input, clock: systemClock, layout })
    let startedAt: number | null = null
    let done = false
    const end = (): void => {
      if (done) return
      done = true
      const view = created.view
      const typed = view.cursor
      // Finishing the whole line early still scores per minute of the time actually used.
      const used = startedAt === null ? SPRINT_MS : systemClock.now() - startedAt
      const minutes = Math.max(1000, Math.min(SPRINT_MS, used)) / 60_000
      const value: SprintScore = {
        spm: Math.round(typed / minutes),
        accuracy: typed + view.errorCount === 0 ? 0 : typed / (typed + view.errorCount),
      }
      created.abandon()
      const stored = readBest(browserStore(), layout.language)
      const newBest = isNewBest(value, stored, accuracyFloor)
      if (newBest) {
        writeBest(browserStore(), layout.language, value)
        setBest(value)
      }
      setScore({ value, best: newBest })
    }
    const stop = created.onChange((view) => {
      if (view.state === 'running' && startedAt === null) startedAt = systemClock.now()
      if (view.state === 'completed') end()
    })
    const timer = window.setInterval(() => {
      if (startedAt === null || done) return
      const elapsed = systemClock.now() - startedAt
      setLeft(secondsLeft(elapsed))
      if (elapsed >= SPRINT_MS) end()
    }, 200)
    setEngine(created)
    input.focus()
    return () => {
      stop()
      window.clearInterval(timer)
      if (!done) created.abandon()
      setEngine(null)
    }
  }, [input, text, errorMode, layout, accuracyFloor])

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
    <div className="play sprint">
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
        onBlur={() => {
          if (document.hasFocus()) input?.focus()
        }}
      />
      <section className="play-hud sprint__hud" aria-label={m.sprint_title()}>
        <h1 className="font-ui text-lg font-bold">{m.sprint_title()}</h1>
        <p className="sprint__timer" role="timer" aria-live="off" data-testid="sprint-timer">
          {left}
        </p>
        <p className="font-ui text-ink-soft">{m.sprint_instruction()}</p>
      </section>
      <div className="play__line">
        {engine === null ? null : <TypingLine engine={engine} text={text} sizePx={28} />}
      </div>
    </div>
  )
}
