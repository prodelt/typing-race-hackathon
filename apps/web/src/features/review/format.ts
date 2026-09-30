import { ERROR_RATE_FLOOR, SLOW_IKI_MS, type SpotStats } from '@typing-race/curriculum'
import { parseTransitionKey } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'

/** One character as the learner sees it: the space bar as a visible glyph, apostrophes typeset. */
export function glyph(char: string): string {
  if (char === ' ') return '␣'
  return char === "'" ? '’' : char
}

/** A key or a Transition as a short label: `о`, `о → л`. */
export function spotLabel(element: string): string {
  const pair = parseTransitionKey(element)
  return pair === undefined ? glyph(element) : `${glyph(pair.from)} → ${glyph(pair.to)}`
}

/** The same label for a screen reader: the space bar named in words. */
export function spotSpoken(element: string): string {
  const spoken = (char: string) => (char === ' ' ? m.review_space() : char)
  const pair = parseTransitionKey(element)
  return pair === undefined ? spoken(element) : `${spoken(pair.from)} → ${spoken(pair.to)}`
}

export function pct(fraction: number): number {
  return Math.round(fraction * 100)
}

export function ms(value: number | null): string {
  return value === null ? m.review_interval_none() : m.review_interval({ ms: Math.round(value) })
}

/** The "why" of a weak spot: `14% помилок, 310 мс`. */
export function numbers(stats: SpotStats): string {
  return `${m.review_errors({ rate: pct(stats.errorRate) })}, ${ms(stats.meanIkiMs)}`
}

/** Which of the two reasons makes it weak, in words. */
export function reason(stats: SpotStats): string {
  const slow = (stats.meanIkiMs ?? SLOW_IKI_MS) >= SLOW_IKI_MS
  const missed = stats.errorRate >= ERROR_RATE_FLOOR
  if (slow && missed) return m.review_why_both()
  return slow ? m.review_why_slow() : m.review_why_errors()
}
