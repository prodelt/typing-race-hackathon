import { useNavigate, useParams } from '@tanstack/react-router'
import {
  isAcademyExerciseId,
  isReviewDrillId,
  reviewDrillId,
  SLOW_IKI_MS,
} from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { Button, prefersReducedMotion, resolveMotion } from '@typing-race/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGuideScreen } from '../../app/guide/model.js'
import { LiveGradient } from '../../app/LiveGradient.js'
import { useScreenKeys } from '../../app/screenKeys.js'
import { playCue } from '../../app/sound.js'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { AcademyNextCard } from '../academy/NextCard.js'
import { ReviewOutcome } from '../review/Outcome.js'
import { UnlockWords } from '../words/UnlockWords.js'
import { Comparison } from './Comparison.js'
import { ErrorList } from './ErrorList.js'
import { exerciseLabel, useAcademyTitle } from './exerciseLabel.js'
import { duration, number } from './format.js'
import { Metrics } from './Metrics.js'
import { buildResultModel, displayChar, type ResultModel, transitionLabel } from './model.js'
import { NextActionCard } from './NextActionCard.js'
import { nextStartMode, practiceAdvice } from './nextStart.js'
import { RhythmChart } from './RhythmChart.js'
import type { Reward } from './reward.js'
import { UnlockCard } from './UnlockCard.js'
import './result.css'

/**
 * The result screen as a reward (direction B). The top of the screen is the moment: what the
 * attempt counted for, the four headline numbers counting up, the comparison with the best
 * earlier run, the XP flying into the status bar, the mastery slots and the slowest move. Below
 * it, the full record the requirements ask for: rhythm, errors by character, every metric.
 *
 * The route gives it `{ attemptId }`; everything else comes from the stored attempt list, so a
 * reload or a link to an old result renders the same page.
 */
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
      <section className="mx-auto max-w-xl">
        <h1 className="font-ui text-2xl font-bold">{m.result_not_found_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.result_not_found_body()}</p>
        <Button
          variant="primary"
          className="mt-5"
          onClick={() => {
            void navigate({ to: '/' })
          }}
        >
          {m.result_go_today()}
        </Button>
      </section>
    )
  }

  return <RewardView model={model} attempts={attempts} />
}

function RewardView({
  model,
  attempts,
}: {
  readonly model: ResultModel
  readonly attempts: readonly AttemptSummary[]
}) {
  const navigate = useNavigate()
  const { attempt, reward } = model
  const academy = isAcademyExerciseId(attempt.scaleId)
  const drillId =
    reward.weakest === null ? undefined : reviewDrillId(model.layout, [reward.weakest.element])

  const home = (): void => void navigate({ to: '/' })
  const again = (): void => {
    if (academy) {
      void navigate({
        to: '/academy/$exerciseId',
        params: { exerciseId: attempt.scaleId },
        search: { mode: attempt.mode },
      })
      return
    }
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: attempt.scaleId },
      search: { mode: attempt.mode },
    })
  }
  const next = (): void => {
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: model.next.startsScaleId },
      search: { mode: nextStartMode(attempt, model.next, reward.floor) },
    })
  }
  const drill = (): void => {
    if (drillId === undefined) return
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: drillId },
      search: { mode: 'practice' },
    })
  }

  useGuideScreen('result')

  useScreenKeys({
    Escape: home,
    KeyR: again,
    ...(academy ? {} : { Enter: next, KeyD: drill }),
  })

  const label = exerciseLabel(model.layout, attempt.scaleId, useAcademyTitle(attempt.scaleId))

  return (
    <div className="reward">
      <div className="reward__fold">
        <ScorePanel model={model} label={label} />

        <div className="reward__side">
          {academy ? (
            <AcademyNextCard attempt={attempt} />
          ) : model.unlock !== null ? (
            <UnlockCard unlock={model.unlock} attemptId={attempt.id} />
          ) : (
            <MasteryPanel reward={reward} />
          )}
          {academy ? null : (
            <WeakPanel reward={reward} onDrill={drillId === undefined ? undefined : drill} />
          )}
        </div>

        <div className="reward-actions">
          <div className="reward-actions__more">
            <Button variant="secondary" hint="Esc" aria-keyshortcuts="Escape" onClick={home}>
              {m.result_home()}
            </Button>
            <Button variant="secondary" hint="R" aria-keyshortcuts="R" onClick={again}>
              {m.result_again()}
            </Button>
          </div>
          {academy ? null : <NextActionCard model={model} onStart={next} />}
        </div>
      </div>

      <section className="reward__details" aria-labelledby="reward-details">
        <h2 id="reward-details" className="reward__details-title">
          {m.result_details()}
        </h2>
        {isReviewDrillId(attempt.scaleId) ? (
          <ReviewOutcome attempt={attempt} attempts={attempts} />
        ) : null}
        {model.unlock === null || academy ? null : (
          <UnlockWords
            layoutId={attempt.layoutId}
            unlockKey={model.unlock.key}
            unlocked={model.unlock.unlockedAfter}
          />
        )}
        <RhythmChart attempt={attempt} />
        <ErrorList attempt={attempt} />
        <Metrics attempt={attempt} />
        {model.logPruned ? (
          <p className="font-ui text-sm text-muted" data-testid="pruned-note">
            {m.result_pruned_note()}
          </p>
        ) : null}
      </section>
    </div>
  )
}

