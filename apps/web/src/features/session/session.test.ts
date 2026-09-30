import { catalogue, layouts } from '@typing-race/curriculum'
import type { NextAction, Progress } from '@typing-race/domain'
import { transitionKey } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { composeSession } from './compose.js'
import { MAX_MINUTES, MIN_MINUTES, sizeSession } from './sizing.js'

describe('sizeSession', () => {
  it('always lands a full run between 15 and 25 minutes at any realistic speed (FR-077)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 900 }),
        fc.integer({ min: 30, max: 90 }),
        (spm, size) => {
          const { reps, expectedMinutes } = sizeSession({ spm, scaleSize: size })
          expect(expectedMinutes).toBeGreaterThanOrEqual(MIN_MINUTES)
          expect(expectedMinutes).toBeLessThanOrEqual(MAX_MINUTES)
          for (const count of reps) expect(count).toBeGreaterThanOrEqual(1)
        },
      ),
    )
  })

  it('falls back to a default speed with no history', () => {
    expect(sizeSession({ spm: null, scaleSize: 60 }).expectedMinutes).toBeGreaterThanOrEqual(15)
  })
})

const layout = layouts.yq
const scales = catalogue.yq
const anchors = layout.homeAnchors

function progressWith(confidence: Record<string, number | undefined>): Progress {
  return {
    derivedVersion: 1,
    language: 'uk',
    unlockedSet: [...anchors, ' '],
    consecutivePasses: {},
    completedScales: [],
    keyConfidence: {},
    transitionConfidence: confidence,
    stage: { current: 1, stage1Complete: false },
    startingLevelChoice: 'neverTouchTyped',
    history: [],
  }
}

const target = scales[0]
if (target === undefined) throw new Error('catalogue is empty')
const action: NextAction = {
  rule: 'nextKey',
  template: 'next_key',
  values: {},
  startsScaleId: target.id,
}

describe('composeSession', () => {
  it('falls back to the target skill when there is no weak Transition, never skipping the warm-up', () => {
    const plan = composeSession({
      layout,
      catalogue: scales,
      progress: progressWith({}),
      nextAction: action,
      attempts: [],
    })
    expect(plan?.blocks).toHaveLength(3)
    expect(plan?.blocks[0].scaleId).toBe(target.id)
    expect(plan?.blocks[0].fallback).toBe(true)
  })

  it('builds the warm-up around the weakest Transition when one is known', () => {
    const first = anchors[0]
    const second = anchors[1]
    if (first === undefined || second === undefined) throw new Error('anchors missing')
    const plan = composeSession({
      layout,
      catalogue: scales,
      progress: progressWith({ [transitionKey(first, second)]: 0.3 }),
      nextAction: action,
      attempts: [],
    })
    expect(plan?.blocks[0].fallback).toBe(false)
    expect(plan?.blocks[0].focus.value).toBe(first)
    expect(plan?.blocks[1].scaleId).toBe(target.id)
  })

  it('keeps consolidation as test attempts, so it counts toward mastery without a guide', () => {
    const plan = composeSession({
      layout,
      catalogue: scales,
      progress: progressWith({}),
      nextAction: action,
      attempts: [],
    })
    expect(plan?.blocks.map((block) => block.mode)).toEqual(['practice', 'practice', 'test'])
  })
})
