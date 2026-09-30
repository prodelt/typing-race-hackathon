import type { Key, Layout } from '@typing-race/domain'
import type { Generator, GeneratorContext } from '../types'
import { isAvailable, sameFinger } from './shared'

/** The keys of one row in physical order, without the space bar and the Shift keys. */
function rowOf(layout: Layout, row: Key['row']): Key[] {
  return layout.keys.filter(
    (key) => key.row === row && key.kind !== 'space' && key.kind !== 'modifier',
  )
}

/**
 * The home-row key a top- or bottom-row key is paired with: the one in the same column — `q` over
 * `a`, `v` under `f`, `ю` under `д` — provided the same finger types both. The index fingers reach
 * two columns each, so the column decides, not the finger alone. A key with no same-finger key in
 * its column (`ї`, past the end of the home row) falls back to its finger's anchor.
 *
 * Returns a list of zero or one so callers never branch on a missing partner. Exported so the
 * catalogue can say which home key a vertical scale `requires`.
 */
export function homePartners(layout: Layout, key: Key): Key[] {
  const column = rowOf(layout, key.row).indexOf(key)
  const anchors = layout.keys.filter((candidate) => layout.homeAnchors.includes(candidate.plain))
  return [rowOf(layout, 'home')[column], ...anchors]
    .filter((candidate): candidate is Key => candidate !== undefined && sameFinger(candidate, key))
    .slice(0, 1)
}

function columnPairs(context: GeneratorContext): [Key, Key][] {
  const { layout } = context
  return [...rowOf(layout, 'top'), ...rowOf(layout, 'bottom')].flatMap((key): [Key, Key][] => {
    if (key.kind !== 'letter' || !isAvailable(context, key)) return []
    return homePartners(layout, key)
      .filter((home) => isAvailable(context, home))
      .map((home): [Key, Key] => [home, key])
  })
}

/**
 * `vertical` — each home key paired with the key above it on the same finger, then with the one
 * below (R6). Punctuation keys on the top and bottom rows are left to `modifiers`. With no top- or
 * bottom-row key available there is no pair at all, so the pool is empty and the scale is not
 * offered, as R6 requires.
 */
export const vertical: Generator = (context) => {
  const pairs = columnPairs(context).map(([home, reach]) => `${home.plain}${reach.plain}`)
  return context.forms.flatMap((form) => pairs.map((pair) => `${pair}${pair}${form}`))
}