/* ---- The score: the one loud block ---------------------------------------------------------- */

function headline(model: ResultModel): { title: string; say: string } {
  const { reward, unlock, attempt } = model
  const floor = Math.round(reward.floor * 100)
  const nextKey =
    reward.nextKey === undefined
      ? ''
      : ` ${m.result_say_next_key({ key: displayChar(reward.nextKey) })}`
  if (unlock !== null) {
    return {
      title: m.result_h_unlocked({ key: displayChar(unlock.key) }),
      say: m.result_say_mastered({ target: reward.target, floor }) + nextKey,
    }
  }
  if (attempt.mode === 'practice') {
    // The note under the headline already says a practice attempt does not count; this line says
    // what to do about the accuracy the learner just typed, and asks for the test only when
    // «Далі» opens it (`practiceAdvice`).
    const advice = practiceAdvice(attempt, model.next, reward.floor)
    const say =
      advice === 'takeTest'
        ? m.result_say_practice_ready
        : advice === 'cleared'
          ? m.result_say_practice_cleared
          : m.result_say_practice_below
    return {
      title: m.result_h_practice(),
      say: say({ accuracy: number(attempt.metrics.accuracy * 100, 1), floor }),
    }
  }
  if (!reward.passed) {
    return {
      title: m.result_h_failed(),
      say: m.result_say_failed({ accuracy: number(attempt.metrics.accuracy * 100, 1), floor }),
    }
  }
  if (reward.streak >= reward.target) {
    return {
      title: m.result_h_mastered(),
      say: m.result_say_mastered({ target: reward.target, floor }) + nextKey,
    }
  }
  return {
    title: m.result_h_counted({ n: reward.streak, target: reward.target }),
    say: m.result_say_more({ floor, left: reward.target - reward.streak }) + nextKey,
  }
}

function useMotionOn(): boolean {
  const setting = useAppStore((state) => state.settings.motion)
  return resolveMotion(setting, prefersReducedMotion()) === 'full'
}

