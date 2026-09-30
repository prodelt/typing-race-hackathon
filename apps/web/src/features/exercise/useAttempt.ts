import { useNavigate } from '@tanstack/react-router'
import type {
  Attempt,
  AttemptMode,
  ErrorMode,
  InputSource,
  Layout,
  Scale,
} from '@typing-race/domain'
import { createEngine, type Engine } from '@typing-race/engine'
import { computeAggregates, computeMetrics } from '@typing-race/metrics'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { systemClock } from '../../seams/index.js'
import { newAttemptId } from './plan.js'

export interface AttemptConfig {
  /** `false` on the pre-start screen: no engine exists, so nothing can start by accident. */
  readonly active: boolean
  readonly input: InputSource | null
  readonly scale: Scale
  readonly mode: AttemptMode
  readonly layout: Layout
  readonly errorMode: ErrorMode
  readonly text: string
  readonly seed: number
}

/**
 * The attempt's controller: it creates the engine, tells the store an attempt is under way, and
 * turns a completed engine into an `Attempt`.
 *
 * Everything that happens here happens at the edges of an attempt (Start, completion, leaving),
 * never per keystroke, which is why it may use React state and the store freely. `beginAttempt`
 * runs on Start rather than on the first character so that the shell dims its navigation (FR-057)
 * *before* typing begins: the one store change the attempt causes has already happened by the
 * first keystroke, and FR-069 holds from that keystroke on.
 *
 * Setup and teardown are one effect, so a development double-mount builds a fresh engine instead
 * of reviving one that teardown has abandoned.
 */
export function useAttempt(config: AttemptConfig): Engine | null {
  const { active, input, scale, mode, layout, errorMode, text, seed } = config
  const [engine, setEngine] = useState<Engine | null>(null)
  const beginAttempt = useAppStore((state) => state.beginAttempt)
  const finishAttempt = useAppStore((state) => state.finishAttempt)
  const abandonAttempt = useAppStore((state) => state.abandonAttempt)
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    if (!active || input === null) return

    const created = createEngine({ text, errorMode, input, clock: systemClock, layout })
    let startedAt: number | null = null
    let concluded = false

    const conclude = async (): Promise<void> => {
      // Metrics are derived from the log after the fact, never accumulated while typing (FR-019).
      const log = created.finish()
      const { elapsedMs } = created.view
      const attempt: Attempt = {
        id: newAttemptId(),
        scaleId: scale.id,
        layoutId: layout.id,
        language: layout.language,
        mode,
        text,
        seed,
        startedAt: startedAt ?? Date.now(),
        completedAt: Date.now(),
        elapsedMs,
        metrics: computeMetrics({ log, text, layout, elapsedMs }),
        aggregates: computeAggregates({ log, text, layout }),
        log,
      }
      try {
        await finishAttempt(attempt)
      } catch (error) {
        // Storage failed; the result is still in the store's memory (FR-052), so show it anyway.
        console.error('The attempt could not be saved', error)
      }
      void navigateRef.current({ to: '/result/$attemptId', params: { attemptId: attempt.id } })
    }

    const stop = created.onChange((view) => {
      if (view.state === 'running' && startedAt === null) startedAt = Date.now()
      if (view.state === 'completed' && !concluded) {
        concluded = true
        void conclude()
      }
    })

    beginAttempt()
    setEngine(created)
    input.focus()

    return () => {
      stop()
      if (!concluded) {
        // Leaving an unfinished attempt produces no Attempt at all (data-model.md).
        created.abandon()
        abandonAttempt()
      }
      setEngine(null)
    }
  }, [
    active,
    input,
    text,
    errorMode,
    layout,
    scale.id,
    mode,
    seed,
    beginAttempt,
    finishAttempt,
    abandonAttempt,
  ])

  return engine
}
