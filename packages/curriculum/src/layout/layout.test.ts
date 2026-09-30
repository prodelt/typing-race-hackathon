import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Layout } from './index'
import {
  fingerOf,
  initialUnlockedSet,
  keyOf,
  layouts,
  nextLockedKey,
  SHIFT_TOKEN,
  shiftFingerOf,
  transitionOf,
} from './index'

const both = [layouts.yq, layouts.qwerty] as const

/** Every character any key produces, with the key it comes from — counted without `fingerOf`. */
function producers(layout: Layout): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const key of layout.keys) {
    for (const char of [key.plain, key.shifted]) {
      if (char === null || char === '') continue
      map.set(char, [...(map.get(char) ?? []), key.code])
    }
  }
  return map
}

describe.each(both)('layout $id', (layout) => {
  it('gives every supported character exactly one key and one finger (FR-002, SC-004)', () => {
    const table = producers(layout)
    expect(table.size).toBeGreaterThan(40)
    for (const [char, codes] of table) {
      expect(codes, `${char} is produced by ${codes.join(', ')}`).toHaveLength(1)
      expect(fingerOf(layout, char), `${char} has no finger`).toBeDefined()
    }
  })

  it('lists every physical key once', () => {
    const codes = layout.keys.map((key) => key.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('puts the space bar on the thumbs, and only the space bar (FR-004)', () => {
    expect(fingerOf(layout, ' ')).toEqual({ hand: 'thumbs', finger: 'thumb' })
    const thumbs = layout.keys.filter((key) => key.hand === 'thumbs')
    expect(thumbs.map((key) => key.code)).toEqual(['Space'])
  })

  it('holds Shift with the pinky of the opposite hand (FR-004)', () => {
    for (const key of layout.keys) {
      if (key.shifted === null) continue
      const shift = shiftFingerOf(layout, key.shifted)
      expect(shift).toEqual({
        hand: key.hand === 'left' ? 'right' : 'left',
        finger: 'pinky',
      })
    }
    // Both Shift keys exist, each under the pinky of its own hand.
    expect(layout.keys.find((key) => key.code === 'ShiftLeft')).toMatchObject({
      hand: 'left',
      finger: 'pinky',
      kind: 'modifier',
    })
    expect(layout.keys.find((key) => key.code === 'ShiftRight')).toMatchObject({
      hand: 'right',
      finger: 'pinky',
      kind: 'modifier',
    })
  })

  it('needs no Shift for an unshifted character, a space or an unknown one', () => {
    expect(shiftFingerOf(layout, layout.homeAnchors[0] ?? '')).toBeUndefined()
    expect(shiftFingerOf(layout, ' ')).toBeUndefined()
    expect(shiftFingerOf(layout, '§')).toBeUndefined()
  })

  it('has eight anchors, all on the home row, and they are not in the Unlock Order', () => {
    expect(layout.homeAnchors).toHaveLength(8)
    for (const anchor of layout.homeAnchors) {
      expect(keyOf(layout, anchor)?.row).toBe('home')
      expect(layout.unlockOrder).not.toContain(anchor)
    }
  })

  it('covers every unlockable key in the Unlock Order exactly once, without space or anchors', () => {
    const unlockable = new Set<string>([SHIFT_TOKEN])
    for (const key of layout.keys) {
      if (key.kind === 'modifier' || key.kind === 'space') continue
      if (!layout.homeAnchors.includes(key.plain)) unlockable.add(key.plain)
      if (key.shifted !== null && key.shifted !== key.plain.toUpperCase()) {
        unlockable.add(key.shifted)
      }
    }
    expect(new Set(layout.unlockOrder).size).toBe(layout.unlockOrder.length)
    expect(new Set(layout.unlockOrder)).toEqual(unlockable)
    expect(layout.unlockOrder).not.toContain(' ')
  })

  it('starts with the eight anchors and the space bar, and nothing else (FR-084)', () => {
    const initial = initialUnlockedSet(layout)
    expect(initial).toHaveLength(9)
    expect(initial.at(-1)).toBe(' ')
    expect(new Set(initial)).toEqual(new Set([...layout.homeAnchors, ' ']))
  })

  it('walks the Unlock Order: every prefix yields the next entry, the full set yields none', () => {
    for (let taken = 0; taken < layout.unlockOrder.length; taken++) {
      const unlocked = [...initialUnlockedSet(layout), ...layout.unlockOrder.slice(0, taken)]
      expect(nextLockedKey(layout, unlocked)).toBe(layout.unlockOrder[taken])
    }
    const all = [...initialUnlockedSet(layout), ...layout.unlockOrder]
    expect(nextLockedKey(layout, all)).toBeUndefined()
  })

  it('types both capitals and lowercase on the same finger (FR-005)', () => {
    for (const key of layout.keys) {
      if (key.kind !== 'letter') continue
      expect(fingerOf(layout, key.plain)).toEqual(fingerOf(layout, key.plain.toUpperCase()))
    }
  })
})

describe('the frozen Unlock Order (R7)', () => {
  it('is the pinned QWERTY order', () => {
    expect(layouts.qwerty.unlockOrder.join(' ')).toBe(
      'g h r t y u e i w o q p v b n m c x z ⇧ 1 2 3 4 5 6 7 8 9 0 . , : - \' "',
    )
    expect(layouts.qwerty.unlockOrder).toHaveLength(36)
  })

  it('is the pinned ЙЦУКЕН order, with `ґ` last', () => {
    expect(layouts.yq.unlockOrder.join(' ')).toBe(
      'п р є к е н г у ш ц щ й з х ї м и т ь с б ч ю я ⇧ 1 2 3 4 5 6 7 8 9 0 . , ; : - \' " ґ',
    )
    expect(layouts.yq.unlockOrder).toHaveLength(43)
  })
})

describe('the Ukrainian finger map (ticket 10)', () => {
  const { yq } = layouts

  it('keeps і, ї, є and ґ as themselves (FR-006)', () => {
    for (const letter of ['і', 'ї', 'є', 'ґ', 'І', 'Ї', 'Є', 'Ґ']) {
      expect(keyOf(yq, letter)).toBeDefined()
    }
    expect(keyOf(yq, 'і')?.code).toBe('KeyS')
    expect(keyOf(yq, 'ї')?.code).toBe('BracketRight')
    expect(keyOf(yq, 'є')?.code).toBe('Quote')
  })

  it.each([
    ['ґ', 'Backslash', { hand: 'right', finger: 'pinky' }],
    ['Ґ', 'Backslash', { hand: 'right', finger: 'pinky' }],
    ["'", 'Backquote', { hand: 'left', finger: 'pinky' }],
    ['-', 'Minus', { hand: 'right', finger: 'pinky' }],
    ['1', 'Digit1', { hand: 'left', finger: 'pinky' }],
    ['4', 'Digit4', { hand: 'left', finger: 'index' }],
    ['5', 'Digit5', { hand: 'left', finger: 'index' }],
    ['6', 'Digit6', { hand: 'right', finger: 'index' }],
    ['0', 'Digit0', { hand: 'right', finger: 'pinky' }],
    ['.', 'Slash', { hand: 'right', finger: 'pinky' }],
  ] as const)('puts %s on %s', (char, code, finger) => {
    expect(keyOf(yq, char)?.code).toBe(code)
    expect(fingerOf(yq, char)).toEqual(finger)
  })

  it('folds the typographic apostrophe onto U+0027', () => {
    expect(fingerOf(yq, '’')).toEqual(fingerOf(yq, "'"))
    expect(keyOf(yq, '’')?.code).toBe('Backquote')
  })

  it('matches the finger map in CONTEXT.md', () => {
    const expected: Record<string, string> = {
      'left pinky': 'йфя',
      'left ring': 'ціч',
      'left middle': 'увс',
      'left index': 'кеапми',
      'right index': 'нгроть',
      'right middle': 'шлб',
      'right ring': 'щдю',
    }
    for (const [assignment, chars] of Object.entries(expected)) {
      const [hand, finger] = assignment.split(' ')
      for (const char of chars) expect(fingerOf(yq, char)).toEqual({ hand, finger })
    }
  })
})

describe('the QWERTY finger map', () => {
  const { qwerty } = layouts

  it('matches the finger map in CONTEXT.md', () => {
    const expected: Record<string, string> = {
      'left pinky': 'qaz',
      'left ring': 'wsx',
      'left middle': 'edc',
      'left index': 'rfvtgb',
      'right index': 'yhnujm',
      'right middle': 'ik,',
      'right ring': 'ol.',
      'right pinky': "p;'",
    }
    for (const [assignment, chars] of Object.entries(expected)) {
      const [hand, finger] = assignment.split(' ')
      for (const char of chars) expect(fingerOf(qwerty, char)).toEqual({ hand, finger })
    }
  })

  it('puts the hyphen and the digits where ticket 10 says', () => {
    expect(fingerOf(qwerty, '-')).toEqual({ hand: 'right', finger: 'pinky' })
    expect(fingerOf(qwerty, '1')).toEqual({ hand: 'left', finger: 'pinky' })
    expect(fingerOf(qwerty, '0')).toEqual({ hand: 'right', finger: 'pinky' })
  })

  it('does not support Cyrillic', () => {
    expect(fingerOf(qwerty, 'ф')).toBeUndefined()
  })
})

describe('transitionOf', () => {
  const { yq, qwerty } = layouts

  it('flags a same-finger move and a row change', () => {
    // д→о: right ring to right index, same row, different fingers.
    expect(transitionOf(yq, 'д', 'о')).toMatchObject({
      sameFinger: false,
      rowChange: false,
    })
    // е→п: both left index; top row to home row.
    expect(transitionOf(yq, 'е', 'п')).toMatchObject({
      sameFinger: true,
      rowChange: true,
    })
    expect(transitionOf(qwerty, 'f', 'g')).toMatchObject({
      sameFinger: true,
      rowChange: false,
    })
  })

  it('carries the characters and both fingers', () => {
    expect(transitionOf(qwerty, 'a', 'j')).toEqual({
      from: 'a',
      to: 'j',
      fromFinger: { hand: 'left', finger: 'pinky' },
      toFinger: { hand: 'right', finger: 'index' },
      rowChange: false,
      sameFinger: false,
    })
  })

  it('treats a repeated character as a same-finger move', () => {
    expect(transitionOf(qwerty, 'a', 'a').sameFinger).toBe(true)
  })

  it('refuses a character the layout does not support, naming it', () => {
    expect(() => transitionOf(qwerty, 'a', 'ф')).toThrow(/ф/)
    expect(() => transitionOf(qwerty, 'ф', 'a')).toThrow(/ф/)
  })

  it('is symmetric in sameFinger and rowChange, for any pair of supported characters', () => {
    for (const layout of both) {
      const chars = [...producers(layout).keys()]
      fc.assert(
        fc.property(fc.constantFrom(...chars), fc.constantFrom(...chars), (a, b) => {
          const forward = transitionOf(layout, a, b)
          const backward = transitionOf(layout, b, a)
          expect(forward.sameFinger).toBe(backward.sameFinger)
          expect(forward.rowChange).toBe(backward.rowChange)
          expect(forward.sameFinger).toBe(
            forward.fromFinger.hand === forward.toFinger.hand &&
              forward.fromFinger.finger === forward.toFinger.finger,
          )
        }),
      )
    }
  })
})
