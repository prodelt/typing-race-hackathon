import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { Arrow } from '../screen.js'

/**
 * What was just done and what comes next, then one button. It names both blocks in words, so the
 * learner is never asked to infer the sequence from a progress bar. Set as the brand's "torn"
 * headline: the finished block in the faint grey, the next one in ink, offset under it.
 */
export function BetweenBlocks(props: {
  readonly finished: string
  readonly next: string
  readonly onContinue: () => void
}) {
  return (
    <div
      className="between panel gp-host gp-host--bright panel--corner rise"
      data-testid="between-blocks"
    >
      <GradLayer tone="bright" seed={4} count={4} />
      <h2 className="flabel">{m.session_between_title()}</h2>
      <p className="torn2">
        <span className="torn2__a">{m.session_between_done({ block: props.finished })}</span>
        <span className="torn2__b">{m.session_between_next({ block: props.next })}</span>
      </p>
      <button type="button" className="poster session__poster" onClick={props.onContinue}>
        <span>{m.session_between_continue()}</span>
        <Arrow size={40} />
      </button>
    </div>
  )
}
