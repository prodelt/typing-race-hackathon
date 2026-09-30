import { useNavigate } from '@tanstack/react-router'
import { Button, Card } from '@typing-race/ui'
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
export function NextActionCard({ model }: { readonly model: ResultModel }) {
  const navigate = useNavigate()
  const { next } = model

  return (
    <Card aria-labelledby="result-next" role="region" raised className="p-5">
      <h2 id="result-next" className="font-ui text-lg font-bold">
        {m.result_next_heading()}
      </h2>
      <p className="mt-3 font-ui text-lg leading-relaxed" data-rule={next.rule}>
        {coachSentence(model)}
      </p>
      <Button
        variant="primary"
        size="lg"
        className="mt-4"
        onClick={() => {
          void navigate({
            to: '/exercise/$scaleId',
            params: { scaleId: next.startsScaleId },
            search: { mode: 'practice' },
          })
        }}
      >
        {m.result_next_start()}
      </Button>
    </Card>
  )
}
