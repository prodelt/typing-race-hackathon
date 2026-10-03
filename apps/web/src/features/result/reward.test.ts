import { layouts, MASTERY_STREAK, XP_PER_PASS } from '@typing-race/curriculum'
import type { AttemptSummary, Progress } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { totalKeyCount } from '../path/model'
import { rewardFor } from './reward'

const layout = layouts.yq
const SCALE = 'yq.run.anchors'

let n = 0
function attempt(over: {
  mode?: AttemptSummary['mode']
  accuracy?: number
  scaleId?: string
  ikis?: Record<string, number>
}): AttemptSummary {
  n++
  return {
    id: `a${n}`,
    scaleId: over.scaleId ?? SCALE,
    layoutId: 'yq',
    mode: over.mode ?? 'test',
    metrics: { accuracy: over.accuracy ?? 0.98, meanIkiByTransition: over.ikis ?? {} },
  } as unknown as AttemptSummary
}

function after(passes: number): Progress {
  return {
    unlockedSet: [...layout.homeAnchors, ' '],
    consecutivePasses: { [SCALE]: passes },
  } as unknown as Progress
}

describe('rewardFor', () => {
  it('counts a passing test into the streak, with this attempt as the newest slot', () => {
    const first = attempt({})
    const now = attempt({ accuracy: 0.97 })
    const reward = rewardFor({ earlier: [first], attempt: now, after: after(2), layout })
    expect(reward.passed).toBe(true)
    expect(reward.streak).toBe(2)
    expect(reward.target).toBe(MASTERY_STREAK)
    expect(reward.slots.map((slot) => [slot.id, slot.current])).toEqual([
      [first.id, false],
      [now.id, true],
    ])
    expect(reward.xp).toBe(XP_PER_PASS)
  })

  it('gives a practice attempt no pass, no slots and no XP', () => {
    const reward = rewardFor({
      earlier: [],
      attempt: attempt({ mode: 'practice' }),
      after: after(0),
      layout,
    })
    expect(reward.passed).toBe(false)
    expect(reward.slots).toEqual([])
    expect(reward.xp).toBe(0)
  })

  it('does not count a test below the floor', () => {
    const reward = rewardFor({
      earlier: [],
      attempt: attempt({ accuracy: 0.8 }),
      after: after(0),
      layout,
    })
    expect(reward.passed).toBe(false)
    expect(reward.streak).toBe(0)
  })

  it('names the next key to open and the slowest move of the attempt', () => {
    const reward = rewardFor({
      earlier: [],
      attempt: attempt({ ikis: { 'а>о': 430, 'о>а': 250 } }),
      after: after(1),
      layout,
    })
    expect(reward.nextKey).toBe(layout.unlockOrder.find((c) => !layout.homeAnchors.includes(c)))
    expect(reward.keysOpen).toBe(layout.homeAnchors.length)
    expect(reward.weakest).toEqual({ element: 'а>о', meanIkiMs: 430 })
  })

  it('counts the keys of the route as the Home screen does, so the two never disagree', () => {
    for (const language of [layouts.yq, layouts.qwerty]) {
      const reward = rewardFor({
        earlier: [],
        attempt: attempt({}),
        after: after(1),
        layout: language,
      })
      expect(reward.keysTotal, language.id).toBe(totalKeyCount(language))
    }
  })
})
