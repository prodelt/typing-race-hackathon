import { layouts, XP_PER_PASS } from '@typing-race/curriculum'
import type { AttemptSummary, Scale } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import type { Block, SessionPlan } from '../session/compose'
import { REAL_TEXT_MINUTES } from '../session/sizing'
import { goalChart, keyWindow, sessionXp, stepMinutes, weakTrend } from './model'

const layout = layouts.yq
const focus = { kind: 'key', value: 'а' } as const

function block(kind: Block['kind'], mode: Block['mode'], reps: number): Block {
  return { kind, scaleId: kind, mode, reps, focus, fallback: false }
}

const plan: SessionPlan = {
  blocks: [
    block('warmUp', 'practice', 2),
    block('target', 'practice', 4),
    block('consolidation', 'test', 3),
  ],
  realTextId: 'rt',
  expectedMinutes: 20,
}

function attemptWith(
  transitions: Record<string, { count: number; misses: number; sumIki: number }>,
) {
  return { aggregates: { keys: {}, transitions } } as unknown as AttemptSummary
}

describe('stepMinutes', () => {
  it('gives one figure per block plus the real text, none of them zero', () => {
    const sized = (id: string) => ({ id, size: 120 }) as unknown as Scale
    const minutes = stepMinutes(plan, [], sized)
    expect(minutes).toHaveLength(4)
    expect(minutes.at(-1)).toBe(REAL_TEXT_MINUTES)
    for (const value of minutes) expect(value).toBeGreaterThanOrEqual(1)
    // More repetitions of the same scale never take less time.
    expect(minutes[1]).toBeGreaterThanOrEqual(minutes[0] ?? 0)
  })

  it('still answers when a scale is missing from the catalogue', () => {
    expect(stepMinutes(plan, [], () => undefined).every((m) => m >= 1)).toBe(true)
  })
})

describe('sessionXp', () => {
  it('counts only the test block, at the pass reward per repetition', () => {
    expect(sessionXp(plan)).toBe(3 * XP_PER_PASS)
  })
})

describe('weakTrend', () => {
  it('returns the last five measured means, oldest first, skipping attempts without the element', () => {
    const history = [600, 560, 520, 488, 455, 430, 412].map((mean) =>
      attemptWith({ 'о>л': { count: 4, misses: 0, sumIki: mean * 4 } }),
    )
    history.splice(5, 0, attemptWith({}))
    expect(weakTrend(history, 'о>л')).toEqual([520, 488, 455, 430, 412])
  })

  it('is empty when nothing measured it', () => {
    expect(weakTrend([attemptWith({})], 'о>л')).toEqual([])
  })
})

describe('keyWindow', () => {
  const order = [...new Set([...layout.homeAnchors, ...layout.unlockOrder])].filter(
    (char) => char !== ' ',
  )

  it('starts from the home row a new learner already has', () => {
    const view = keyWindow(layout, [...layout.homeAnchors, ' '])
    expect(view.done.length).toBe(4)
    expect(view.current).toBe(layout.unlockOrder.find((c) => !layout.homeAnchors.includes(c)))
  })

  it('names the next closed key, the few opened before it and the few after', () => {
    const open = order.slice(0, 10)
    const view = keyWindow(layout, open)
    expect(view.current).toBe(order[10])
    expect(view.done).toEqual(order.slice(6, 10))
    expect(view.later).toEqual(order.slice(11, 13))
  })

  it('has no current key once everything is open', () => {
    const view = keyWindow(layout, order)
    expect(view.current).toBeUndefined()
    expect(view.later).toEqual([])
    expect(view.done).toEqual(order.slice(-4))
  })
})

describe('goalChart', () => {
  const week = (minutes: number[]) =>
    minutes.map((value, i) => ({
      date: `2026-09-${String(25 + i).padStart(2, '0')}`,
      minutes: value,
    }))

  it('keeps the goal line at the same height in an ordinary week', () => {
    const chart = goalChart(week([5, 10, 20, 0, 15, 8, 12]), 20)
    expect(chart.goalAt).toBeCloseTo(1 / 1.75)
    expect(chart.bars.at(-1)?.today).toBe(true)
    expect(chart.rest).toBeCloseTo(8 / 35)
  })

  it('rescales when a day went past the top, and owes nothing once the goal is met', () => {
    const chart = goalChart(week([70, 0, 0, 0, 0, 0, 25]), 20)
    expect(chart.bars[0]?.height).toBe(1)
    expect(chart.goalAt).toBeCloseTo(20 / 70)
    expect(chart.rest).toBe(0)
  })
})
