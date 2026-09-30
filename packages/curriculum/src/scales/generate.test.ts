import type { Layout, Scale } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { initialUnlockedSet, layouts, SHIFT_TOKEN } from '../layout'
import { catalogue } from './catalogue'
import { generateText } from './generate'
import { scriptedRandom, seededRandom } from './seeded-random'
import { REQUIREMENTS_UNMET } from './types'

const both = [layouts.yq, layouts.qwerty] as const

function unlockedAfter(layout: Layout, taken: number): string[] {
  return [...initialUnlockedSet(layout), ...layout.unlockOrder.slice(0, taken)]
}

/** The characters of a Focus Element, however it is written. */
function focusCharsOf(scale: Scale): string[] {
  return scale.focus.kind === 'key' ? [scale.focus.value] : scale.focus.value.split('>')
}

/** Whether `item` contains the Focus Element — FR-046. Shift is satisfied by any capital. */
function hasFocus(scale: Scale, item: string): boolean {
  if (scale.focus.value === SHIFT_TOKEN) return [...item].some((c) => c !== c.toLowerCase())
  return item.includes(focusCharsOf(scale).join(''))
}

/**
 * FR-012: a character is allowed when it is unlocked, is the Focus Element, is a space between
 * items, or is the capital of an allowed letter while Shift is unlocked or being learned.
 */
function isAllowed(scale: Scale, unlocked: readonly string[], char: string): boolean {
  const base = new Set([...unlocked, ...focusCharsOf(scale), ' '])
  if (base.has(char)) return true
  const shiftOn = base.has(SHIFT_TOKEN)
  return shiftOn && char !== char.toLowerCase() && base.has(char.toLowerCase())
}

const scaleAt = (layout: Layout) => fc.constantFrom(...catalogue[layout.id])

describe.each(both)('generateText on $id', (layout) => {
  it('never emits a locked character, and puts the Focus Element in every item (FR-012, FR-046)', () => {
    fc.assert(
      fc.property(
        scaleAt(layout),
        fc.nat(layout.unlockOrder.length),
        fc.integer(),
        (scale, taken, seed) => {
          const unlocked = unlockedAfter(layout, taken)
          const text = generateText({
            scale,
            layout,
            unlocked,
            random: seededRandom(seed),
          })
          if (text === REQUIREMENTS_UNMET) return
          for (const char of text) expect(isAllowed(scale, unlocked, char)).toBe(true)
          for (const item of text.split(' ')) expect(hasFocus(scale, item)).toBe(true)
        },
      ),
    )
  })

  it('gives identical text for identical (scale, unlocked, seed)', () => {
    fc.assert(
      fc.property(
        scaleAt(layout),
        fc.nat(layout.unlockOrder.length),
        fc.integer(),
        (scale, taken, seed) => {
          const unlocked = unlockedAfter(layout, taken)
          const once = generateText({
            scale,
            layout,
            unlocked,
            random: seededRandom(seed),
          })
          const again = generateText({
            scale,
            layout,
            unlocked,
            random: seededRandom(seed),
          })
          expect(again).toBe(once)
        },
      ),
    )
  })

  it('does not depend on the order the unlocked set is listed in', () => {
    fc.assert(
      fc.property(scaleAt(layout), fc.integer(), (scale, seed) => {
        const unlocked = unlockedAfter(layout, layout.unlockOrder.length)
        const forward = generateText({
          scale,
          layout,
          unlocked,
          random: seededRandom(seed),
        })
        const backward = generateText({
          scale,
          layout,
          unlocked: unlocked.toReversed(),
          random: seededRandom(seed),
        })
        expect(backward).toBe(forward)
      }),
    )
  })

  it('stays within the scale size, unless a single item is longer', () => {
    fc.assert(
      fc.property(scaleAt(layout), fc.integer(), (scale, seed) => {
        const unlocked = unlockedAfter(layout, layout.unlockOrder.length)
        const text = generateText({
          scale,
          layout,
          unlocked,
          random: seededRandom(seed),
        })
        expect(text).not.toBe(REQUIREMENTS_UNMET)
        const items = String(text).split(' ')
        expect(items.length === 1 || String(text).length <= scale.size).toBe(true)
        expect(String(text).length).toBeGreaterThan(0)
      }),
    )
  })

  it('fills most of the target size rather than stopping after one item', () => {
    const scale = catalogue[layout.id][0]
    expect(scale).toBeDefined()
    if (scale === undefined) return
    const text = generateText({
      scale,
      layout,
      unlocked: initialUnlockedSet(layout),
      random: seededRandom(1),
    })
    expect(String(text).length).toBeGreaterThan(scale.size - 10)
  })

  it('varies with the seed', () => {
    const scale = catalogue[layout.id].find((s) => s.type === 'mirror')
    expect(scale).toBeDefined()
    if (scale === undefined) return
    const texts = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        generateText({
          scale,
          layout,
          unlocked: initialUnlockedSet(layout),
          random: seededRandom(seed),
        }),
      ),
    )
    expect(texts.size).toBeGreaterThan(1)
  })

  it('serves every scale at the moment its key unlocks, with only the keys before it', () => {
    for (const scale of catalogue[layout.id]) {
      const position = layout.unlockOrder.indexOf(scale.focus.value)
      const unlocked = unlockedAfter(layout, Math.max(0, position))
      const text = generateText({
        scale,
        layout,
        unlocked,
        random: seededRandom(3),
      })
      expect(text, scale.id).not.toBe(REQUIREMENTS_UNMET)
    }
  })

  it('refuses rather than degrades when `requires` is not unlocked', () => {
    const needy = catalogue[layout.id].filter((scale) => scale.requires.length > 0)
    expect(needy.length).toBeGreaterThan(0)
    for (const scale of needy) {
      const text = generateText({
        scale,
        layout,
        unlocked: initialUnlockedSet(layout),
        random: seededRandom(3),
      })
      expect(text, scale.id).toBe(REQUIREMENTS_UNMET)
    }
  })
})