function ScorePanel({ model, label }: { readonly model: ResultModel; readonly label: string }) {
  const { attempt, reward } = model
  const { title, say } = headline(model)
  const academy = isAcademyExerciseId(attempt.scaleId)
  const chip = useRef<HTMLSpanElement>(null)
  const motion = useMotionOn()
  const settings = useAppStore((state) => state.settings)

  // A chime when the result opens, a rising one for a new key; silent unless the learner asked.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per attempt, not per setting change
  useEffect(() => {
    playCue(model.unlock === null ? 'result' : 'unlock', settings)
  }, [attempt.id])

  // The XP chip flies into the status bar's XP bar once, when the result opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per attempt
  useEffect(() => {
    const from = chip.current
    const to = document.querySelector('.frame__bar .xp')
    if (!motion || reward.xp === 0 || from === null || !(to instanceof HTMLElement)) return
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const flyer = from.cloneNode(true) as HTMLElement
    flyer.classList.add('reward-xp--flying')
    Object.assign(flyer.style, { left: `${a.left}px`, top: `${a.top}px` })
    document.body.appendChild(flyer)
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const run = flyer.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.2 },
      ],
      { duration: 800, delay: 700, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'both' },
    )
    run.onfinish = () => flyer.remove()
    return () => {
      run.cancel()
      flyer.remove()
    }
  }, [attempt.id])

  return (
    <section
      className="reward-score on-red"
      aria-labelledby="reward-score-title"
      data-testid="result-score"
      data-guide="result-score"
    >
      <LiveGradient tone="ember" />
      <div className="reward-score__top">
        {attempt.mode === 'test'
          ? m.result_reward_top_test({ scale: label })
          : m.result_reward_top_practice({ scale: label })}
      </div>
      {reward.xp > 0 ? (
        <span ref={chip} className="reward-xp">
          {m.result_xp({ xp: reward.xp })}
        </span>
      ) : null}
      <div className="reward-score__body">
        <h1 className="reward-score__h" id="reward-score-title">
          {academy ? m.result_title() : title}
        </h1>
        {academy ? null : <p className="reward-score__say">{say}</p>}
        <p className="reward-score__note">
          {attempt.mode === 'test' ? m.result_note_test() : m.result_note_practice()}
        </p>
      </div>
      <Comparison attempt={attempt} previous={model.previousBest} />
      <Tiles attempt={attempt} motion={motion} />
    </section>
  )
}

/** Counts a number up from zero once, unless motion is off; the final text is always exact. */
function CountUp({
  value,
  format,
  motion,
}: {
  readonly value: number
  readonly format: (value: number) => string
  readonly motion: boolean
}) {
  const [shown, setShown] = useState(motion ? 0 : value)
  useEffect(() => {
    if (!motion) {
      setShown(value)
      return
    }
    let start: number | null = null
    let frame = 0
    const step = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / 900)
      setShown(t === 1 ? value : value * (1 - (1 - t) ** 4))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, motion])
  return <>{format(shown)}</>
}

