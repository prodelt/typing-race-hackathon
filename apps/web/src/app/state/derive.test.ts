import { catalogue, layouts } from '@typing-race/curriculum'
import type { AttemptSummary } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { derive } from './derive.js'
import { initialState } from './reduce.js'

const firstKeyScale = catalogue.yq.find(
  (scale) => scale.focus.kind === 'key' && scale.focus.value === layouts.yq.unlockOrder[0],
)
if (firstKeyScale === undefined) throw new Error('the yq catalogue has no scale for its first key')

function attempt(id: string, scaleId: string): AttemptSummary {
  return {
    id,
    scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: 1_000,
    completedAt: 61_000,
    elapsedMs: 60_000,
    metrics: {
      spm: 120,
      wpm: 24,
      accuracy: 1,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: { keys: {}, transitions: {} },
  }
}

describe('derive', () => {
  it('folds progress, confidence and weak spots without free practice', () => {
    const state = {
      ...initialState,
      startingLevelChoice: 'neverTouchTyped' as const,
      attempts: [
        attempt('scale', firstKeyScale.id),
        attempt('daily', 'yq.daily'),
        attempt('own', 'yq.owntext'),
      ],
    }
    const { progress } = derive(state)
    expect(progress?.history.map((a) => a.id)).toEqual(['scale'])
  })

  it('never hands the coach a free-practice attempt as the last one', () => {
    const state = {
      ...initialState,
      startingLevelChoice: 'neverTouchTyped' as const,
      attempts: [attempt('scale', firstKeyScale.id), attempt('own', 'yq.owntext')],
    }
    const withOwn = derive(state).nextAction
    const without = derive({ ...state, attempts: state.attempts.slice(0, 1) }).nextAction
    expect(withOwn).toEqual(without)
  })
})
