import { boundaryFor } from '@typing-race/curriculum'
import type { StartingLevelChoice } from '@typing-race/domain'
import { Button, Card, cx } from '@typing-race/ui'
import { useId, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'

/**
 * T113. The starting-level question — FR-048, and the forward-only rule — FR-073.
 *
 * Forward-only takes two guards. The fold takes the greater of the answer's boundary and what the
 * learner has earned, so no answer touches the attempt list or closes an earned key. It does not
 * remember a *higher earlier answer*, though, so this component also refuses to offer an option
 * whose boundary is below the recorded one. The count on each option is read from the same
 * `boundaryFor` the fold uses, so what a card promises is what the fold will deliver.
 */

interface Option {
  readonly choice: StartingLevelChoice
  readonly title: () => string
  readonly body: () => string
}

/** FR-048's order: the learner is offered them from least to most experienced. */
const OPTIONS: readonly Option[] = [
  {
    choice: 'neverTouchTyped',
    title: () => m.path_start_never_title(),
    body: () => m.path_start_never_body(),
  },
  {
    choice: 'knowsHomeRow',
    title: () => m.path_start_home_title(),
    body: () => m.path_start_home_body(),
  },
  {
    choice: 'touchTypesWantsAccuracy',
    title: () => m.path_start_accuracy_title(),
    body: () => m.path_start_accuracy_body(),
  },
]

export interface StartingLevelProps {
  /** `first` replaces the hub on a first run; `change` sits on Path for a returning learner. */
  readonly mode: 'first' | 'change'
}

export function StartingLevel({ mode }: StartingLevelProps) {
  const groupId = useId()
  const current = useAppStore((state) => state.startingLevelChoice)
  const chooseStartingLevel = useAppStore((state) => state.chooseStartingLevel)
  const { layout } = useDerived()
  const [selected, setSelected] = useState<StartingLevelChoice | null>(current)

  const first = mode === 'first'
  // FR-073: an answer that opens fewer keys than the recorded one is not offered. Recording it
  // would make the fold's boundary drop, and the fold only guarantees earned keys, not the
  // boundary of a higher earlier answer — so the guard has to sit here.
  const currentBoundary = current === null ? 0 : boundaryFor(layout, current)

  return (
    <Card className="p-6" role="region" aria-labelledby={`${groupId}-title`}>
      {first ? (
        <h1 id={`${groupId}-title`} className="font-ui text-2xl font-bold">
          {m.path_start_title()}
        </h1>
      ) : (
        <h2 id={`${groupId}-title`} className="font-ui text-xl font-bold">
          {m.path_start_change_title()}
        </h2>
      )}
      <p className="mt-2 font-ui text-muted">
        {first ? m.path_start_lead() : m.path_start_change_note()}
      </p>

      <fieldset className="mt-5 grid gap-3">
        <legend className="sr-only">{m.path_start_group()}</legend>
        {OPTIONS.map((option) => {
          const id = `${groupId}-${option.choice}`
          const active = selected === option.choice
          const lower = boundaryFor(layout, option.choice) < currentBoundary
          return (
            <label
              key={option.choice}
              htmlFor={id}
              className={cx(
                'flex items-start gap-3 p-4',
                lower ? 'opacity-60' : 'cursor-pointer',
                'rounded-[var(--radius-field)] border-[length:var(--border-hairline)]',
                active ? 'border-sage bg-sage-tint' : 'border-hairline-strong bg-paper',
              )}
            >
              <input
                id={id}
                type="radio"
                name={groupId}
                value={option.choice}
                checked={active}
                disabled={lower}
                onChange={() => {
                  if (!lower) setSelected(option.choice)
                }}
                className="mt-1 accent-[var(--color-sage)]"
              />
              <span className="grid gap-1">
                <span className="font-ui font-semibold">{option.title()}</span>
                <span className="font-ui text-sm text-muted">{option.body()}</span>
                <span className="font-mono text-xs text-muted">
                  {m.path_start_opens({
                    count: layout.homeAnchors.length + boundaryFor(layout, option.choice),
                  })}
                  {lower && ` · ${m.path_start_lower_disabled()}`}
                  {current === option.choice && ` · ${m.path_start_current()}`}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <div className="mt-5">
        <Button
          variant="primary"
          size="lg"
          disabled={selected === null || (!first && selected === current)}
          onClick={() => {
            if (selected !== null) chooseStartingLevel(selected)
          }}
        >
          {first ? m.path_start_confirm() : m.path_start_change_confirm()}
        </Button>
      </div>
    </Card>
  )
}
