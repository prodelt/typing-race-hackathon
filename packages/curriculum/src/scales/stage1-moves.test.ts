import type { Layout, Scale } from '@typing-race/domain'
import { transitionKey } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { initialUnlockedSet, keyOf, layouts, SHIFT_TOKEN } from '../layout'
import { deriveProgress } from '../progress/derive'
import { fakeConfidence, makeAttempt, transitionAggregates } from '../progress/fixtures'
import { catalogue } from './catalogue'
import { generateText } from './generate'
import { generators, paceAt, SPACE, tempoPlan } from './generators'
import { seededRandom } from './seeded-random'
import { scaleById, transitionScale, transitionScales } from './transitions'
import { REQUIREMENTS_UNMET } from './types'

/**
 * The Stage 1 moves added to close the requirements' list: the space bar on its own, the
 * home → top → bottom chain, the stepped tempo, and a drill for any one Transition. Each is checked
 * for the three things that would embarrass a demo: a locked key in the text, an item that does not
 * exercise the move, and an empty exercise.
 */

const both = [layouts.yq, layouts.qwerty] as const

function unlockedAfter(layout: Layout, taken: number): string[] {
  return [...initialUnlockedSet(layout), ...layout.unlockOrder.slice(0, taken)]
}

/** Every character is unlocked, or is the capital of an unlocked letter with Shift unlocked. */
function onlyUnlocked(text: string, unlocked: readonly string[]): boolean {
  const open = new Set(unlocked)
  return [...text].every(
    (char) =>
      open.has(char) ||
      (open.has(SHIFT_TOKEN) && char !== char.toLowerCase() && open.has(char.toLowerCase())),
  )
}

const layoutAndPrefix = fc
  .constantFrom(...both)
  .chain((layout) => fc.tuple(fc.constant(layout), fc.nat(layout.unlockOrder.length)))

describe('the space bar as its own move', () => {
  it.each(both)('is a scale of its own on $id, startable from the first exercise', (layout) => {
    const space = catalogue[layout.id].find((scale) => scale.focus.value === SPACE)
    expect(space?.type).toBe('modifiers')
    expect(space?.requires).toEqual([])
    expect(space?.fingers).toEqual([{ hand: 'thumbs', finger: 'thumb' }])
  })

  it('puts a letter of each hand either side of the thumb strike', () => {
    const { yq } = layouts
    const pool = generators.modifiers({
      layout: yq,
      available: new Set([...yq.homeAnchors, SPACE]),
      forms: [SPACE],
      shiftOn: false,
    })
    expect(pool).toContain('ф ж')
    expect(pool).toContain('ж ф')
    for (const item of pool) {
      const [left, right] = item.split(SPACE)
      expect(keyOf(yq, left ?? '')?.hand).not.toBe(keyOf(yq, right ?? '')?.hand)
    }
  })

  it('never uses a locked key, strikes the space between every two letters, and is never empty', () => {
    fc.assert(
      fc.property(layoutAndPrefix, fc.integer(), ([layout, taken], seed) => {
        const scale = catalogue[layout.id].find((s) => s.focus.value === SPACE) as Scale
        const unlocked = unlockedAfter(layout, taken)
        const text = generateText({ scale, layout, unlocked, random: seededRandom(seed) })
        expect(text).not.toBe(REQUIREMENTS_UNMET)
        expect(onlyUnlocked(text, unlocked)).toBe(true)
        expect(text).toMatch(/^[^ ]( [^ ])+$/u)
      }),
    )
  })
})

