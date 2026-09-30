import { nextLockedKey } from '@typing-race/curriculum'
import type { Key, Layout, Progress } from '@typing-race/domain'
import { Keycap } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { keyLabel } from './labels.js'
import { displayChar, type KeyState, keyStates, totalKeyCount, unlockedKeyCount } from './model.js'

/**
 * The full keyboard of the active layout, one `Keycap` per physical key in its finger colour, with
 * the count of open keys as the block's one big number beside it.
 *
 * Lock state comes from `keyStates`, which reads the derived unlocked set: this component never
 * decides what is open. The next key to unlock is drawn awaited (the brand red), and named in a
 * visible sentence as well: keycaps are decorative to a screen reader (a wall of sixty glyphs would
 * bury the page), so the text carries the information and the keys carry the picture. Locked is
 * shown by opacity and by the legend, never by colour alone.
 */

const ROW_ORDER = ['digit', 'top', 'home', 'bottom'] as const

/** Staggers the rows the way a physical keyboard does. */
const ROW_INDENT = { digit: 'ml-0', top: 'ml-5', home: 'ml-8', bottom: 'ml-2' } as const

function glyphOf(key: Key): string {
  return key.kind === 'modifier' ? '⇧' : displayChar(key.plain)
}

function widthOf(key: Key): 'unit' | 'wide' | 'space' {
  if (key.kind === 'modifier') return 'wide'
  return key.kind === 'space' ? 'space' : 'unit'
}

export function PathKeyboard({
  layout,
  progress,
}: {
  readonly layout: Layout
  readonly progress: Progress
}) {
  const states = keyStates(layout, progress)
  const next = nextLockedKey(layout, progress.unlockedSet)
  const total = totalKeyCount(layout)
  const unlocked = unlockedKeyCount(progress)

  const renderKey = (key: Key) => {
    const state: KeyState = states.get(key.code) ?? 'locked'
    return (
      <Keycap
        key={key.code}
        glyph={glyphOf(key)}
        finger={key.finger}
        locked={state === 'locked'}
        awaited={state === 'next'}
        width={widthOf(key)}
        data-state={state}
        data-code={key.code}
      />
    )
  }

  const typing = layout.keys.filter((key) => key.kind !== 'space' && key.kind !== 'modifier')
  const shifts = layout.keys.filter((key) => key.kind === 'modifier')
  const space = layout.keys.find((key) => key.kind === 'space')

  return (
    <div className="path-board">
      <div>
        <p className="num num--red path-board__count" aria-hidden="true">
          {unlocked}
          <span className="path-board__of">/{total}</span>
        </p>
        <p className="path-board__summary" data-testid="keyboard-summary">
          {next === undefined
            ? m.path_keyboard_done({ total })
            : m.path_keyboard_summary({ unlocked, total, key: keyLabel(next) })}
        </p>
        <ul className="path-board__legend">
          <li>
            <span className="path-board__swatch path-board__swatch--next" aria-hidden="true" />
            {m.path_keyboard_legend_next()}
          </li>
          <li>
            <span className="path-board__swatch path-board__swatch--locked" aria-hidden="true" />
            {m.path_keyboard_legend_locked()}
          </li>
        </ul>
      </div>

      <div className="path-board__keys">
        <div className="grid w-max gap-1.5" data-testid="keyboard">
          {ROW_ORDER.map((row) => (
            <div key={row} className={`flex gap-1.5 ${ROW_INDENT[row]}`}>
              {row === 'bottom' && shifts[0] !== undefined && renderKey(shifts[0])}
              {typing.filter((key) => key.row === row).map(renderKey)}
              {row === 'bottom' && shifts[1] !== undefined && renderKey(shifts[1])}
            </div>
          ))}
          {space !== undefined && <div className="ml-24 flex">{renderKey(space)}</div>}
        </div>
      </div>
    </div>
  )
}
