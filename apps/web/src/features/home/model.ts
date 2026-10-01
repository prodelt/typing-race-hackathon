import { elementStats, XP_PER_PASS } from '@typing-race/curriculum'
import type { AttemptSummary, Layout, Scale } from '@typing-race/domain'
import type { SessionPlan } from '../session/compose.js'
import { currentSpm, REAL_TEXT_MINUTES, secondsPerAttempt } from '../session/sizing.js'

/**
 * Home's own arithmetic, kept out of the screen so it can be tested without rendering it. Every
 * number here is derived from data the app already has; nothing is a placeholder.
 */

/**
 * Minutes for each step of the session Home offers: the three blocks, then the real text. Each is
 * rounded on its own and never shown as 0, so a short block still reads as a step that takes time.
 */
export function stepMinutes(
  plan: SessionPlan,
  attempts: readonly AttemptSummary[],
  scaleById: (id: string) => Scale | undefined,
): number[] {
  const spm = currentSpm(attempts)
  const blocks = plan.blocks.map((block) => {
    const size = scaleById(block.scaleId)?.size ?? 0
    return Math.max(1, Math.round((block.reps * secondsPerAttempt(spm, size)) / 60))
  })
  return [...blocks, REAL_TEXT_MINUTES]
}

/**
 * The most XP the session can earn. Only test attempts at or above the floor pay, and only the
 * consolidation block is a test, so the ceiling is its repetitions times the pass reward. The
 * mastery bonus is left out: whether a pass completes a streak is not known in advance.
 */
export function sessionXp(plan: SessionPlan): number {
  return plan.blocks
    .filter((block) => block.mode === 'test')
    .reduce((sum, block) => sum + block.reps * XP_PER_PASS, 0)
}

/** The mean interval on one element across the last `count` attempts that measured it. */
export function weakTrend(
  history: readonly AttemptSummary[],
  element: string,
  count = 5,
): number[] {
  const points: number[] = []
  for (let i = history.length - 1; i >= 0 && points.length < count; i--) {
    const attempt = history[i]
    if (attempt === undefined) continue
    const mean = elementStats([attempt], element).meanIkiMs
    if (mean !== null) points.push(Math.round(mean))
  }
  return points.reverse()
}

/** Where the learner stands in the Unlock Order, as the few keys the mini-map has room for. */
export interface KeyWindow {
  /** The last keys opened, oldest first. */
  readonly done: readonly string[]
  /** The key being worked towards; `undefined` once every key is open. */
  readonly current: string | undefined
  /** The keys after it, still closed. */
  readonly later: readonly string[]
}

export function keyWindow(
  layout: Layout,
  unlocked: readonly string[],
  shape: { done: number; later: number } = { done: 4, later: 2 },
): KeyWindow {
  // The anchors are open from the first exercise and are not in the Unlock Order, but they are
  // where the route starts.
  const order = [...new Set([...layout.homeAnchors, ...layout.unlockOrder])].filter(
    (char) => char !== ' ',
  )
  const at = order.findIndex((char) => !unlocked.includes(char))
  const end = at === -1 ? order.length : at
  return {
    done: order.slice(Math.max(0, end - shape.done), end),
    current: at === -1 ? undefined : order[at],
    later: at === -1 ? [] : order.slice(at + 1, at + 1 + shape.later),
  }
}

export interface GoalBar {
  readonly date: string
  readonly minutes: number
  /** Bar height as a share of the chart, 0–1. */
  readonly height: number
  readonly today: boolean
}

/**
 * The seven-day chart. The scale leaves the goal line at a fixed height unless a day went past
 * it, so an ordinary week always reads against the same line.
 */
export function goalChart(
  last7: readonly { readonly date: string; readonly minutes: number }[],
  goalMinutes: number,
): { bars: GoalBar[]; goalAt: number; rest: number } {
  const top = Math.max(goalMinutes * 1.75, ...last7.map((day) => day.minutes))
  const bars = last7.map((day, i) => ({
    date: day.date,
    minutes: day.minutes,
    height: top === 0 ? 0 : day.minutes / top,
    today: i === last7.length - 1,
  }))
  const today = last7.at(-1)?.minutes ?? 0
  return {
    bars,
    goalAt: top === 0 ? 0 : goalMinutes / top,
    rest: top === 0 ? 0 : Math.max(0, goalMinutes - today) / top,
  }
}
