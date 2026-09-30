import type { Progress } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { deriveProgress, MASTERY_STREAK } from '../progress/derive'
import { makeAttempt, makeCatalogue, makeLayout } from '../progress/fixtures'
import config from './levels.json'
import { introductionLevel, levelFor, levels, parseLevels, passes } from './table'

function progressOf(spm: number): Progress {
  return deriveProgress({
    attempts: [makeAttempt({ spm })],
    layout: makeLayout(),
    catalogue: makeCatalogue(),
    startingLevelChoice: 'neverTouchTyped',
  })
}

describe('the level table', () => {
  it('is exactly the requirements` table: names, SPM benchmarks and accuracy floors', () => {
    expect(
      levels.map((level) => [
        level.name.uk,
        level.name.en,
        level.spmBenchmark,
        level.accuracyFloor,
      ]),
    ).toEqual([
      ['Ознайомлення', 'Introduction', null, 0.95],
      ['Базовий', 'Basic', { min: 100, max: 150 }, 0.96],
      ['Впевнений', 'Confident', { min: 150, max: 225 }, 0.97],
      ['Робочий', 'Working', { min: 225, max: 300 }, 0.97],
      ['Швидкісний', 'Fast', { min: 300, max: null }, 0.98],
    ])
  })

  it('has unique ids, a goal in both languages, and an Introduction band with no benchmark', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length)
    expect(levels[0]).toBe(introductionLevel)
    expect(introductionLevel.spmBenchmark).toBeNull()
    for (const level of levels) {
      expect(level.goal.uk.length).toBeGreaterThan(0)
      expect(level.goal.en.length).toBeGreaterThan(0)
    }
  })

  it('has contiguous speed bands: each starts where the one before ends', () => {
    const bands = levels.slice(1).map((level) => level.spmBenchmark)
    for (let i = 1; i < bands.length; i++) expect(bands[i]?.min).toBe(bands[i - 1]?.max)
  })

  it('is read from the config file, so changing the file changes the table', () => {
    const edited = JSON.parse(JSON.stringify(config)) as typeof config
    const first = edited.levels[0]
    if (first) first.accuracyFloor = 0.9
    expect(parseLevels(edited)[0]?.accuracyFloor).toBe(0.9)
  })

  it('refuses a malformed config instead of inventing a floor', () => {
    expect(() => parseLevels({ levels: [] })).toThrow(/non-empty/)
    expect(() => parseLevels({ levels: [{ id: 'x', name: { uk: 'a', en: 'b' } }] })).toThrow(
      /accuracyFloor/,
    )
    const inverted = JSON.parse(JSON.stringify(config)) as typeof config
    const basic = inverted.levels[1]
    if (basic?.spm) basic.spm.max = 50
    expect(() => parseLevels(inverted)).toThrow(/below/)
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

describe('the Mastery Rule: three consecutive test attempts at or above the floor', () => {
  const master = (attempts: { accuracy: number; spm: number; mode?: 'test' | 'practice' }[]) =>
    deriveProgress({
      attempts: attempts.map((a, i) =>
        makeAttempt({ scaleId: 'sc-d', completedAt: 1000 + i, mode: a.mode ?? 'test', ...a }),
      ),
      layout: makeLayout(),
      catalogue: makeCatalogue(),
      startingLevelChoice: 'neverTouchTyped',
    }).completedScales.includes('sc-d')

  it('is met by three accurate attempts in a row, however slow', () => {
    expect(MASTERY_STREAK).toBe(3)
    expect(master([0.95, 0.97, 1].map((accuracy) => ({ accuracy, spm: 20 })))).toBe(true)
  })

  it('is never met by a fast but inaccurate streak, at any speed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            accuracy: fc.double({ min: 0, max: 0.9499, noNaN: true }),
            spm: fc.integer({ min: 300, max: 2000 }),
          }),
          { minLength: 3, maxLength: 12 },
        ),
        (streak) => {
          expect(master(streak)).toBe(false)
        },
      ),
    )
  })

  it('restarts the count after one attempt below the floor', () => {
    const run = [0.98, 0.98, 0.9, 0.98, 0.98].map((accuracy) => ({ accuracy, spm: 400 }))
    expect(master(run)).toBe(false)
    expect(master([...run, { accuracy: 0.98, spm: 400 }])).toBe(true)
  })

  it('never counts practice attempts', () => {
    const practice = [1, 1, 1].map((accuracy) => ({
      accuracy,
      spm: 200,
      mode: 'practice' as const,
    }))
    expect(master(practice)).toBe(false)
  })
})
