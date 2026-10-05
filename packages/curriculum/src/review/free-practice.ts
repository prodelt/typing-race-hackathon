import type { Layout } from '@typing-race/domain'

/**
 * Free practice: exercises the learner types for their own sake. The daily challenge and own text
 * earn no XP, no mastery and no unlocks, count toward neither the streak nor the daily goal, feed no
 * weak spots or key confidence, and never go to the server (which does not know these ids).
 *
 * Like the real-text block, each is recorded under `<layout>.<segment>`.
 */

const DAILY_SEGMENT = 'daily'
const OWN_TEXT_SEGMENT = 'owntext'

function segmentOf(id: string): string | undefined {
  const parts = id.split('.')
  return parts.length === 2 ? parts[1] : undefined
}

/** The id a daily-challenge attempt is recorded under: `yq.daily`. */
export function dailyId(layout: Layout): string {
  return `${layout.id}.${DAILY_SEGMENT}`
}

export function isDailyId(id: string): boolean {
  return segmentOf(id) === DAILY_SEGMENT
}

/** The id an own-text attempt is recorded under: `yq.owntext`. */
export function ownTextId(layout: Layout): string {
  return `${layout.id}.${OWN_TEXT_SEGMENT}`
}

export function isOwnTextId(id: string): boolean {
  return segmentOf(id) === OWN_TEXT_SEGMENT
}

/** An attempt that mastery, XP, the streak, the daily goal, weak spots and the outbox all ignore. */
export function isFreePracticeId(id: string): boolean {
  return isDailyId(id) || isOwnTextId(id)
}
