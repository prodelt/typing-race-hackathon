import type { AttemptAggregates, ElementStats, Layout, Progress } from '@typing-race/domain'
import { parseTransitionKey, transitionKey } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import ukAcademy from '../../../../data/curriculum/uk/academy.json'
import ukWords from '../../../../data/derived/uk/words.json'
import { parseAcademyCourse } from '../academy/course'
import { layouts } from '../layout'
import { deriveProgress } from '../progress/derive'
import { makeAttempt } from '../progress/fixtures'
import { catalogue } from '../scales/catalogue'
import { seededRandom } from '../scales/seeded-random'
import { REQUIREMENTS_UNMET } from '../scales/types'
import { isTypable } from '../stage2/select'
import { parseWordBank } from '../words/bank'
import { buildReviewDrill, parseReviewDrillId, reviewDrillId } from './drill'
import { realTextBlock } from './real-text'
import { compareSpot, rankWeakSpots } from './weak-spots'

const layout = layouts.yq
const bank = parseWordBank(ukWords)
const course = parseAcademyCourse(ukAcademy)

/** The unlocked set of a learner who has earned the first `k` keys of the Unlock Order. */
function unlockedAt(l: Layout, k: number): string[] {
  return [...l.homeAnchors, ' ', ...l.unlockOrder.slice(0, k)]
}

function stats(count: number, misses: number, ikiMs: number): ElementStats {
  const hits = count - misses
  return { count, misses, sumIki: hits * ikiMs, sumIkiSq: hits * ikiMs * ikiMs }
}

function progressFrom(aggregates: AttemptAggregates[]): Progress {
  return deriveProgress({
    attempts: aggregates.map((a) => makeAttempt({ mode: 'practice', aggregates: a })),
    layout,
    catalogue: catalogue.yq,
    startingLevelChoice: 'neverTouchTyped',
  })
}

describe('weak-spot ranking', () => {
  it('at equal speed, the key missed more often ranks first', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 80 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 400, max: 900 }),
        fc.boolean(),
        (count, fewer, extra, iki, swap) => {
          const [worse, better] = swap ? ['о', 'л'] : ['л', 'о']
          const progress = progressFrom([
            {
              keys: {
                [worse]: stats(count, fewer + extra, iki),
                [better]: stats(count, fewer, iki),
              },
              transitions: {},
            },
          ])
          const ranked = rankWeakSpots(progress, layout).map((s) => s.element)
          expect(ranked).toContain(worse)
          if (ranked.includes(better)) {
            expect(ranked.indexOf(worse)).toBeLessThan(ranked.indexOf(better))
          }
        },
      ),
    )
  })

  it('at equal accuracy, the slower transition ranks first', () => {
    const progress = progressFrom([
      {
        keys: {},
        transitions: {
          [transitionKey('о', 'л')]: stats(20, 1, 450),
          [transitionKey('в', 'а')]: stats(20, 1, 600),
        },
      },
    ])
    expect(rankWeakSpots(progress, layout).map((s) => s.element)).toEqual(['в>а', 'о>л'])
  })

  it('names nothing measured fewer than five times, and nothing locked', () => {
    const progress = progressFrom([
      {
        // щ is far down the Unlock Order: locked for a learner who never touch-typed.
        keys: { о: stats(4, 3, 900), щ: stats(30, 20, 900) },
        transitions: { [transitionKey('щ', 'о')]: stats(30, 20, 900) },
      },
    ])
    expect(rankWeakSpots(progress, layout)).toEqual([])
  })

  it('reports the numbers it ranked on', () => {
    const progress = progressFrom([
      { keys: {}, transitions: { [transitionKey('о', 'л')]: stats(50, 7, 310) } },
    ])
    const [spot] = rankWeakSpots(progress, layout)
    expect(spot?.errorRate).toBeCloseTo(0.14)
    expect(spot?.meanIkiMs).toBeCloseTo(310)
  })
})

