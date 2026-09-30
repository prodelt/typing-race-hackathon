import type { Key } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { layouts, SHIFT_TOKEN } from '../../layout'
import type { GeneratorContext } from '../types'
import { SCALE_TYPES } from '../types'
import { generators, homePartners, tempoSteps } from './index'
import { pairUp, reverse } from './shared'

const { qwerty, yq } = layouts

/** A context with exactly the given characters available, and one form of the Focus Element. */
function context(
  layout: GeneratorContext['layout'],
  chars: readonly string[],
  focus: string,
  shiftOn = false,
): GeneratorContext {
  return {
    layout,
    available: new Set([...layout.homeAnchors, ...chars, focus]),
    forms: [focus],
    shiftOn,
  }
}

function keyByChar(layout: GeneratorContext['layout'], char: string): Key {
  const key = layout.keys.find((candidate) => candidate.plain === char)
  if (key === undefined) throw new Error(`no key for ${char}`)
  return key
}

describe('shared helpers', () => {
  it('pairs up to the shorter list, so nothing indexes past an end', () => {
    expect(pairUp([1, 2, 3], ['a', 'b'])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ])
    expect(pairUp([1], ['a', 'b'])).toEqual([[1, 'a']])
    expect(pairUp([], ['a'])).toEqual([])
  })

  it('reverses text whole, code point by code point', () => {
    expect(reverse('фіва')).toBe('авіф')
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(reverse(reverse(text))).toBe(text)
      }),
    )
  })
})

