import type { Attempt, AttemptSummary, StartingLevelChoice } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { deriveProgress } from './derive'
import {
  fakeConfidence,
  makeAttempt,
  makeCatalogue,
  makeLayout,
  toSummary,
  transitionAggregates,
} from './fixtures'
import { retentionPlan } from './retention'
import { boundaryFor } from './starting-level'

const layout = makeLayout()
const catalogue = makeCatalogue()

function derive(
  attempts: readonly AttemptSummary[],
  choice: StartingLevelChoice = 'neverTouchTyped',
) {
  return deriveProgress({
    attempts,
    layout,
    catalogue,
    startingLevelChoice: choice,
  })
}

/** Three consecutive passing Test attempts on one scale, starting at `from` ms. */
function mastery(scaleId: string, from: number): Attempt[] {
  return [0, 1, 2].map((i) => makeAttempt({ scaleId, completedAt: from + i, accuracy: 0.97 }))
}

describe('the Mastery Rule (FR-039)', () => {
  it('counts consecutive passing Test attempts per scale', () => {
    const progress = derive([
      makeAttempt({ completedAt: 1, accuracy: 0.96 }),
      makeAttempt({ completedAt: 2, accuracy: 0.95 }),
    ])
    expect(progress.consecutivePasses).toEqual({ 'sc-d': 2 })
    expect(progress.completedScales).toEqual([])
    expect(progress.unlockedSet).toEqual(['a', 's', ' '])
  })

  it('is satisfied by three passes, which complete the scale and unlock its key', () => {
    const progress = derive(mastery('sc-d', 10))
    expect(progress.consecutivePasses).toEqual({ 'sc-d': 3 })
    expect(progress.completedScales).toEqual(['sc-d'])
    expect(progress.unlockedSet).toEqual(['a', 's', ' ', 'd'])
  })

  it('resets the count on a failing attempt', () => {
    const progress = derive([
      makeAttempt({ completedAt: 1 }),
      makeAttempt({ completedAt: 2 }),
      makeAttempt({ completedAt: 3, accuracy: 0.94 }),
      makeAttempt({ completedAt: 4 }),
    ])
    expect(progress.consecutivePasses).toEqual({ 'sc-d': 1 })
    expect(progress.unlockedSet).not.toContain('d')
  })

  it('ignores a Practice attempt: it neither advances nor resets', () => {
    const progress = derive([
      makeAttempt({ completedAt: 1 }),
      makeAttempt({ completedAt: 2, mode: 'practice', accuracy: 0 }),
      makeAttempt({ completedAt: 3 }),
      makeAttempt({ completedAt: 4, mode: 'practice' }),
      makeAttempt({ completedAt: 5 }),
    ])
    expect(progress.consecutivePasses).toEqual({ 'sc-d': 3 })
    expect(progress.unlockedSet).toContain('d')
  })

  it('keeps a scale complete after a later failure', () => {
    const progress = derive([...mastery('sc-d', 1), makeAttempt({ completedAt: 9, accuracy: 0.5 })])
    expect(progress.completedScales).toEqual(['sc-d'])
    expect(progress.consecutivePasses['sc-d']).toBe(0)
    expect(progress.unlockedSet).toContain('d')
  })

  it('does not count attempts on another layout (FR-051)', () => {
    const progress = derive(mastery('sc-d', 1).map((a) => toSummary({ ...a, layoutId: 'qwerty' })))
    expect(progress.history).toEqual([])
    expect(progress.consecutivePasses).toEqual({})
    expect(progress.language).toBe('uk')
  })
})

