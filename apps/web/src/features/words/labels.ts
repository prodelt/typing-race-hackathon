import { fingerOf, SHIFT_TOKEN, stage2Gate, type WeakElements } from '@typing-race/curriculum'
import type { Layout, WordDrill } from '@typing-race/domain'
import { parseTransitionKey } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { fingerLabel } from '../exercise/labels.js'

/**
 * Every sentence the Stage 2 screens build from a drill. The goal names the keys, fingers or
 * transition the drill trains, read from the layout rather than written per drill, so it cannot
 * name a finger the finger map disagrees with (requirements §3.2: "every exercise explains which
 * keys, fingers or transitions it builds").
 */

/** U+0027 is stored, U+2019 is shown (docs/adr/0003). */
export function glyph(char: string): string {
  if (char === SHIFT_TOKEN) return 'Shift'
  return char === "'" ? '’' : char
}

/** A word as the learner reads it. */
export function displayWord(word: string): string {
  return word.replaceAll("'", '’')
}

function finger(layout: Layout, char: string): string {
  const assignment = fingerOf(layout, char)
  return assignment === undefined ? '' : fingerLabel(assignment)
}

function bandName(drill: WordDrill): string {
  const min = drill.lengths?.min ?? 1
  if (min >= 8) return m.path_words_name_long()
  if (min >= 5) return m.path_words_name_medium()
  return m.path_words_name_short()
}

export function drillName(drill: WordDrill): string {
  const key = drill.focus === null ? '' : glyph(drill.focus.value)
  switch (drill.kind) {
    case 'firstWords':
      return m.path_words_name_first()
    case 'length':
      return bandName(drill)
    case 'newKey':
      return m.path_words_name_key({ key })
    case 'ukLetter':
      return m.path_words_name_ukLetter({ key })
    case 'repeat':
      return m.path_words_name_repeat()
    case 'sameFinger':
      return m.path_words_name_sameFinger()
    case 'alternation':
      return m.path_words_name_alternation()
    case 'apostrophe':
      return m.path_words_name_apostrophe()
    case 'hyphen':
      return m.path_words_name_hyphen()
    case 'capitals':
      return m.path_words_name_capitals()
    case 'weak':
      return m.path_words_name_weak()
    case 'focus': {
      const pair = drill.focus === null ? undefined : parseTransitionKey(drill.focus.value)
      return pair === undefined
        ? m.path_words_name_key({ key })
        : m.path_words_name_focus_transition({ from: glyph(pair.from), to: glyph(pair.to) })
    }
  }
}

function weakList(weak: WeakElements): string {
  const keys = weak.keys.map((key) => `«${glyph(key)}»`)
  const moves = weak.transitions.map((key) => {
    const pair = parseTransitionKey(key)
    return pair === undefined ? key : `«${glyph(pair.from)}${glyph(pair.to)}»`
  })
  return [...keys, ...moves].join(', ')
}

export function drillGoal(drill: WordDrill, layout: Layout, weak: WeakElements): string {
  const focus = drill.focus?.value ?? ''
  switch (drill.kind) {
    case 'firstWords':
      return m.path_words_goal_first({
        keys: [...layout.homeAnchors, ...stage2Gate(layout)].map(glyph).join(' '),
      })
    case 'length': {
      const min = drill.lengths?.min ?? 1
      if (min >= 8) return m.path_words_goal_long()
      if (min >= 5) return m.path_words_goal_medium()
      return m.path_words_goal_short()
    }
    case 'newKey':
      return m.path_words_goal_key({ key: glyph(focus), finger: finger(layout, focus) })
    case 'ukLetter':
      return m.path_words_goal_ukLetter({ key: glyph(focus), finger: finger(layout, focus) })
    case 'repeat':
      return m.path_words_goal_repeat()
    case 'sameFinger':
      return m.path_words_goal_sameFinger()
    case 'alternation':
      return m.path_words_goal_alternation()
    case 'apostrophe':
      return m.path_words_goal_apostrophe({ finger: finger(layout, "'") })
    case 'hyphen':
      return m.path_words_goal_hyphen({ finger: finger(layout, '-') })
    case 'capitals':
      return m.path_words_goal_capitals()
    case 'weak':
      return weak.keys.length + weak.transitions.length === 0
        ? m.path_words_goal_weak_none()
        : m.path_words_goal_weak({ elements: weakList(weak) })
    case 'focus': {
      const pair = parseTransitionKey(focus)
      if (pair === undefined) {
        return m.path_words_goal_focus_key({ key: glyph(focus), finger: finger(layout, focus) })
      }
      return m.path_words_goal_focus_transition({
        from: glyph(pair.from),
        to: glyph(pair.to),
        fromFinger: finger(layout, pair.from),
        toFinger: finger(layout, pair.to),
      })
    }
  }
}

/** The chip the exercise screen shows as the Focus Element: a key, a move or the drill's name. */
export function drillChip(drill: WordDrill): string {
  if (drill.focus === null) return drillName(drill)
  const pair = parseTransitionKey(drill.focus.value)
  return pair === undefined ? glyph(drill.focus.value) : `${glyph(pair.from)} → ${glyph(pair.to)}`
}
