import type { LayoutId } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { LAYOUT_NAMES } from '../exercise/labels.js'

/** `wrong` only when the browser proves the layout is missing; otherwise the page cannot tell. */
export type RaceLayoutProbe = 'unknown' | 'wrong'

export interface RaceLayoutNoticeProps {
  readonly layoutId: LayoutId
  readonly probe: RaceLayoutProbe
  /** A letter of the race's layout has been typed: the learner is on it, whatever the probe said. */
  readonly proven: boolean
  /** The last keystrokes were letters the layout cannot produce. */
  readonly typedWrong: boolean
  readonly live: boolean
}

/**
 * Says what a Race cannot say by itself. A race is stop-on-letter, so a learner on the wrong Active
 * layout sees a line that never moves and no reason why. This is the reason, in plain words: once
 * three letters of another layout have been typed (works in every browser), or at once when the
 * browser proves the layout is missing. Before the start it only names the layout the text needs,
 * because the browser cannot say which layout is active. It never blocks.
 */
export function RaceLayoutNotice({
  layoutId,
  probe,
  proven,
  typedWrong,
  live,
}: RaceLayoutNoticeProps) {
  const layout = LAYOUT_NAMES[layoutId]

  if (typedWrong) {
    return (
      <p className="race-layout" role="alert" data-tone="wrong" data-testid="race-layout-notice">
        {m.race_layout_typed_wrong({ layout })}
      </p>
    )
  }
  // A typed letter of the right layout outranks the probe: the map may lag a layout switched while
  // the page is open.
  if (probe === 'wrong' && !proven) {
    return (
      <p className="race-layout" role="alert" data-tone="wrong" data-testid="race-layout-notice">
        {m.race_layout_wrong_active({ layout })}
      </p>
    )
  }
  if (live) return null
  return (
    <p className="race-layout" role="status" data-tone="calm" data-testid="race-layout-notice">
      {proven ? m.race_layout_confirmed({ layout }) : m.race_layout_hint({ layout })}
    </p>
  )
}
