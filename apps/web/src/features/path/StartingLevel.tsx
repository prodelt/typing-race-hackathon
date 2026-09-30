import { boundaryFor } from '@typing-race/curriculum'
import type { StartingLevelChoice } from '@typing-race/domain'
import { Button, Index } from '@typing-race/ui'
import { useId, useState } from 'react'
import { useAppStore, useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { Arrow, Check, order, ScreenHead } from '../screen.js'
import './path.css'

/**
 * The starting-level question, and the forward-only rule.
 *
 * Forward-only takes two guards. The fold takes the greater of the answer's boundary and what the
 * learner has earned, so no answer touches the attempt list or closes an earned key. It does not
 * remember a *higher earlier answer*, though, so this component also refuses to offer an option
 * whose boundary is below the recorded one. The count on each option is read from the same
 * `boundaryFor` the fold uses, so what a cell promises is what the fold will deliver.
 *
 * The three answers are the product page's three stage cells: the count of keys each opens is the
 * cell's big number, and the chosen one turns into the brand's red block. The radios stay real
 * radios (arrow keys, a visible focus ring); the cell is their label.
 */

interface Option {
  readonly choice: StartingLevelChoice
  readonly title: () => string
  readonly body: () => string
}

/** Offered from least to most experienced. */
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
  // An answer that opens fewer keys than the recorded one is not offered. Recording it would make
  // the fold's boundary drop, and the fold only guarantees earned keys, not the boundary of a
  // higher earlier answer, so the guard has to sit here.
  const currentBoundary = current === null ? 0 : boundaryFor(layout, current)
  const titleId = `${groupId}-title`

  const options = (
    <fieldset className="start__options">
      <legend className="sr-only">{m.path_start_group()}</legend>
      {OPTIONS.map((option, index) => {
        const id = `${groupId}-${option.choice}`
        const lower = boundaryFor(layout, option.choice) < currentBoundary
        const count = layout.homeAnchors.length + boundaryFor(layout, option.choice)
        return (
          <label
            key={option.choice}
            htmlFor={id}
            className="start__option rise"
            style={order(index + 1)}
            data-lower={lower || undefined}
          >
            <input
              id={id}
              type="radio"
              name={groupId}
              value={option.choice}
              checked={selected === option.choice}
              disabled={lower}
              onChange={() => {
                if (!lower) setSelected(option.choice)
              }}
            />
            <span className="start__top">
              <span aria-hidden="true">[{String(index + 1).padStart(2, '0')}]</span>
              <span className="start__mark" aria-hidden="true">
                <Check />
                {m.path_start_chosen()}
              </span>
            </span>
            <span className="num start__count" aria-hidden="true">
              {count}
            </span>
            <span className="start__count-label">{m.path_start_opens({ count })}</span>
            <span className="start__title">{option.title()}</span>
            <span className="start__body">{option.body()}</span>
            {lower && <span className="start__note">{m.path_start_lower_disabled()}</span>}
            {!lower && !first && current === option.choice && (
              <span className="start__note">{m.path_start_current()}</span>
            )}
          </label>
        )
      })}
    </fieldset>
  )

  const action = (
    <div className="start__actions">
      {first ? (
        // The first answer is the screen's one action: the poster button.
        <button
          type="button"
          className="poster"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) chooseStartingLevel(selected)
          }}
        >
          <span>{m.path_start_confirm()}</span>
          <Arrow size={40} />
        </button>
      ) : (
        // On Path it is a setting at the foot of the page, so it is an ordinary pill.
        <Button
          size="lg"
          disabled={selected === null || selected === current}
          onClick={() => {
            if (selected !== null) chooseStartingLevel(selected)
          }}
        >
          {m.path_start_change_confirm()}
        </Button>
      )}
    </div>
  )

  if (first) {
    return (
      <section className="screen" aria-labelledby={titleId}>
        <ScreenHead
          n={1}
          label={m.path_start_group()}
          title={m.path_start_title()}
          titleId={titleId}
          lede={m.path_start_lead()}
        />
        <div className="start">
          {options}
          {action}
        </div>
      </section>
    )
  }

  return (
    <section
      id="starting-level"
      data-section={m.path_start_change_title()}
      className="path-sec start--change"
      aria-labelledby={titleId}
    >
      <Index n={6}>{m.path_start_group()}</Index>
      <h2 id={titleId} className="path-sec__title">
        {m.path_start_change_title()}
      </h2>
      <p className="path-sec__lede">{m.path_start_change_note()}</p>
      <div className="start">
        {options}
        {action}
      </div>
    </section>
  )
}
