import { Button, Card } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'

/**
 * T139. The fourth block, named for what it is (FR-076). F1 has no dictionary, so nothing here
 * generates anything word-shaped: the screen says real text arrives with the word curriculum and
 * offers a mechanics exercise that is labelled as one. The only text on it is interface prose.
 */
export function RealTextPending(props: {
  readonly onMechanics: () => void
  readonly onFinish: () => void
}) {
  return (
    <Card raised className="flex flex-col gap-4 p-6" data-testid="real-text-pending">
      <h2 className="font-ui text-xl font-bold text-ink">{m.session_realtext_title()}</h2>
      <p className="font-ui text-ink">{m.session_realtext_body()}</p>
      <div className="flex flex-col gap-2">
        <div>
          <Button variant="secondary" onClick={props.onMechanics}>
            {m.session_realtext_mechanics()}
          </Button>
        </div>
        <p className="font-ui text-sm text-ink/80">{m.session_realtext_mechanics_note()}</p>
      </div>
      <div>
        <Button variant="primary" size="lg" onClick={props.onFinish}>
          {m.session_realtext_finish()}
        </Button>
      </div>
    </Card>
  )
}
