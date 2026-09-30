import type { Key, Layout, Progress, Scale, ScaleType, TransitionKey } from '@typing-race/domain'
import { parseTransitionKey, transitionKey } from '@typing-race/domain'
import { keyOf, SHIFT_TOKEN } from '../layout'
import { weakTransitions } from '../progress/weak-transitions'
import { catalogue, SCALE_GOAL_KEYS } from './catalogue'

/** The id segment that marks a Transition-focused Scale: `yq.transition.KeyJ-KeyK`. */
const TRANSITION_SEGMENT = 'transition'
const TRANSITION_SIZE = 60
/** How many of the learner's weakest Transitions get a drill of their own at once. */
export const TRANSITION_SCALE_LIMIT = 3

/** A character as its key's code, `+shift` for the shifted character: stable and URL-safe. */
export function slugOf(key: Key, char: string): string {
  return key.shifted === char && key.plain !== char ? `${key.code}+shift` : key.code
}

/** The inverse of {@link slugOf}. */
export function charOfSlug(layout: Layout, slug: string): string | undefined {
  const shifted = slug.endsWith('+shift')
  const code = shifted ? slug.slice(0, -'+shift'.length) : slug
  const key = layout.keys.find((candidate) => candidate.code === code)
  if (key === undefined) return undefined
  const char = shifted ? key.shifted : key.plain
  return char === null || char === '' ? undefined : char
}

/**
 * The type a Transition's drill answers to, read from the move's geometry: across the hands it is
 * an `alternate`, up or down a row it is a `vertical`, and along one row of one hand it is a `run`.
 * The type names the goal the learner reads; `generateText` builds the pool from the Focus Element.
 */
function typeOf(from: Key, to: Key): ScaleType {
  if (from.hand !== to.hand && from.hand !== 'thumbs' && to.hand !== 'thumbs') return 'alternate'
  if (from.row !== to.row && from.kind !== 'space' && to.kind !== 'space') return 'vertical'
  return 'run'
}

/**
 * The drill for one Transition — a Scale focused on the move `from → to`, built on demand rather
 * than authored, because which moves need drilling depends on the learner. It is a pure function of
 * `(layout, transition)`, so its id always means the same Scale and an attempt on it can be
 * re-opened from history. `undefined` for a Transition this layout cannot type, or one involving
 * the Shift token, which is not a character.
 */
export function transitionScale(layout: Layout, transition: TransitionKey): Scale | undefined {
  const pair = parseTransitionKey(transition)
  if (pair === undefined || pair.from === SHIFT_TOKEN || pair.to === SHIFT_TOKEN) return undefined
  // Two spaces in a row is not a move any text asks for, and would render as one gap.
  if (pair.from === ' ' && pair.to === ' ') return undefined
  const from = keyOf(layout, pair.from)
  const to = keyOf(layout, pair.to)
  // `keyOf` folds apostrophes; a drill is only built for the stored form.
  if (from === undefined || to === undefined) return undefined
  if (from.plain !== pair.from && from.shifted !== pair.from) return undefined
  if (to.plain !== pair.to && to.shifted !== pair.to) return undefined

  const type = typeOf(from, to)
  const fingers = [from, to]
    .map(({ hand, finger }) => ({ hand, finger }))
    .filter((f, i, all) => all.findIndex((g) => g.hand === f.hand && g.finger === f.finger) === i)
  // What must be unlocked is the key, plus Shift for a shifted character: the unlocked set holds
  // plain characters and the Shift token, never capitals.
  const ends: [Key, string][] = [
    [from, pair.from],
    [to, pair.to],
  ]
  const needs = ends.flatMap(([key, char]) =>
    key.plain === char ? [char] : [key.plain, SHIFT_TOKEN],
  )
  const requires = [...new Set(needs)].filter(
    (char) => char !== ' ' && !layout.homeAnchors.includes(char),
  )
  return {
    id: `${layout.id}.${TRANSITION_SEGMENT}.${slugOf(from, pair.from)}-${slugOf(to, pair.to)}`,
    layoutId: layout.id,
    type,
    focus: { kind: 'transition', value: transitionKey(pair.from, pair.to) },
    fingers,
    size: TRANSITION_SIZE,
    targetSpm: null,
    goal: SCALE_GOAL_KEYS[type],
    requires,
  }
}

/** The Transition-focused Scale an id names, or `undefined` when the id is not one. */
function transitionScaleById(layout: Layout, id: string): Scale | undefined {
  const prefix = `${layout.id}.${TRANSITION_SEGMENT}.`
  if (!id.startsWith(prefix)) return undefined
  const [fromSlug, toSlug, ...rest] = id.slice(prefix.length).split('-')
  if (fromSlug === undefined || toSlug === undefined || rest.length > 0) return undefined
  const from = charOfSlug(layout, fromSlug)
  const to = charOfSlug(layout, toSlug)
  if (from === undefined || to === undefined) return undefined
  const scale = transitionScale(layout, transitionKey(from, to))
  return scale?.id === id ? scale : undefined
}

/**
 * Any Scale by id: an authored one from the Scale Catalogue, or a Transition drill, which is not in
 * the catalogue because it is built per learner. This is what a route or a button resolves.
 */
export function scaleById(layout: Layout, id: string): Scale | undefined {
  const authored = catalogue[layout.id].find((scale) => scale.id === id)
  return authored ?? transitionScaleById(layout, id)
}

/**
 * The drills for the learner's weakest Transitions, weakest first, up to `limit`: the part of the
 * catalogue that is built from the learner's own history rather than authored. Only drills the
 * learner can start now are returned — both keys unlocked — and each is a {@link transitionScale},
 * so its id resolves through {@link scaleById} for as long as it is linked.
 */
export function transitionScales(
  layout: Layout,
  progress: Progress,
  limit = TRANSITION_SCALE_LIMIT,
): Scale[] {
  const unlocked = new Set(progress.unlockedSet)
  const drills: Scale[] = []
  for (const weak of weakTransitions(progress, layout)) {
    if (drills.length >= limit) break
    const scale = transitionScale(layout, weak.key)
    if (scale?.requires.every((char) => unlocked.has(char))) {
      drills.push(scale)
    }
  }
  return drills
}
