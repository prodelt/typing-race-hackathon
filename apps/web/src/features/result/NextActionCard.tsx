import { Button } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { coachSentence, type ResultModel } from './model.js'

/**
 * T103. The one Next Action, with the one button that starts it (FR-031).
 *
 * "Exactly one" is a property of the data, not of this component: `nextAction` returns a single
 * `NextAction`, never a list, so there is nothing here to filter down and no second slot to fill.
 * The component renders that value and nothing else, and deliberately has no "other suggestions"
 * affordance. It always starts in Practice mode: the Test Attempt becomes the primary action on the
 * exercise screen once practice clears the floor (FR-039).
 */
export function NextActionCard({
  model,
  onStart,
}: {
  readonly model: ResultModel
  readonly onStart: () => void
}) {
  const { next } = model

  return (
    <section aria-labelledby="result-next" className="reward-next">
      <h2 id="result-next" className="reward-next__title">
        {m.result_next_heading()}
      </h2>
      <p className="reward-next__say" data-rule={next.rule}>
        {coachSentence(model)}
      </p>
      <Button variant="primary" size="lg" hint="Enter" aria-keyshortcuts="Enter" onClick={onStart}>
        {m.result_next_go()}
      </Button>
    </section>
  )
}
