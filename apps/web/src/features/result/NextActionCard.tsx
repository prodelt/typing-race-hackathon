import { useNavigate } from '@tanstack/react-router'
import { m } from '../../paraglide/messages.js'
import { Arrow } from '../screen.js'
import { coachSentence, type ResultModel } from './model.js'

/**
 * The one Next Action, with the one button that starts it: the screen's dominant call, set as the
 * brand's poster button.
 *
 * "Exactly one" is a property of the data, not of this component: `nextAction` returns a single
 * `NextAction`, never a list, so there is nothing here to filter down and no second slot to fill.
 * It always starts in Practice mode: the Test Attempt becomes the primary action on the exercise
 * screen once practice clears the floor.
 */
export function NextActionCard({ model }: { readonly model: ResultModel }) {
  const navigate = useNavigate()
  const { next } = model

  return (
    <section aria-labelledby="result-next" className="next">
      <div className="next__text">
        <h2 id="result-next" className="flabel">
          {m.result_next_heading()}
        </h2>
        <p className="statement next__sentence" data-rule={next.rule}>
          {coachSentence(model)}
        </p>
      </div>
      <button
        type="button"
        className="poster next__cta"
        onClick={() => {
          void navigate({
            to: '/exercise/$scaleId',
            params: { scaleId: next.startsScaleId },
            search: { mode: 'practice' },
          })
        }}
      >
        <span>{m.result_next_start()}</span>
        <Arrow size={44} />
      </button>
    </section>
  )
}
