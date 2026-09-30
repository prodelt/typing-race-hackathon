import type { Progress } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { deriveProgress } from '../progress/derive'
import { makeAttempt, makeCatalogue, makeLayout } from '../progress/fixtures'
import { introductionLevel, levelFor, levels, passes } from './table'

function progressOf(spm: number): Progress {
  return deriveProgress({
    attempts: [makeAttempt({ spm })],
    layout: makeLayout(),
    catalogue: makeCatalogue(),
    startingLevelChoice: 'neverTouchTyped',
  })
}

describe('the level table', () => {
  it('carries the published accuracy floors, in order', () => {
    expect(levels.map((l) => l.accuracyFloor)).toEqual([0.95, 0.96, 0.97, 0.97, 0.98])
  })

  it('has unique ids and an Introduction band with no speed requirement (FR-040)', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length)
    expect(levels[0]).toBe(introductionLevel)
    expect(introductionLevel.spmBenchmark).toBeNull()
  })

  it('gives every later band a benchmark', () => {
    for (const level of levels.slice(1)) expect(level.spmBenchmark).not.toBeNull()
  })
})

describe('levelFor (FR-080)', () => {
  it('is Introduction for stage 1', () => {
    expect(levelFor(1, progressOf(100)).id).toBe('introduction')
  })

  it('does not move with speed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (spm) => {
        expect(levelFor(1, progressOf(spm)).accuracyFloor).toBe(0.95)
      }),
    )
  })
})

describe('passes', () => {
  it('accepts accuracy at the floor and above, rejects below', () => {
    expect(passes(0.95, introductionLevel)).toBe(true)
    expect(passes(19 / 20, introductionLevel)).toBe(true)
    expect(passes(1, introductionLevel)).toBe(true)
    expect(passes(0.9499, introductionLevel)).toBe(false)
  })
})
