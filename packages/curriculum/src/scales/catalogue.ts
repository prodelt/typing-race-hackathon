import type { FingerAssignment, Key, Layout, Scale, ScaleType } from '@typing-race/domain'
import { keyOf, layouts, SHIFT_TOKEN } from '../layout'
import { homePartners, SPACE } from './generators'

/**
 * One message key per type, because the goal is what the *type* teaches (FR-010): "keep each finger
 * on its own key and return to the home row". The strings live in the web app's message catalogues;
 * this package holds the keys only, so it stays free of i18n (ADR-0007).
 */
export const SCALE_GOAL_KEYS: Record<ScaleType, string> = {
  run: 'scale_goal_run',
  mirror: 'scale_goal_mirror',
  alternate: 'scale_goal_alternate',
  fingerIsolation: 'scale_goal_finger_isolation',
  vertical: 'scale_goal_vertical',
  fingerSpan: 'scale_goal_finger_span',
  modifiers: 'scale_goal_modifiers',
  tempo: 'scale_goal_tempo',
}

const DEFAULT_SIZE = 60
/** Nine motifs of eight: three per metronome step, so each step is long enough to settle into. */
const TEMPO_SIZE = 80
/** Where the metronome starts for a `tempo` Scale; it steps up from here (research R6). */
const TEMPO_START_SPM = 100

/** The fingers that type the Shift+key combination: each pinky, since Shift is always opposite. */
const SHIFT_FINGERS: readonly FingerAssignment[] = [
  { hand: 'left', finger: 'pinky' },
  { hand: 'right', finger: 'pinky' },
]

function scale(
  layout: Layout,
  slug: string,
  type: ScaleType,
  focus: string,
  fingers: readonly FingerAssignment[],
  requires: readonly string[],
): Scale {
  return {
    id: `${layout.id}.${type}.${slug}`,
    layoutId: layout.id,
    type,
    focus: { kind: 'key', value: focus },
    fingers,
    size: type === 'tempo' ? TEMPO_SIZE : DEFAULT_SIZE,
    targetSpm: type === 'tempo' ? TEMPO_START_SPM : null,
    goal: SCALE_GOAL_KEYS[type],
    requires,
  }
}

/** The five types that need nothing beyond the anchors, exercised on the anchors themselves. */
function anchorScales(layout: Layout): Scale[] {
  const { homeAnchors } = layout
  const fingers = layout.keys
    .filter((key) => homeAnchors.includes(key.plain))
    .map(({ hand, finger }) => ({ hand, finger }))
  // The focus differs per scale so each opens on a different anchor: 3 and 4 are the two index
  // fingers, 0 and 7 the two outer pinkies.
  const focusAt = (index: number) => homeAnchors.slice(index, index + 1).join('')
  return [
    scale(layout, 'anchors', 'run', focusAt(3), fingers, []),
    scale(layout, 'anchors', 'mirror', focusAt(4), fingers, []),
    scale(layout, 'anchors', 'alternate', focusAt(0), fingers, []),
    scale(layout, 'anchors', 'fingerIsolation', focusAt(7), fingers, []),
    scale(layout, 'anchors', 'tempo', focusAt(3), fingers, []),
  ]
}

/**
 * The space bar as a movement of its own (§3.1: "space, Shift, digits and punctuation as separate
 * movements"). The space bar is unlocked from the first exercise, so this scale needs nothing and
 * sits with the anchor scales: a letter of each hand either side of the thumb strike.
 */
function spaceScale(layout: Layout): Scale {
  return scale(layout, 'space', 'modifiers', SPACE, [{ hand: 'thumbs', finger: 'thumb' }], [])
}

/** The key behind an Unlock Order entry. The order is derived from the keys, so a miss is a bug. */
function keyFor(layout: Layout, char: string): Key {
  const key = keyOf(layout, char)
  if (key === undefined) {
    throw new RangeError(`Unlock Order entry ${char} has no key on ${layout.id}`)
  }
  return key
}

/**
 * The scale that teaches one entry of the Unlock Order — the first scale whose Focus Element is
 * that key, which is what FR-041 unlocks it on. Its type follows what the key is: a home-row letter
 * extends the run; a top- or bottom-row letter is a vertical reach from its home key; everything
 * else (Shift, digits, punctuation, `ґ`) is a modifier-row movement.
 */
function unlockScale(layout: Layout, char: string): Scale {
  if (char === SHIFT_TOKEN) return scale(layout, 'shift', 'modifiers', char, SHIFT_FINGERS, [])
  const key = keyFor(layout, char)
  const slug = key.shifted === char ? `${key.code}+shift` : key.code
  const fingers = [{ hand: key.hand, finger: key.finger }]
  if (key.kind !== 'letter') return scale(layout, slug, 'modifiers', char, fingers, [])
  if (key.row === 'home') return scale(layout, slug, 'run', char, fingers, [])
  // The home key it reaches from, unless that is an anchor and so always there.
  const requires = homePartners(layout, key)
    .filter((home) => !layout.homeAnchors.includes(home.plain))
    .map((home) => home.plain)
  return scale(layout, slug, 'vertical', char, fingers, requires)
}

function fingerSlug(key: Key): string {
  return `${key.hand}-${key.finger}`
}

/**
 * One `fingerSpan` scale per finger, focused on the last key of that finger to unlock and requiring
 * the ones before it: by then the whole span is available and worth drilling (R6). Keyed by focus.
 */
function spanScales(layout: Layout): Map<string, Scale> {
  const letters = layout.unlockOrder
    .filter((char) => char !== SHIFT_TOKEN)
    .map((char) => ({ char, key: keyFor(layout, char) }))
    .filter(({ key }) => key.kind === 'letter')
  const last = new Map<string, string>()
  for (const { char, key } of letters) last.set(fingerSlug(key), char)

  const earlier = new Map<string, string[]>()
  const spans = new Map<string, Scale>()
  for (const { char, key } of letters) {
    const slug = fingerSlug(key)
    const before = earlier.get(slug) ?? []
    if (last.get(slug) === char) {
      const fingers = [{ hand: key.hand, finger: key.finger }]
      spans.set(char, scale(layout, slug, 'fingerSpan', char, fingers, before))
    }
    earlier.set(slug, [...before, char])
  }
  return spans
}

/** Exported so the tests can feed it a corrupt layout; callers use `catalogue`. */
export function buildCatalogue(layout: Layout): Scale[] {
  const spans = spanScales(layout)
  const unlocks = layout.unlockOrder.flatMap((char) => {
    const span = spans.get(char)
    return span === undefined ? [unlockScale(layout, char)] : [unlockScale(layout, char), span]
  })
  return [...anchorScales(layout), spaceScale(layout), ...unlocks]
}

/**
 * The Scale Catalogue of each layout, ordered against its Unlock Order: the anchor scales and the
 * space-bar scale first, then one scale per unlockable key in unlock order, each finger's `fingerSpan` right after the last
 * of its keys. All eight generator types appear for both layouts (SC-003).
 *
 * Text is never authored here (FR-009). A Scale is metadata over a generator, and its `requires`
 * lists the keys it needs so that `generateText` can refuse rather than degrade.
 */
export const catalogue: Record<'yq' | 'qwerty', Scale[]> = {
  yq: buildCatalogue(layouts.yq),
  qwerty: buildCatalogue(layouts.qwerty),
}