describe('vertical chains: home → top → bottom in one move', () => {
  it('walks one column up and down on one finger once all three keys are open', () => {
    const { yq, qwerty } = layouts
    const ctx = (layout: Layout, chars: string[], focus: string) => ({
      layout,
      available: new Set([...layout.homeAnchors, ...chars, focus]),
      forms: [focus],
      shiftOn: false,
    })
    expect(generators.vertical(ctx(yq, ['й', 'я'], 'й'))).toContain('фйфяф')
    expect(generators.vertical(ctx(qwerty, ['r', 'v'], 'v'))).toContain('frfvf')
    // Only the pair exists while the bottom key is locked.
    expect(generators.vertical(ctx(yq, [], 'й')).some((item) => item.includes('я'))).toBe(false)
  })

  it('every vertical item exercises its focus and uses only open keys, for any unlock prefix', () => {
    fc.assert(
      fc.property(layoutAndPrefix, fc.integer(), ([layout, taken], seed) => {
        const unlocked = unlockedAfter(layout, taken)
        for (const scale of catalogue[layout.id].filter((s) => s.type === 'vertical')) {
          const text = generateText({ scale, layout, unlocked, random: seededRandom(seed) })
          if (!scale.requires.every((char) => unlocked.includes(char))) continue
          // Offered once its own key's turn comes: the key before it is enough.
          if (text === REQUIREMENTS_UNMET) continue
          expect(onlyUnlocked(text, [...unlocked, scale.focus.value])).toBe(true)
          for (const item of text.split(' ')) expect(item).toContain(scale.focus.value)
        }
      }),
      // Each run walks every vertical scale of a layout, so 40 runs already cover hundreds of
      // (prefix, scale) pairs and keep the test inside its timeout on a loaded machine.
      { numRuns: 40 },
    )
  })

  it('offers chains in a real text once the column is open', () => {
    const { yq } = layouts
    const scale = catalogue.yq.find((s) => s.type === 'vertical' && s.focus.value === 'й') as Scale
    const texts = Array.from({ length: 40 }, (_, seed) =>
      String(
        generateText({
          scale,
          layout: yq,
          unlocked: unlockedAfter(yq, yq.unlockOrder.length),
          random: seededRandom(seed),
        }),
      ),
    )
    expect(texts.some((text) => text.includes('фйфяф'))).toBe(true)
  })
})

describe('the stepped tempo', () => {
  it.each(both)('paces the $id tempo scale 100 → 120 → 140 SPM, three motifs a step', (layout) => {
    const scale = catalogue[layout.id].find((s) => s.type === 'tempo') as Scale
    const text = String(
      generateText({
        scale,
        layout,
        unlocked: initialUnlockedSet(layout),
        random: seededRandom(1),
      }),
    )
    const plan = tempoPlan(scale.targetSpm, text)
    expect(plan.map((segment) => segment.spm)).toEqual([100, 120, 140])
    expect(plan.map((segment) => segment.step)).toEqual([1, 2, 3])
    for (const segment of plan) {
      const items = [...text].slice(segment.from, segment.to).join('').trim().split(' ')
      expect(items).toHaveLength(3)
    }
  })

  it('cuts any text into contiguous steps on item boundaries, covering every character', () => {
    const item = fc.stringMatching(/^[a-zа-я]{1,6}$/u)
    fc.assert(
      fc.property(fc.array(item, { minLength: 1, maxLength: 20 }), (items) => {
        const text = items.join(' ')
        const plan = tempoPlan(100, text)
        expect(plan.length).toBe(Math.min(3, items.length))
        expect(plan[0]?.from).toBe(0)
        expect(plan.at(-1)?.to).toBe([...text].length)
        for (let i = 1; i < plan.length; i++) {
          expect(plan[i]?.from).toBe(plan[i - 1]?.to)
          // A step starts on a letter, right after a space: never mid-motif.
          expect([...text][(plan[i]?.from ?? 0) - 1]).toBe(' ')
        }
        for (let cursor = 0; cursor <= [...text].length; cursor++) {
          const segment = paceAt(plan, cursor)
          expect(segment).toBeDefined()
        }
      }),
    )
  })

  it('has no plan without a tempo', () => {
    expect(tempoPlan(null, 'asdf jkl;')).toEqual([])
    expect(paceAt([], 3)).toBeUndefined()
  })
})