describe('the eight generators', () => {
  it('has one generator for each of the eight types', () => {
    expect(Object.keys(generators).sort()).toEqual([...SCALE_TYPES].sort())
    expect(SCALE_TYPES).toHaveLength(8)
  })

  it('run: windows of four along the available home row, the focus closing or opening each', () => {
    const pool = generators.run(context(qwerty, [], 'g'))
    // a s d f g j k l are available (no `h`), so the windows slide over that row.
    expect(pool).toContain('asdfg')
    expect(pool).toContain('gfdsa')
    expect(pool).toContain('dfgjg')
    expect(pool).toContain('gjgfd')
    expect(pool.every((item) => item.includes('g'))).toBe(true)
    expect(generators.run(context(yq, [], 'п'))).toContain('фівап')
  })

  it('run: yields nothing with fewer than four home keys', () => {
    const bare: GeneratorContext = {
      layout: qwerty,
      available: new Set(['a', 's']),
      forms: ['f'],
      shiftOn: false,
    }
    expect(generators.run(bare)).toEqual([])
  })

  it('mirror: same-named fingers paired edges to centre, as palindromes around the focus', () => {
    const pool = generators.mirror(context(qwerty, [], 'g'))
    expect(pool).toContain('a;g;a')
    expect(pool).toContain('slgls')
    expect(pool).toContain('a;sldkfjgjfkdls;a')
    expect(generators.mirror(context(yq, [], 'п'))).toContain('фжпжф')
  })

  it('alternate: left outward against right inward, so no finger meets its namesake', () => {
    const pool = generators.alternate(context(qwerty, [], 'g'))
    expect(pool).toContain('ajgaj')
    expect(pool).toContain('skgsk')
    expect(pool).toContain('dlgdl')
    expect(pool).toContain('f;gf;')
    expect(pool).toContain('ajskdlf;g')
    expect(generators.alternate(context(yq, [], 'п'))).toContain('фопфо')
  })

  it('fingerIsolation: one finger rank at a time, both hands, repeated', () => {
    const pool = generators.fingerIsolation(context(qwerty, [], 'g'))
    expect(pool).toContain('a;a;a;g')
    expect(pool).toContain('slslslg')
    expect(pool).toContain('fjfjfjg')
    expect(generators.fingerIsolation(context(yq, [], 'п'))).toContain('фжфжфжп')
  })

  it('mirror, alternate and isolation yield nothing without the anchors', () => {
    const none: GeneratorContext = {
      layout: qwerty,
      available: new Set(['g']),
      forms: ['g'],
      shiftOn: false,
    }
    expect(generators.mirror(none)).toEqual([])
    expect(generators.alternate(none)).toEqual([])
    expect(generators.fingerIsolation(none)).toEqual([])
  })

  it('vertical: each home key with the key above it on its finger, then below', () => {
    const pool = generators.vertical(context(qwerty, ['r', 'w', 'v', 'x'], 'r'))
    expect(pool).toContain('frfrr')
    expect(pool).toContain('swswr')
    expect(pool).toContain('fvfvr')
    expect(pool).toContain('sxsxr')
    expect(generators.vertical(context(yq, ['й', 'я'], 'й'))).toContain('фйфйй')
    expect(generators.vertical(context(yq, ['й', 'я'], 'й'))).toContain('фяфяй')
  })

  it('vertical: yields nothing before any top- or bottom-row key is available', () => {
    expect(generators.vertical(context(qwerty, [], 'f'))).toEqual([])
    expect(generators.vertical(context(yq, [], 'а'))).toEqual([])
  })

  it('vertical: a key whose home key is locked has no partner yet', () => {
    // `t` sits over `g`, which is not anchor and not available.
    expect(generators.vertical(context(qwerty, [], 't'))).toEqual([])
    expect(generators.vertical(context(qwerty, ['g'], 't'))).toContain('gtgtt')
  })

  it('fingerSpan: one finger over its own keys, including the index fingers six-key span', () => {
    const pool = generators.fingerSpan(context(qwerty, ['r', 't', 'v', 'g', 'b'], 'b'))
    expect(pool).toContain('rtrtb')
    expect(pool).toContain('bvbvb')
    expect(pool).toContain('frfrb')
    const left = 'frvtgb'
    for (const a of left) {
      for (const b of left) if (a !== b) expect(pool).toContain(`${a}${b}${a}${b}b`)
    }
  })

  it('fingerSpan: a finger with a single available key has no span', () => {
    expect(generators.fingerSpan(context(qwerty, [], 'a'))).toEqual([])
  })

  it('modifiers: digits and punctuation pair with the home key on their finger', () => {
    const pool = generators.modifiers(context(qwerty, ['1', '4', ','], '4'))
    expect(pool).toContain('a14')
    expect(pool).toContain('f44')
    expect(pool).toContain('k,4')
    expect(pool.some((item) => item.startsWith(';;'))).toBe(false)
    const uk = generators.modifiers(context(yq, ['ґ', '.', ';'], '1'))
    expect(uk).toContain('жґ1')
    expect(uk).toContain('ж.1')
    expect(uk).toContain('а;1')
  })

  it('modifiers: capitals only once Shift is on, each pairing a capital with its lowercase', () => {
    const off = generators.modifiers(context(qwerty, [], 'a'))
    expect(off.some((item) => /[A-Z]/.test(item))).toBe(false)
    const on = generators.modifiers(context(qwerty, [], 'a', true))
    expect(on).toContain('Aaa')
    expect(on).toContain('Jja')
    expect(generators.modifiers(context(yq, [], 'а', true))).toContain('Ііа')
  })

  it('modifiers: ignores the Shift token itself, which no key produces', () => {
    const pool = generators.modifiers({
      layout: qwerty,
      available: new Set([...qwerty.homeAnchors, SHIFT_TOKEN]),
      forms: ['A'],
      shiftOn: true,
    })
    expect(pool.some((item) => item.includes(SHIFT_TOKEN))).toBe(false)
    expect(pool.length).toBeGreaterThan(0)
  })

  it('tempo: one anchor motif repeated four times, never pairing the focus with itself', () => {
    const pool = generators.tempo(context(qwerty, [], 'g'))
    expect(pool).toContain('gagagagaga'.slice(0, 8))
    expect(pool).toHaveLength(8)
    const anchored = generators.tempo(context(qwerty, [], 'f'))
    expect(anchored).toHaveLength(7)
    expect(anchored.some((item) => item.startsWith('ff'))).toBe(false)
    expect(generators.tempo(context(yq, [], 'п'))).toContain('пфпфпфпф')
  })

  it('tempo: steps the metronome up from the scale target (R6: 100, 120, 140)', () => {
    expect(tempoSteps(100)).toEqual([100, 120, 140])
    expect(tempoSteps(null)).toEqual([])
  })

  it('every generator keeps to the available characters plus the focus', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(qwerty, yq),
        fc.constantFrom(...SCALE_TYPES),
        fc.nat(40),
        (layout, type, taken) => {
          const chars = layout.unlockOrder.slice(0, taken)
          const focus = layout.unlockOrder[taken] ?? layout.homeAnchors[0] ?? ''
          const ctx = context(layout, chars, focus, chars.includes(SHIFT_TOKEN))
          for (const item of generators[type](ctx)) {
            expect(item).toContain(focus)
            for (const char of item) {
              const lower = char.toLowerCase()
              expect(ctx.available.has(char) || (ctx.shiftOn && ctx.available.has(lower))).toBe(
                true,
              )
            }
          }
        },
      ),
    )
  })
})

describe('homePartners', () => {
  it('pairs a top- or bottom-row key with the home key in its column, on the same finger', () => {
    expect(homePartners(qwerty, keyByChar(qwerty, 'r')).map((k) => k.plain)).toEqual(['f'])
    expect(homePartners(qwerty, keyByChar(qwerty, 't')).map((k) => k.plain)).toEqual(['g'])
    expect(homePartners(qwerty, keyByChar(qwerty, 'y')).map((k) => k.plain)).toEqual(['h'])
    expect(homePartners(qwerty, keyByChar(qwerty, 'v')).map((k) => k.plain)).toEqual(['f'])
    expect(homePartners(qwerty, keyByChar(qwerty, 'n')).map((k) => k.plain)).toEqual(['h'])
    expect(homePartners(yq, keyByChar(yq, 'я')).map((k) => k.plain)).toEqual(['ф'])
  })

  it('falls back to the finger anchor past the end of the home row', () => {
    expect(homePartners(yq, keyByChar(yq, 'ї')).map((k) => k.plain)).toEqual(['ж'])
    expect(homePartners(yq, keyByChar(yq, 'х')).map((k) => k.plain)).toEqual(['є'])
  })
})
