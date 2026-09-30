import { useNavigate, useParams } from '@tanstack/react-router'
import type { AttemptSummary } from '@typing-race/domain'
import { Button, Card, Chip } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
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
 * T098, T105. The result screen, E4. The route gives it `{ attemptId }`; everything else comes
 * from the stored attempt list, so a reload or a link to an old result renders the same page.
 */

function Tile({
  index,
  label,
  hint,
  value,
}: {
  readonly index: number
  readonly label: string
  readonly hint: string
  readonly value: string
}) {
  return (
    <Card className="result-tile p-4" style={{ ['--i' as string]: index }}>
      <dt className="font-ui text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-3xl font-bold text-ink">{value}</dd>
      <dd className="mt-1 font-ui text-xs text-muted">{hint}</dd>
    </Card>
  )
}

function Tiles({ attempt }: { readonly attempt: AttemptSummary }) {
  const { metrics } = attempt
  return (
    <section aria-label={m.result_tiles_label()}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          index={0}
          label={m.result_tile_spm()}
          hint={m.result_tile_spm_hint()}
          value={number(metrics.spm)}
        />
        <Tile
          index={1}
          label={m.result_tile_accuracy()}
          hint={m.result_tile_accuracy_hint()}
          value={`${number(metrics.accuracy * 100, 1)} %`}
        />
        <Tile
          index={2}
          label={m.result_tile_errors()}
          hint={m.result_tile_errors_hint()}
          value={number(metrics.errorCount)}
        />
        <Tile
          index={3}
          label={m.result_tile_time()}
          hint={m.result_tile_time_hint()}
          value={duration(attempt.elapsedMs)}
        />
      </dl>
    </section>
  )
}

export function ResultScreen() {
  const { attemptId } = useParams({ strict: false })
  const navigate = useNavigate()
  const attempts = useAppStore((state) => state.attempts)
  const startingLevelChoice = useAppStore((state) => state.startingLevelChoice)

  const model = useMemo(
    () => buildResultModel({ attempts, attemptId, startingLevelChoice }),
    [attempts, attemptId, startingLevelChoice],
  )

  if (model === null) {
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="font-ui text-2xl font-bold">{m.result_not_found_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.result_not_found_body()}</p>
        <Button
          variant="primary"
          className="mt-5"
          onClick={() => {
            void navigate({ to: '/today' })
          }}
        >
          {m.result_go_today()}
        </Button>
      </section>
    )
  }

  const { attempt } = model
  return (
    <section className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-ui text-2xl font-bold">{m.result_title()}</h1>
        <Chip tone={attempt.mode === 'test' ? 'sage' : 'neutral'}>
          {attempt.mode === 'test' ? m.result_mode_test() : m.result_mode_practice()}
        </Chip>
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Tiles attempt={attempt} />
          <Comparison attempt={attempt} previous={model.previousBest} />
          <RhythmChart attempt={attempt} />
          <ErrorList attempt={attempt} />
          <Metrics attempt={attempt} />
          {model.logPruned ? (
            <p className="font-ui text-sm text-muted" data-testid="pruned-note">
              {m.result_pruned_note()}
            </p>
          ) : null}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {model.unlock === null ? null : (
            <UnlockCard unlock={model.unlock} attemptId={attempt.id} />
          )}
          <NextActionCard model={model} />
        </aside>
      </div>
    </section>
  )
}
