import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Chip } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { BetweenBlocks } from './BetweenBlocks.js'
import { type Block, composeSession, type SessionPlan } from './compose.js'
import { completedBlocks, positionOf, sessionAttempts } from './machine.js'
import { RealTextBlock } from './RealTextBlock.js'
import { useSessionStore } from './store.js'
import { useRealText } from './useRealText.js'

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

/**
 * T135 to T140 composed. The session runs the exercise screen for each block without importing
 * it: the plan lives in `store.ts`, and this screen links out with `navigate` to
 * `/exercise/$scaleId`, carrying only the scale and the typed `mode` search the route already has.
 * Coming back, it counts attempts from the history to know where the learner is (FR-078).
 */
export function SessionScreen() {
  const navigate = useNavigate()
  const attempts = useAppStore((state) => state.attempts)
  const abandonAttempt = useAppStore((state) => state.abandonAttempt)
  const { layout, progress, nextAction, catalogue } = useDerived()
  const session = useSessionStore((store) => store.session)
  const dispatch = useSessionStore((store) => store.dispatch)

  const plan = useMemo(
    () =>
      progress === null || nextAction === null
        ? null
        : composeSession({ layout, catalogue, progress, nextAction, attempts }),
    [layout, catalogue, progress, nextAction, attempts],
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

  // Loaded ahead of the fourth block, so the text is ready when the learner gets there.
  const realText = useRealText(layout, progress, attempts)

  const header = <h1 className="font-ui text-2xl font-bold text-ink">{m.session_title()}</h1>

  if (session.status === 'finished') {
    return (
      <section className="flex max-w-3xl flex-col gap-6">
        {header}
        <Card raised className="flex flex-col gap-4 p-6">
          <h2 className="font-ui text-xl font-bold text-ink">{m.session_finished_title()}</h2>
          <p className="font-ui text-ink">{m.session_finished_body({ count: session.recorded })}</p>
          <div>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'reset' })
                void navigate({ to: '/' })
              }}
            >
              {m.session_finished_today()}
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  if (session.status === 'running') {
    const position = positionOf(session, attempts)
    const recorded = sessionAttempts(session, attempts).length
    const current = position.kind === 'block' ? session.plan.blocks[position.blockIndex] : undefined

    return (
      <section className="flex max-w-3xl flex-col gap-6">
        {header}
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
        {(position.kind === 'realText' || position.kind === 'realTextDone') && (
          <RealTextBlock
            state={realText}
            done={position.kind === 'realTextDone'}
            onStart={() => launch(session.plan.realTextId, 'practice')}
            onFinish={() => dispatch({ type: 'finish', recorded })}
          />
        )}
        {position.kind === 'block' && current !== undefined && (
          <Card raised className="flex flex-col gap-4 p-6">
            <p className="font-ui text-sm font-semibold text-ink/80">
              {m.session_progress_block({
                n: position.blockIndex + 1,
                block: blockName(position.blockIndex),
              })}
            </p>
            <p className="font-ui text-ink">{blockBody(current)}</p>
            <p className="font-mono text-sm text-ink">
              {m.session_progress_attempt({ done: position.doneInBlock, total: position.reps })}
            </p>
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => launchBlock(position.blockIndex, session.plan)}
              >
                {m.session_next_attempt({ n: position.doneInBlock + 1, total: position.reps })}
              </Button>
            </div>
          </Card>
        )}
        <div className="flex flex-col gap-2">
          <div>
            <Button variant="quiet" onClick={abandon}>
              {m.session_abandon()}
            </Button>
          </div>
          <p className="font-ui text-sm text-ink/80">{m.session_abandon_note()}</p>
        </div>
      </section>
    )
  }

  // Idle: the intro. The expected length is stated here, before anything starts (FR-077).
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      {header}
      <p className="font-ui text-ink/80">{m.session_lead()}</p>
      {plan === null ? (
        <p role="status" className="font-ui text-ink">
          {m.session_needs_level()}
        </p>
      ) : (
        <>
          <Card raised className="flex flex-col gap-2 p-6">
            <p className="font-ui text-xl font-bold text-ink" data-testid="expected-length">
              {m.session_expected_length({ minutes: plan.expectedMinutes })}
            </p>
            <p className="font-ui text-sm text-ink/80">{m.session_expected_note()}</p>
          </Card>
          <section aria-labelledby="session-blocks" className="flex flex-col gap-3">
            <h2 id="session-blocks" className="font-ui text-lg font-bold text-ink">
              {m.session_blocks_heading()}
            </h2>
            <ol className="flex flex-col gap-3">
              {plan.blocks.map((block, index) => (
                <li key={block.kind}>
                  <Card className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-ui font-semibold text-ink">{blockName(index)}</span>
                      <Chip>{m.session_block_attempts({ count: block.reps })}</Chip>
                      <Chip tone="muted">
                        {m.session_block_focus({ focus: block.focus.value })}
                      </Chip>
                    </div>
                    <p className="font-ui text-sm text-ink/80">{blockBody(block)}</p>
                  </Card>
                </li>
              ))}
              <li>
                <Card className="flex flex-col gap-2 p-4">
                  <span className="font-ui font-semibold text-ink">{blockName(3)}</span>
                  <p className="font-ui text-sm text-ink/80">{m.session_block_realText_body()}</p>
                </Card>
              </li>
            </ol>
          </section>
          <div>
            <Button variant="primary" size="lg" onClick={() => start(plan)}>
              {m.session_start()}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
