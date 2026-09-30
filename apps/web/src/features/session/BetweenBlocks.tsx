import { Button, Card } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'

/**
 * T138. Screen E6: what was just done and what comes next, then one button. It names both blocks
 * in words, so the learner is never asked to infer the sequence from a progress bar.
 */
export function BetweenBlocks(props: {
  readonly finished: string
  readonly next: string
  readonly onContinue: () => void
}) {
  return (
    <Card raised className="flex flex-col gap-4 p-6" data-testid="between-blocks">
      <h2 className="font-ui text-xl font-bold text-ink">{m.session_between_title()}</h2>
      <p className="font-ui text-ink">{m.session_between_done({ block: props.finished })}</p>
      <p className="font-ui font-semibold text-ink">
        {m.session_between_next({ block: props.next })}
      </p>
      <div>
        <Button variant="primary" size="lg" onClick={props.onContinue}>
          {m.session_between_continue()}
        </Button>
      </div>
    </Card>
  )
}