describe('generateText refusals', () => {
  const { qwerty } = layouts
  const base: Scale = {
    id: 'test.scale',
    layoutId: 'qwerty',
    type: 'run',
    focus: { kind: 'key', value: 'g' },
    fingers: [],
    size: 40,
    targetSpm: null,
    goal: 'scale_goal_run',
    requires: [],
  }
  const anchorsOnly = initialUnlockedSet(qwerty)

  it('refuses a scale from the other layout', () => {
    const scale: Scale = { ...base, layoutId: 'yq' }
    expect(
      generateText({
        scale,
        layout: qwerty,
        unlocked: anchorsOnly,
        random: seededRandom(1),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('refuses a generator that has nothing it may type (vertical before any top-row key)', () => {
    const scale: Scale = {
      ...base,
      type: 'vertical',
      focus: { kind: 'key', value: 'f' },
    }
    expect(
      generateText({
        scale,
        layout: qwerty,
        unlocked: anchorsOnly,
        random: seededRandom(1),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('refuses run when fewer than four home keys are unlocked', () => {
    const scale: Scale = { ...base, focus: { kind: 'key', value: 'f' } }
    expect(
      generateText({
        scale,
        layout: qwerty,
        unlocked: ['a', 's'],
        random: seededRandom(1),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('refuses a Shift scale when there is no letter to capitalise', () => {
    const scale: Scale = {
      ...base,
      type: 'modifiers',
      focus: { kind: 'key', value: SHIFT_TOKEN },
    }
    expect(
      generateText({
        scale,
        layout: qwerty,
        unlocked: [],
        random: seededRandom(1),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('refuses a malformed transition focus', () => {
    const scale: Scale = {
      ...base,
      focus: { kind: 'transition', value: 'no-separator' },
    }
    expect(
      generateText({
        scale,
        layout: qwerty,
        unlocked: anchorsOnly,
        random: seededRandom(1),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('refuses instead of emitting undefined when a Random breaks its [0, max) contract', () => {
    expect(
      generateText({
        scale: base,
        layout: qwerty,
        unlocked: anchorsOnly,
        random: scriptedRandom([1]),
      }),
    ).toBe(REQUIREMENTS_UNMET)
  })

  it('stops after the first item if the Random breaks its contract mid-text', () => {
    const text = generateText({
      scale: base,
      layout: qwerty,
      unlocked: anchorsOnly,
      random: scriptedRandom([0, 1]),
    })
    expect(text).not.toBe(REQUIREMENTS_UNMET)
    expect(String(text)).not.toContain(' ')
  })
})

describe('a transition Focus Element', () => {
  it('appears as the adjacent pair in every item', () => {
    const { qwerty } = layouts
    const scale: Scale = {
      id: 'test.transition',
      layoutId: 'qwerty',
      type: 'run',
      focus: { kind: 'transition', value: 'g>h' },
      fingers: [],
      size: 60,
      targetSpm: null,
      goal: 'scale_goal_run',
      requires: [],
    }
    const text = generateText({
      scale,
      layout: qwerty,
      unlocked: initialUnlockedSet(qwerty),
      random: seededRandom(9),
    })
    expect(text).not.toBe(REQUIREMENTS_UNMET)
    for (const item of String(text).split(' ')) expect(item).toContain('gh')
    for (const char of String(text)) {
      expect(isAllowed(scale, initialUnlockedSet(qwerty), char)).toBe(true)
    }
  })
})

describe('a tempo run', () => {
  it('repeats one motif throughout', () => {
    for (const layout of both) {
      const scale = catalogue[layout.id].find((s) => s.type === 'tempo')
      expect(scale).toBeDefined()
      if (scale === undefined) return
      const text = generateText({
        scale,
        layout,
        unlocked: initialUnlockedSet(layout),
        random: seededRandom(11),
      })
      const items = String(text).split(' ')
      expect(items.length).toBeGreaterThan(1)
      expect(new Set(items).size).toBe(1)
    }
  })
})

describe('Ukrainian letters stay themselves (FR-006)', () => {
  it('types і, ї, є and ґ as those letters and never substitutes latin or russian look-alikes', () => {
    const { yq } = layouts
    const everything = unlockedAfter(yq, yq.unlockOrder.length)
    const seen = new Set<string>()
    for (const scale of catalogue.yq) {
      const text = generateText({
        scale,
        layout: yq,
        unlocked: everything,
        random: seededRandom(5),
      })
      for (const char of String(text)) seen.add(char.toLowerCase())
    }
    for (const letter of ['і', 'ї', 'є', 'ґ']) expect(seen.has(letter)).toBe(true)
    for (const banned of ['i', 'ы', 'э', 'ъ', 'e', 'a']) expect(seen.has(banned)).toBe(false)
  })
})
