import { Button } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { Arrow } from '../screen.js'

/**
 * The fourth block, named for what it is. Until the word curriculum lands nothing here generates
 * anything word-shaped: the screen says real text arrives with it and offers a mechanics exercise
 * that is labelled as one. The only text on it is interface prose.
 */
export function RealTextPending(props: {
  readonly onMechanics: () => void
  readonly onFinish: () => void
}) {
  return (
    <div
      className="between panel gp-host gp-host--bright panel--corner rise"
      data-testid="real-text-pending"
    >
      <GradLayer tone="bright" seed={6} count={4} />
      <h2 className="between__title">{m.session_realtext_title()}</h2>
      <p className="screen-lede">{m.session_realtext_body()}</p>
      <div className="between__aside">
        <Button variant="secondary" onClick={props.onMechanics}>
          {m.session_realtext_mechanics()}
        </Button>
        <p className="note">{m.session_realtext_mechanics_note()}</p>
      </div>
      <button type="button" className="poster session__poster" onClick={props.onFinish}>
        <span>{m.session_realtext_finish()}</span>
        <Arrow size={40} />
      </button>
    </div>
  )
}
