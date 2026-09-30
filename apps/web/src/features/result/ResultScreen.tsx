import { useNavigate, useParams } from '@tanstack/react-router'
import { isAcademyExerciseId } from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { AcademyNextCard } from '../academy/NextCard.js'
import { order, ScreenHead } from '../screen.js'
import { UnlockWords } from '../words/UnlockWords.js'
import { Comparison } from './Comparison.js'
import { ErrorList } from './ErrorList.js'
import { duration, number } from './format.js'
import { Metrics } from './Metrics.js'
import { buildResultModel } from './model.js'
import { NextActionCard } from './NextActionCard.js'
import { RhythmChart } from './RhythmChart.js'
import { UnlockCard } from './UnlockCard.js'
import './result.css'

/**
 * The result screen. The route gives it `{ attemptId }`; everything else comes from the stored
 * attempt list, so a reload or a link to an old result renders the same page.
 *
 * One hero number, speed, with accuracy right beside it (speed never counts without it), the two
 * smaller figures after them, and then the one next action as the screen's poster button. The
 * detail (errors per character, rhythm, the comparison, every figure) follows as numbered
 * sections, the way the brand site continues below its hero.
 */

function Hero({ attempt }: { readonly attempt: AttemptSummary }) {
  const { metrics } = attempt
  return (
    <section aria-label={m.result_tiles_label()} className="rhero">
      <dl className="rhero__list">
        <div className="rhero__spm result-tile" style={order(0)}>
          <dt className="rhero__label">{m.result_tile_spm()}</dt>
          <dd className="num num--red rhero__big">{number(metrics.spm)}</dd>
          <dd className="rhero__hint">{m.result_tile_spm_hint()}</dd>
        </div>
        <div className="rhero__acc result-tile" style={order(1)}>
          <dt className="rhero__label">{m.result_tile_accuracy()}</dt>
          <dd className="num rhero__mid">
            {number(metrics.accuracy * 100, 1)}
            <span className="rhero__pct"> %</span>
          </dd>
          <dd className="rhero__hint">{m.result_tile_accuracy_hint()}</dd>
        </div>
        <div className="rhero__small result-tile" style={order(2)}>
          <dt className="rhero__label">{m.result_tile_errors()}</dt>
          <dd className="rhero__value">{number(metrics.errorCount)}</dd>
          <dd className="rhero__hint">{m.result_tile_errors_hint()}</dd>
        </div>
        <div className="rhero__small result-tile" style={order(3)}>
          <dt className="rhero__label">{m.result_tile_time()}</dt>
          <dd className="rhero__value">{duration(attempt.elapsedMs)}</dd>
          <dd className="rhero__hint">{m.result_tile_time_hint()}</dd>
        </div>
      </dl>
    </section>
  )
}

export function ResultScreen() {
  const { attemptId } = useParams({ strict: false })
  const navigate = useNavigate()
  const attempts = useAppStore((state) => state.attempts)
  const startingLevelChoice = useAppStore((state) => state.startingLevelChoice)

  const model = useMemo(() => {
    // An Academy attempt needs no Stage 1 starting level: the Academy can be opened directly.
    const academy = isAcademyExerciseId(attempts.find((a) => a.id === attemptId)?.scaleId ?? '')
    const choice = startingLevelChoice ?? (academy ? 'neverTouchTyped' : null)
    return buildResultModel({ attempts, attemptId, startingLevelChoice: choice })
  }, [attempts, attemptId, startingLevelChoice])

  if (model === null) {
    return (
      <section className="screen">
        <ScreenHead
          n={2}
          label={m.result_title()}
          title={m.result_not_found_title()}
          lede={m.result_not_found_body()}
        >
          <Button
            variant="primary"
            size="lg"
            className="mt-8"
            onClick={() => {
              void navigate({ to: '/today' })
            }}
          >
            {m.result_go_today()}
          </Button>
        </ScreenHead>
      </section>
    )
  }

  const { attempt } = model
  return (
    <section className="screen result">
      <ScreenHead
        n={2}
        label={attempt.mode === 'test' ? m.result_mode_test() : m.result_mode_practice()}
        title={m.result_title()}
        small
      />

      <Hero attempt={attempt} />

      {model.unlock === null ? null : <UnlockCard unlock={model.unlock} attemptId={attempt.id} />}

      {isAcademyExerciseId(attempt.scaleId) ? (
        <AcademyNextCard attempt={attempt} />
      ) : (
        <>
          {model.unlock === null ? null : (
            <UnlockWords
              layoutId={attempt.layoutId}
              unlockKey={model.unlock.key}
              unlocked={model.unlock.unlockedAfter}
            />
          )}
          <NextActionCard model={model} />
        </>
      )}

      <div className="result__grid">
        <ErrorList attempt={attempt} />
        <Comparison attempt={attempt} previous={model.previousBest} />
      </div>
      <RhythmChart attempt={attempt} />
      <Metrics attempt={attempt} />
      {model.logPruned ? (
        <p className="note mt-8" data-testid="pruned-note">
          {m.result_pruned_note()}
        </p>
      ) : null}
    </section>
  )
}