describe('transition drills', () => {
  it('builds the drill for `ол` on the right index and middle fingers, and resolves it by id', () => {
    const { yq } = layouts
    const scale = transitionScale(yq, transitionKey('о', 'л'))
    expect(scale?.focus).toEqual({ kind: 'transition', value: 'о>л' })
    expect(scale?.fingers).toEqual([
      { hand: 'right', finger: 'index' },
      { hand: 'right', finger: 'middle' },
    ])
    expect(scale?.requires).toEqual([])
    expect(scaleById(yq, scale?.id ?? '')).toEqual(scale)
  })

  it('resolves every authored scale by id, and nothing that is not a scale', () => {
    for (const layout of both) {
      for (const scale of catalogue[layout.id]) expect(scaleById(layout, scale.id)).toBe(scale)
      expect(scaleById(layout, `${layout.id}.transition.KeyA`)).toBeUndefined()
      expect(scaleById(layout, `${layout.id}.transition.Nope-KeyA`)).toBeUndefined()
      expect(scaleById(layout, 'garbage')).toBeUndefined()
    }
  })

  it('refuses a Transition the layout cannot type', () => {
    expect(transitionScale(layouts.qwerty, 'а>б')).toBeUndefined()
    expect(transitionScale(layouts.yq, `${SHIFT_TOKEN}>а`)).toBeUndefined()
    expect(transitionScale(layouts.yq, 'nonsense')).toBeUndefined()
  })

  const openPair = layoutAndPrefix.chain(([layout, taken]) => {
    const unlocked = unlockedAfter(layout, taken)
    const chars = unlocked.filter((char) => char !== SHIFT_TOKEN)
    return fc.tuple(
      fc.constant(layout),
      fc.constant(unlocked),
      fc.constantFrom(...chars),
      fc.constantFrom(...chars),
      fc.integer(),
    )
  })

  it('for any two open keys: an id that round-trips, only open keys, the move in every item, never empty', () => {
    fc.assert(
      fc.property(openPair, ([layout, unlocked, from, to, seed]) => {
        const scale = transitionScale(layout, transitionKey(from, to))
        if (from === ' ' && to === ' ') {
          expect(scale).toBeUndefined()
          return
        }
        expect(scale).toBeDefined()
        if (scale === undefined) return
        expect(scaleById(layout, scale.id)).toEqual(scale)
        const text = generateText({ scale, layout, unlocked, random: seededRandom(seed) })
        expect(text).not.toBe(REQUIREMENTS_UNMET)
        expect(onlyUnlocked(text, unlocked)).toBe(true)
        expect(text).not.toMatch(/^ | $| {2}/u)
        for (const item of text.split(' ').filter((part) => part !== '')) {
          if (from !== ' ' && to !== ' ') expect(item).toContain(`${from}${to}`)
        }
        if (from === ' ' || to === ' ') expect(text).toContain(`${from}${to}`)
      }),
    )
  })

  it('drills a capital as its key plus Shift, and only once Shift is open', () => {
    const { yq } = layouts
    const scale = transitionScale(yq, transitionKey('Г', 'л'))
    expect(scale?.requires).toEqual(['г', SHIFT_TOKEN])
    expect(scaleById(yq, scale?.id ?? '')).toEqual(scale)
  })

  it('offers the learner`s weakest measured Transitions as drills, weakest first, unlocked only', () => {
    const { yq } = layouts
    const attempts = [
      makeAttempt({ aggregates: transitionAggregates('о', 'л', 10, 6) }),
      makeAttempt({ aggregates: transitionAggregates('ф', 'і', 10, 3) }),
      // Weak, but its second key is locked for a beginner.
      makeAttempt({ aggregates: transitionAggregates('о', 'щ', 10, 9) }),
      // Weak, but measured too few times to judge.
      makeAttempt({ aggregates: transitionAggregates('д', 'ж', 3, 3) }),
    ].map((attempt) => ({ ...attempt, layoutId: 'yq' as const }))
    const progress = deriveProgress({
      attempts,
      layout: yq,
      catalogue: catalogue.yq,
      startingLevelChoice: 'neverTouchTyped',
      confidence: fakeConfidence,
    })
    const drills = transitionScales(yq, progress)
    expect(drills.map((scale) => scale.focus.value)).toEqual(['о>л', 'ф>і'])
    expect(transitionScales(yq, progress, 1)).toHaveLength(1)
  })
})
