import type { RealText } from '@typing-race/curriculum'
import { Button, Card, Index } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import type { RealTextState } from './useRealText.js'

/** The sentence that says honestly what the fourth block is made of. */
export function realTextKindLine(block: RealText): string {
  if (block.kind === 'sentences') return m.session_realtext_kind_sentences()
  if (block.kind === 'closest') {
    return m.session_realtext_kind_closest({ chars: block.locked.join(' ') })
  }
  return m.session_realtext_kind_words()
}

/**
 * The fourth block of a session on the session screen: what the text is made of, the text itself
 * as a preview, and one button that opens it on the exercise screen. Once the attempt is recorded
 * the same card says so and offers to finish. Finishing without the text is always possible.
 */
export function RealTextBlock(props: {
  readonly state: RealTextState
  readonly done: boolean
  readonly onStart: () => void
  readonly onFinish: () => void
}) {
  const { state, done } = props
  const block = state.status === 'ready' ? state.block : null

  return (
    <Card raised className="flex flex-col gap-4 p-6" data-testid="real-text-block">
      <Index n={4}>
        <span className="font-ui font-semibold text-ink">{m.session_realtext_title()}</span>
      </Index>

      {/* Once typed, the preview would show the next text, not the one just typed. */}
      {done ? null : state.status === 'loading' ? (
        <p role="status" className="font-ui text-ink-soft">
          {m.session_realtext_loading()}
        </p>
      ) : block === null ? (
        <p className="font-ui text-ink" data-testid="real-text-kind">
          {m.session_realtext_none()}
        </p>
      ) : (
        <>
          <p className="font-ui text-ink" data-testid="real-text-kind" data-kind={block.kind}>
            {realTextKindLine(block)}
          </p>
          <blockquote
            className="m-0 border-l-2 border-accent pl-4 font-typing text-lg leading-relaxed text-ink"
            data-testid="real-text-preview"
          >
            {block.text}
          </blockquote>
          {block.sources.length > 0 && (
            <p className="font-ui text-sm text-muted">
              {m.session_realtext_from({ titles: block.sources.join(', ') })}
            </p>
          )}
        </>
      )}

      {done ? (
        <>
          <p className="font-ui font-semibold text-ink">{m.session_realtext_done()}</p>
          <div>
            <Button variant="primary" size="lg" onClick={props.onFinish}>
              {m.session_realtext_finish()}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {block !== null && (
              <Button variant="primary" size="lg" onClick={props.onStart}>
                {m.session_realtext_start()}
              </Button>
            )}
            <Button variant={block === null ? 'primary' : 'quiet'} onClick={props.onFinish}>
              {m.session_realtext_finish()}
            </Button>
          </div>
          {block !== null && (
            <p className="font-ui text-sm text-muted">{m.session_realtext_skip_note()}</p>
          )}
        </div>
      )}
    </Card>
  )
}