describe('the unlock rule (FR-041, FR-042)', () => {
  it('unlocks a key in unlock order, one mastery at a time', () => {
    const progress = derive([...mastery('sc-d', 1), ...mastery('sc-f', 10)])
    expect(progress.unlockedSet).toEqual(['a', 's', ' ', 'd', 'f'])
  })

  it('does not unlock a key ahead of the boundary from mastering its scale alone', () => {
    const progress = derive(mastery('sc-g', 1))
    expect(progress.completedScales).toEqual(['sc-g'])
    expect(progress.unlockedSet).toEqual(['a', 's', ' '])
  })

  it('bridges to an already-mastered scale once the gap is filled', () => {
    const progress = derive([...mastery('sc-g', 1), ...mastery('sc-d', 10), ...mastery('sc-f', 20)])
    expect(progress.unlockedSet).toEqual(['a', 's', ' ', 'd', 'f', 'g'])
  })

  it('does not unlock anything from a Transition scale or an unknown scale', () => {
    const progress = derive([...mastery('sc-fg', 1), ...mastery('ghost', 10)])
    expect(progress.completedScales).toEqual(['sc-fg', 'ghost'])
    expect(progress.unlockedSet).toEqual(['a', 's', ' '])
  })

  it('stops at the end of the unlock order', () => {
    const attempts = ['sc-d', 'sc-f', 'sc-g', 'sc-h'].flatMap((id, i) => mastery(id, i * 10 + 1))
    expect(derive(attempts).unlockedSet).toEqual(['a', 's', ' ', 'd', 'f', 'g', 'h'])
  })
})

describe('the starting-level choice (FR-048, FR-073)', () => {
  it('opens nothing beyond the anchors for a learner who never touch-typed', () => {
    expect(derive([], 'neverTouchTyped').unlockedSet).toEqual(['a', 's', ' '])
  })

  it('opens the home-row run for a learner who knows the home row', () => {
    expect(derive([], 'knowsHomeRow').unlockedSet).toEqual(['a', 's', ' ', 'd', 'f', 'g'])
  })

  it('opens everything up to the last letter for a learner wanting accuracy', () => {
    expect(derive([], 'touchTypesWantsAccuracy').unlockedSet).toEqual([
      'a',
      's',
      ' ',
      'd',
      'f',
      'g',
      'h',
    ])
  })

  it('stops at the end of the unlock order when every key is on the home row', () => {
    const allHome = { ...layout, unlockOrder: ['d', 'f', 'g'] }
    expect(boundaryFor(allHome, 'knowsHomeRow')).toBe(3)
  })

  it('ignores characters the layout does not know when finding the last letter', () => {
    const odd = { ...layout, unlockOrder: ['d', 'z', 'q'] }
    expect(boundaryFor(odd, 'touchTypesWantsAccuracy')).toBe(1)
    expect(boundaryFor(odd, 'knowsHomeRow')).toBe(1)
  })

  it('carries on from the boundary when a scale beyond it is mastered', () => {
    const progress = derive(mastery('sc-h', 1), 'knowsHomeRow')
    expect(progress.unlockedSet).toEqual(['a', 's', ' ', 'd', 'f', 'g', 'h'])
    expect(progress.startingLevelChoice).toBe('knowsHomeRow')
  })

  it('never moves backward: a lower choice keeps what was earned', () => {
    const attempts = [...mastery('sc-d', 1), ...mastery('sc-f', 10), ...mastery('sc-g', 20)]
    const before = derive(attempts, 'knowsHomeRow').unlockedSet
    const after = derive(attempts, 'neverTouchTyped').unlockedSet
    expect(after).toEqual(before)
  })

  it('is forward-only across every pair of choices', () => {
    const choices: StartingLevelChoice[] = [
      'neverTouchTyped',
      'knowsHomeRow',
      'touchTypesWantsAccuracy',
    ]
    const attempts = [...mastery('sc-d', 1), ...mastery('sc-f', 10)]
    for (const low of choices) {
      for (const high of choices) {
        const lowSet = derive(attempts, low).unlockedSet
        const highSet = derive(attempts, high).unlockedSet
        if (choices.indexOf(high) >= choices.indexOf(low)) {
          expect(highSet.length).toBeGreaterThanOrEqual(lowSet.length)
        }
      }
    }
  })
})