function Tiles({
  attempt,
  motion,
}: {
  readonly attempt: AttemptSummary
  readonly motion: boolean
}) {
  const { metrics } = attempt
  const cells = [
    {
      key: 'spm',
      label: m.result_tile_spm(),
      hint: m.result_tile_spm_hint(),
      value: <CountUp value={metrics.spm} format={(v) => number(v)} motion={motion} />,
    },
    {
      key: 'accuracy',
      label: m.result_tile_accuracy(),
      hint: m.result_tile_accuracy_hint(),
      value: (
        <CountUp
          value={metrics.accuracy * 100}
          format={(v) => `${number(v, 1)} %`}
          motion={motion}
        />
      ),
    },
    {
      key: 'errors',
      label: m.result_tile_errors(),
      hint: m.result_tile_errors_hint(),
      value: number(metrics.errorCount),
    },
    {
      key: 'time',
      label: m.result_tile_time(),
      hint: m.result_tile_time_hint(),
      value: duration(attempt.elapsedMs),
    },
  ]
  return (
    <section aria-label={m.result_tiles_label()} className="reward-cells" data-guide="result-tiles">
      <dl>
        {cells.map((cell, i) => (
          <div key={cell.key} className={`reward-cell${i === 0 ? ' reward-cell--main' : ''}`}>
            <dt>{cell.label}</dt>
            <dd className="reward-cell__value num">{cell.value}</dd>
            <dd className="reward-cell__hint">{cell.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ---- Mastery ------------------------------------------------------------------------------ */

function MasteryPanel({ reward }: { readonly reward: Reward }) {
  const floor = Math.round(reward.floor * 100)
  const slots = Array.from({ length: reward.target }, (_, i) => reward.slots[i])
  const segments = Array.from({ length: reward.keysTotal }, (_, i) =>
    i < reward.keysOpen ? 'on' : i === reward.keysOpen ? 'cur' : '',
  )
  return (
    <section className="reward-panel reward-mastery" aria-labelledby="reward-mastery-title">
      <h2 className="reward-panel__title" id="reward-mastery-title">
        {m.result_mastery_title()}
      </h2>
      <p className="reward-mastery__ex">{m.result_mastery_ex({ target: reward.target, floor })}</p>
      <ol className="reward-slots">
        {slots.map((slot, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions, not items
            key={i}
            className={`reward-slot${slot === undefined ? ' is-empty' : ' is-ok'}${slot?.current ? ' is-new' : ''}`}
          >
            <span className="reward-slot__lab">
              {slot?.current ? m.result_slot_now({ n: i + 1 }) : m.result_slot({ n: i + 1 })}
            </span>
            <span className="reward-slot__n num">
              {slot === undefined ? m.result_slot_empty() : `${number(slot.accuracy * 100)}%`}
            </span>
          </li>
        ))}
      </ol>
      {reward.nextKey === undefined ? null : (
        <p className="reward-mastery__next">
          {m.result_say_next_key({ key: displayChar(reward.nextKey) })}
        </p>
      )}
      <div className="reward-stagebar">
        <div className="reward-stagebar__h">
          <span>{m.result_mastery_keys()}</span>
          <b>{m.result_mastery_keys_value({ open: reward.keysOpen, total: reward.keysTotal })}</b>
        </div>
        <div className="reward-segs" aria-hidden="true">
          {segments.map((state, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one segment per key position
            <i key={i} className={state} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---- The slowest move --------------------------------------------------------------------- */

function WeakPanel({
  reward,
  onDrill,
}: {
  readonly reward: Reward
  readonly onDrill: (() => void) | undefined
}) {
  const weakest = reward.weakest
  const max = Math.max(SLOW_IKI_MS * 1.5, weakest?.meanIkiMs ?? 0)
  const label = weakest === null ? '' : transitionLabel(weakest.element)
  return (
    <section className="reward-panel reward-weak" aria-labelledby="reward-weak-title">
      <h2 className="reward-panel__title" id="reward-weak-title">
        {m.result_weak_title()}
      </h2>
      {weakest === null ? (
        <p className="reward-say">{m.result_weak_none()}</p>
      ) : (
        <>
          <p className="reward-say">
            {m.result_weak_say({ label, ms: Math.round(weakest.meanIkiMs), target: SLOW_IKI_MS })}
          </p>
          <div className="reward-gauge" aria-hidden="true">
            <span
              className="reward-gauge__fill"
              style={{ width: `${Math.min(100, (weakest.meanIkiMs / max) * 100)}%` }}
            />
            <span
              className="reward-gauge__goal"
              style={{ left: `${(SLOW_IKI_MS / max) * 100}%` }}
            />
          </div>
          <div className="reward-gauge__lab" aria-hidden="true">
            <span>0</span>
            <span>{m.result_weak_goal({ target: SLOW_IKI_MS })}</span>
            <span>{m.result_weak_max({ max: Math.round(max) })}</span>
          </div>
          {onDrill === undefined ? null : (
            <Button variant="secondary" size="sm" hint="D" aria-keyshortcuts="D" onClick={onDrill}>
              {m.result_weak_drill({ label })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
