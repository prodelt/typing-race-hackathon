import { useNavigate } from '@tanstack/react-router'
import { Button, cx } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { Arrow, order, ScreenHead } from '../screen.js'
import { BetweenBlocks } from './BetweenBlocks.js'
import { type Block, composeSession, type SessionPlan } from './compose.js'
import { completedBlocks, positionOf, sessionAttempts } from './machine.js'
import { RealTextPending } from './RealTextPending.js'
import { useSessionStore } from './store.js'
import './session.css'

const BLOCK_NAMES: readonly (() => string)[] = [
  () => m.session_block_warmUp(),
  () => m.session_block_target(),
  () => m.session_block_consolidation(),
  () => m.session_block_realText(),
]

function blockName(index: number): string {
  return BLOCK_NAMES[index]?.() ?? ''
}

function blockBody(block: Block): string {
  if (block.kind === 'warmUp') {
    return block.fallback ? m.session_block_warmUp_fallback() : m.session_block_warmUp_body()
  }
  return block.kind === 'target'
    ? m.session_block_target_body()
    : m.session_block_consolidation_body()
}

/** The four blocks as four discs, the current one filled: where the learner is, at a glance. */
function Track({ current }: { readonly current: number }) {
  return (
    <ol className="track" aria-hidden="true">
      {BLOCK_NAMES.map((name, index) => (
        <li
          key={name()}
          className={cx('track__step', index < current && 'is-done', index === current && 'is-now')}
        >
          <span className="disc disc--sm">{String(index + 1).padStart(2, '0')}</span>
          <span className="track__name">{name()}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The guided session. It runs the exercise screen for each block without importing it: the plan
 * lives in `store.ts`, and this screen links out with `navigate` to `/exercise/$scaleId`,
 * carrying only the scale and the typed `mode` search the route already has. Coming back, it
 * counts attempts from the history to know where the learner is.
 *
 * The intro is laid out like the brand site's "how it works" section: the expected length as the
 * one big number, then the four blocks as numbered points in discs, then the poster button.
 */
export function SessionScreen() {
  const navigate = useNavigate()
  const attempts = useAppStore((state) => state.attempts)
  const abandonAttempt = useAppStore((state) => state.abandonAttempt)
  const { progress, nextAction, catalogue } = useDerived()
  const session = useSessionStore((store) => store.session)
  const dispatch = useSessionStore((store) => store.dispatch)

  const plan = useMemo(
    () =>
      progress === null || nextAction === null
        ? null
        : composeSession({ catalogue, progress, nextAction, attempts }),
    [catalogue, progress, nextAction, attempts],
  )

  function launch(scaleId: string, mode: Block['mode']): void {
    void navigate({ to: '/exercise/$scaleId', params: { scaleId }, search: { mode } })
  }

  function launchBlock(index: number, source: SessionPlan): void {
    const block = source.blocks[index]
    if (block !== undefined) launch(block.scaleId, block.mode)
  }

  function start(source: SessionPlan): void {
    dispatch({ type: 'start', plan: source, baseline: attempts.map((attempt) => attempt.id) })
    launchBlock(0, source)
  }

  function abandon(): void {
    // Forgets the plan only. An attempt in progress produces nothing; finished ones stay recorded.
    abandonAttempt()
    dispatch({ type: 'abandon' })
  }

  if (session.status === 'finished') {
    return (
      <section className="screen">
        <ScreenHead n={3} label={m.session_title()} title={m.session_title()} small />
        <div className="session-done panel gp-host gp-host--bright panel--corner rise">
          <GradLayer tone="bright" seed={8} count={4} />
          <h2 className="session-done__title">
            {m.session_finished_title()}
            <span className="red-dot" aria-hidden="true" />
          </h2>
          <p className="screen-lede">{m.session_finished_body({ count: session.recorded })}</p>
          <button
            type="button"
            className="poster session__poster"
            onClick={() => {
              dispatch({ type: 'reset' })
              void navigate({ to: '/today' })
            }}
          >
            <span>{m.session_finished_today()}</span>
            <Arrow size={40} />
          </button>
        </div>
      </section>
    )
  }

  if (session.status === 'running') {
    const position = positionOf(session, attempts)
    const recorded = sessionAttempts(session, attempts).length
    const current = position.kind === 'block' ? session.plan.blocks[position.blockIndex] : undefined
    const trackAt =
      position.kind === 'block'
        ? position.blockIndex
        : position.kind === 'between'
          ? position.nextIndex
          : 3

    return (
      <section className="screen">
        <ScreenHead n={3} label={m.session_title()} title={m.session_title()} small />
        <Track current={trackAt} />

        {position.kind === 'between' && (
          <BetweenBlocks
            finished={blockName(position.finishedIndex)}
            next={blockName(position.nextIndex)}
            onContinue={() => {
              dispatch({ type: 'acknowledge', completedBlocks: completedBlocks(session, attempts) })
              launchBlock(position.nextIndex, session.plan)
            }}
          />
        )}
        {position.kind === 'realText' && (
          <RealTextPending
            onMechanics={() => {
              const target = session.plan.blocks[1]
              if (target !== undefined) launch(target.scaleId, 'practice')
            }}
            onFinish={() => dispatch({ type: 'finish', recorded })}
          />
        )}
        {position.kind === 'block' && current !== undefined && (
          <div className="session-block rise">
            <div>
              <p className="flabel">
                {m.session_progress_block({
                  n: position.blockIndex + 1,
                  block: blockName(position.blockIndex),
                })}
              </p>
              <p className="statement session-block__body">{blockBody(current)}</p>
              <p className="session-block__count">
                {m.session_progress_attempt({ done: position.doneInBlock, total: position.reps })}
              </p>
            </div>
            <button
              type="button"
              className="poster session__poster"
              onClick={() => launchBlock(position.blockIndex, session.plan)}
            >
              <span>
                {m.session_next_attempt({ n: position.doneInBlock + 1, total: position.reps })}
              </span>
              <Arrow size={40} />
            </button>
          </div>
        )}

        <div className="session-leave">
          <Button variant="quiet" onClick={abandon}>
            {m.session_abandon()}
          </Button>
          <p className="note">{m.session_abandon_note()}</p>
        </div>
      </section>
    )
  }

  // Idle: the intro. The expected length is stated here, before anything starts.
  return (
    <section className="screen">
      <ScreenHead
        n={3}
        label={m.session_blocks_heading()}
        title={m.session_title()}
        lede={m.session_lead()}
        dot
      />
      {plan === null ? (
        <p role="status" className="statement session-needs">
          {m.session_needs_level()}
        </p>
      ) : (
        <div className="session-intro">
          <div className="session-intro__length rise" style={order(1)}>
            <p className="num num--red session-intro__minutes" aria-hidden="true">
              {plan.expectedMinutes}
            </p>
            <p className="session-intro__stated" data-testid="expected-length">
              {m.session_expected_length({ minutes: plan.expectedMinutes })}
            </p>
            <p className="note">{m.session_expected_note()}</p>
            <button type="button" className="poster session__poster" onClick={() => start(plan)}>
              <span>{m.session_start()}</span>
              <Arrow size={40} />
            </button>
          </div>

          <section aria-labelledby="session-blocks" className="session-intro__blocks">
            <h2 id="session-blocks" className="sr-only">
              {m.session_blocks_heading()}
            </h2>
            <ol className="blocks">
              {plan.blocks.map((block, index) => (
                <li key={block.kind} className="blocks__item rise" style={order(index + 2)}>
                  <span className="disc" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="blocks__name">{blockName(index)}</h3>
                    <p className="blocks__meta">
                      <span>{m.session_block_attempts({ count: block.reps })}</span>
                      <span>{m.session_block_focus({ focus: block.focus.value })}</span>
                    </p>
                    <p className="blocks__body">{blockBody(block)}</p>
                  </div>
                </li>
              ))}
              <li className="blocks__item blocks__item--later rise" style={order(6)}>
                <span className="disc disc--empty" aria-hidden="true">
                  04
                </span>
                <div>
                  <h3 className="blocks__name">{blockName(3)}</h3>
                  <p className="blocks__body">{m.session_block_realText_body()}</p>
                </div>
              </li>
            </ol>
          </section>
        </div>
      )}
    </section>
  )
}