describe('Stage 1 completion (FR-044)', () => {
  const allScales = catalogue.flatMap((s, i) => mastery(s.id, i * 10 + 1))

  it('is complete when every scale is done and the last five attempts average 96%', () => {
    expect(derive(allScales.map(toSummary)).stage).toEqual({
      current: 1,
      stage1Complete: true,
    })
  })

  it('is not complete when accuracy over the last five is below 96%', () => {
    const tail = [1, 2, 3].map((i) => makeAttempt({ completedAt: 1000 + i, accuracy: 0.9 }))
    expect(derive([...allScales, ...tail]).stage.stage1Complete).toBe(false)
  })

  it('is not complete while a scale is unfinished', () => {
    const missing = catalogue.slice(1).flatMap((s, i) => mastery(s.id, i * 10 + 1))
    expect(derive(missing).stage.stage1Complete).toBe(false)
  })

  it('needs five attempts to average over', () => {
    const tiny = deriveProgress({
      attempts: mastery('sc-d', 1),
      layout,
      catalogue: catalogue.slice(0, 1),
      startingLevelChoice: 'neverTouchTyped',
    })
    expect(tiny.completedScales).toEqual(['sc-d'])
    expect(tiny.history).toHaveLength(3)
    expect(tiny.stage.stage1Complete).toBe(false)
  })

  it('is never complete with an empty catalogue', () => {
    const progress = deriveProgress({
      attempts: allScales,
      layout,
      catalogue: [],
      startingLevelChoice: 'neverTouchTyped',
    })
    expect(progress.stage.stage1Complete).toBe(false)
  })

  it('reports an empty history as incomplete', () => {
    expect(derive([]).stage.stage1Complete).toBe(false)
    expect(derive([]).derivedVersion).toBe(1)
  })
})

describe('confidence', () => {
  it('is read through the injected port, undefined below five observations', () => {
    const attempts = [
      makeAttempt({
        completedAt: 1,
        aggregates: transitionAggregates('f', 'g', 3),
      }),
      makeAttempt({
        completedAt: 2,
        aggregates: transitionAggregates('f', 'g', 1),
      }),
      makeAttempt({
        completedAt: 3,
        aggregates: transitionAggregates('g', 'f', 6, 3),
      }),
    ]
    const progress = deriveProgress({
      attempts,
      layout,
      catalogue,
      startingLevelChoice: 'neverTouchTyped',
      confidence: fakeConfidence,
    })
    expect(progress.transitionConfidence).toEqual({
      'f>g': undefined,
      'g>f': 0.5,
    })
    expect(progress.keyConfidence).toEqual({})
  })

  it('carries keys too', () => {
    const progress = deriveProgress({
      attempts: [
        makeAttempt({
          aggregates: {
            keys: { d: { count: 5, misses: 0, sumIki: 1, sumIkiSq: 1 } },
            transitions: {},
          },
        }),
      ],
      layout,
      catalogue,
      startingLevelChoice: 'neverTouchTyped',
      confidence: fakeConfidence,
    })
    expect(progress.keyConfidence).toEqual({ d: 1 })
  })

  it('comes back empty without a port', () => {
    const progress = derive([makeAttempt()])
    expect(progress.keyConfidence).toEqual({})
    expect(progress.transitionConfidence).toEqual({})
  })
})