describe('the weak-spot drill', () => {
  /** Spots built only from what the learner can type: keys and pairs of open characters. */
  const spotsFor = (open: readonly string[]) => {
    const chars = open.filter((c) => c !== ' ')
    return fc.array(
      fc.oneof(
        fc.constantFrom(...chars),
        fc
          .tuple(fc.constantFrom(...open), fc.constantFrom(...chars))
          .filter(([a, b]) => a !== b)
          .map(([a, b]) => transitionKey(a, b)),
      ),
      { minLength: 1, maxLength: 4 },
    )
  }

  it('never contains a locked character, in moves or in words', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: layout.unlockOrder.length }).chain((k) => {
          const open = unlockedAt(layout, k)
          return fc.tuple(fc.constant(open), spotsFor(open), fc.boolean(), fc.integer())
        }),
        ([open, elements, withBank, seed]) => {
          const drill = buildReviewDrill({
            layout,
            unlocked: open,
            elements,
            bank: withBank ? bank : null,
            random: seededRandom(seed),
          })
          if (drill === REQUIREMENTS_UNMET) return
          const openSet = new Set(open)
          for (const char of drill.text) {
            expect(
              char === ' ' || isTypable(layout, openSet, char),
              `${char} in ${drill.text}`,
            ).toBe(true)
          }
          // Every spot it claims to train is in the text.
          for (const element of drill.covered) {
            const pair = parseTransitionKey(element)
            expect(drill.text).toContain(pair === undefined ? element : pair.from + pair.to)
          }
        },
      ),
      { numRuns: 150 },
    )
  }, 30_000)

  it('is made of moves before Stage 2 and of real words after', () => {
    const early = buildReviewDrill({
      layout,
      unlocked: unlockedAt(layout, 0),
      elements: ['о>л'],
      bank,
      random: seededRandom(1),
    })
    expect(early !== REQUIREMENTS_UNMET && early.mode).toBe('moves')

    const late = buildReviewDrill({
      layout,
      unlocked: unlockedAt(layout, layout.unlockOrder.length),
      elements: ['о>л', 'р'],
      bank,
      random: seededRandom(1),
    })
    expect(late !== REQUIREMENTS_UNMET && late.mode).toBe('words')
    const words = late === REQUIREMENTS_UNMET ? [] : late.text.split(' ')
    const known = new Set(bank.words.map((w) => w.word))
    for (const word of words) expect(known.has(word), word).toBe(true)
  })

  it('its id names its spots and reads back the same', () => {
    const elements = ['о>л', 'а', 'в> ', 'Ф>і']
    const id = reviewDrillId(layout, elements)
    expect(id).toBeDefined()
    expect(parseReviewDrillId(layout, id ?? '')).toEqual(elements)
  })
})

describe('the real-text block', () => {
  it('never contains a locked character before Stage 1 is complete', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: layout.unlockOrder.length }),
        fc.integer(),
        (k, seed) => {
          const open = unlockedAt(layout, k)
          const block = realTextBlock({
            layout,
            unlocked: open,
            stage1Complete: false,
            course,
            bank,
            random: seededRandom(seed),
          })
          if (block === null) return
          const openSet = new Set(open)
          for (const char of block.text) {
            expect(isTypable(layout, openSet, char), `${char} in ${block.kind}`).toBe(true)
          }
        },
      ),
      { numRuns: 60 },
    )
  }, 30_000)

  it('is real words from open keys early on, and sentences once every key is open', () => {
    const early = realTextBlock({
      layout,
      unlocked: unlockedAt(layout, 0),
      stage1Complete: false,
      course,
      bank,
      random: seededRandom(3),
    })
    expect(early?.kind).toBe('words')

    const full = realTextBlock({
      layout,
      unlocked: unlockedAt(layout, layout.unlockOrder.length),
      stage1Complete: true,
      course,
      bank,
      random: seededRandom(3),
    })
    expect(full?.kind).toBe('sentences')
    expect(full?.text).toMatch(/[.!?]$/)
  })

  it('offers the closest sentences, naming what is locked, only after Stage 1', () => {
    const open = unlockedAt(layout, 6)
    const args = { layout, unlocked: open, course, bank, random: seededRandom(5) }
    expect(realTextBlock({ ...args, stage1Complete: false })?.kind).toBe('words')
    const closest = realTextBlock({ ...args, stage1Complete: true })
    expect(closest?.kind).toBe('closest')
    expect(closest?.locked.length).toBeGreaterThan(0)
  })
})

describe('whether a spot improved', () => {
  const s = (count: number, misses: number, ms: number | null) => ({
    count,
    misses,
    errorRate: misses / count,
    meanIkiMs: ms,
  })

  it('reads accuracy first and speed second', () => {
    expect(compareSpot(s(50, 7, 310), s(20, 0, 330))).toBe('better')
    expect(compareSpot(s(50, 1, 310), s(20, 3, 250))).toBe('worse')
    expect(compareSpot(s(50, 1, 400), s(50, 1, 300))).toBe('better')
    expect(compareSpot(s(50, 1, 300), s(50, 1, 305))).toBe('same')
    expect(compareSpot(s(50, 1, 300), { count: 0, misses: 0, errorRate: 0, meanIkiMs: null })).toBe(
      'same',
    )
  })
})
