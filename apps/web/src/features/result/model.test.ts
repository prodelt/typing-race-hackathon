import type { AttemptSummary, ImplausibleReason } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { buildResultModel } from './model'

let n = 0
function attempt(over: {
  spm: number
  accuracy: number
  implausible?: ImplausibleReason
}): AttemptSummary {
  n++
  return {
    id: `a${n}`,
    scaleId: 'yq.run.anchors',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: n * 1000 - 500,
    completedAt: n * 1000,
    elapsedMs: 500,
    metrics: {
      spm: over.spm,
      wpm: over.spm / 5,
      accuracy: over.accuracy,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
      ...(over.implausible === undefined ? {} : { implausible: over.implausible }),
    },
    aggregates: { keys: {}, transitions: {} },
  }
}

describe('buildResultModel', () => {
  it('never takes an attempt that was not typed by hand as the personal best', () => {
    // The audit's case: a script typed the line at 4 264 SPM, 100% accurate, and it became the
    // record every later honest attempt was compared against.
    const honest = attempt({ spm: 180, accuracy: 0.97 })
    const script = attempt({ spm: 4264, accuracy: 1, implausible: 'burst' })
    const now = attempt({ spm: 190, accuracy: 0.96 })
    const model = buildResultModel({
      attempts: [honest, script, now],
      attemptId: now.id,
      startingLevelChoice: 'neverTouchTyped',
    })
    expect(model?.previousBest?.id).toBe(honest.id)
  })

  it('celebrates nothing on an attempt that was not typed by hand', () => {
    const passes = [attempt({ spm: 180, accuracy: 1 }), attempt({ spm: 180, accuracy: 1 })]
    const script = attempt({ spm: 9949, accuracy: 1, implausible: 'burst' })
    const model = buildResultModel({
      attempts: [...passes, script],
      attemptId: script.id,
      startingLevelChoice: 'neverTouchTyped',
    })
    expect(model?.reward.implausible).toBe('burst')
    expect(model?.reward.xp).toBe(0)
    expect(model?.reward.passed).toBe(false)
    expect(model?.unlock).toBeNull()
  })
})