describe('purity (FR-050)', () => {
  it('sorts defensively: arrival order does not matter', () => {
    const attempts = [
      ...mastery('sc-d', 1),
      makeAttempt({ completedAt: 10, accuracy: 0.1 }),
      ...mastery('sc-f', 20),
    ].map(toSummary)
    expect(derive([...attempts].reverse())).toEqual(derive(attempts))
  })

  it('breaks a completedAt tie by id', () => {
    const a = toSummary(makeAttempt({ id: 'a', completedAt: 5, accuracy: 0.5 }))
    const b = toSummary(makeAttempt({ id: 'b', completedAt: 5, accuracy: 1 }))
    const c = toSummary(makeAttempt({ id: 'c', completedAt: 5, accuracy: 1 }))
    expect(derive([c, a, b])).toEqual(derive([b, c, a]))
    expect(derive([b, a]).history.map((x) => x.id)).toEqual(['a', 'b'])
    expect(derive([a, a]).history).toHaveLength(2)
  })

  const attemptArb = fc.record({
    scale: fc.constantFrom('sc-d', 'sc-f', 'sc-g', 'sc-h', 'sc-fg', 'ghost'),
    mode: fc.constantFrom<'practice' | 'test'>('practice', 'test'),
    accuracy: fc.double({ min: 0.8, max: 1, noNaN: true }),
    spm: fc.integer({ min: 0, max: 900 }),
  })
  const historyArb = fc.array(attemptArb, { maxLength: 40 }).map((items) =>
    items.map((item, i) =>
      toSummary(
        makeAttempt({
          id: `p${i}`,
          scaleId: item.scale,
          mode: item.mode,
          accuracy: item.accuracy,
          spm: item.spm,
          completedAt: i + 1,
        }),
      ),
    ),
  )

  it('is a pure function of its ordered input', () => {
    fc.assert(
      fc.property(
        historyArb,
        fc.constantFrom<StartingLevelChoice>('neverTouchTyped', 'knowsHomeRow'),
        (h, c) => {
          expect(derive(h, c)).toEqual(derive(JSON.parse(JSON.stringify(h)), c))
        },
      ),
    )
  })

  it('always yields an unlocked set that is anchors, space and a prefix of the unlock order', () => {
    fc.assert(
      fc.property(historyArb, (h) => {
        const { unlockedSet } = derive(h)
        const earned = unlockedSet.slice(3)
        expect(unlockedSet.slice(0, 3)).toEqual(['a', 's', ' '])
        expect(earned).toEqual(layout.unlockOrder.slice(0, earned.length))
      }),
    )
  })

  it('never unlocks a key without three consecutive passes, however fast (SC-009, FR-040)', () => {
    fc.assert(
      fc.property(historyArb, (h) => {
        const { unlockedSet } = derive(h)
        for (const char of unlockedSet.slice(3)) {
          const scaleId = catalogue.find(
            (s) => s.focus.kind === 'key' && s.focus.value === char,
          )?.id
          let streak = 0
          let best = 0
          for (const attempt of h.filter((a) => a.scaleId === scaleId && a.mode === 'test')) {
            streak = attempt.metrics.accuracy >= 0.95 ? streak + 1 : 0
            best = Math.max(best, streak)
          }
          expect(best).toBeGreaterThanOrEqual(3)
        }
      }),
    )
  })

  it('is indifferent to speed: rewriting every spm changes nothing', () => {
    fc.assert(
      fc.property(historyArb, fc.integer({ min: 0, max: 5000 }), (h, spm) => {
        const rewritten = h.map((a) => ({
          ...a,
          metrics: { ...a.metrics, spm, wpm: spm / 5 },
        }))
        // `history` legitimately echoes each attempt's own spm; everything *derived* must not move.
        const { history: _a, ...fast } = derive(rewritten)
        const { history: _b, ...original } = derive(h)
        expect(fast).toEqual(original)
      }),
    )
  })
})

describe('retention (FR-081, SC-019)', () => {
  it('names the 20 most recent attempts, oldest first', () => {
    const attempts = Array.from({ length: 25 }, (_, i) =>
      toSummary(makeAttempt({ id: `r${i}`, completedAt: i + 1 })),
    )
    const { keepLogsFor } = retentionPlan([...attempts].reverse())
    expect(keepLogsFor).toHaveLength(20)
    expect(keepLogsFor[0]).toBe('r5')
    expect(keepLogsFor[19]).toBe('r24')
  })

  it('keeps everything when there are 20 or fewer', () => {
    const attempts = [1, 2, 3].map((i) => toSummary(makeAttempt({ id: `s${i}`, completedAt: i })))
    expect(retentionPlan(attempts).keepLogsFor).toEqual(['s1', 's2', 's3'])
    expect(retentionPlan([]).keepLogsFor).toEqual([])
  })

  it('pruning logs changes nothing deriveProgress returns', () => {
    const full: Attempt[] = [
      ...catalogue.flatMap((s, i) => mastery(s.id, i * 10 + 1)),
      ...Array.from({ length: 10 }, (_, i) =>
        makeAttempt({
          completedAt: 500 + i,
          aggregates: transitionAggregates('f', 'g', 6, 2),
          accuracy: 0.98,
        }),
      ),
    ]
    const run = (attempts: readonly Attempt[]) =>
      deriveProgress({
        attempts,
        layout,
        catalogue,
        startingLevelChoice: 'knowsHomeRow',
        confidence: fakeConfidence,
      })
    const keep = new Set(retentionPlan(full).keepLogsFor)
    const pruned = full.map((a) => (keep.has(a.id) ? a : { ...a, log: null }))
    expect(pruned.filter((a) => a.log === null).length).toBeGreaterThan(0)
    expect(run(pruned)).toEqual(run(full))
  })
})
