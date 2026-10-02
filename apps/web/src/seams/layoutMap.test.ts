import { afterEach, describe, expect, it } from 'vitest'
import { manualClock } from './clock.js'
import { domInputSource } from './input.js'
import { provesUnproducible, shapeOfLayoutMap } from './layoutMap.js'

/** The keys the reader looks at, as `getLayoutMap()` reports them. */
const US = new Map([
  ['KeyF', 'f'],
  ['KeyS', 's'],
  ['BracketRight', ']'],
  ['Quote', "'"],
])
const UKRAINIAN = new Map([
  ['KeyF', 'а'],
  ['KeyS', 'і'],
  ['BracketRight', 'ї'],
  ['Quote', 'є'],
])
const RUSSIAN = new Map([
  ['KeyF', 'а'],
  ['KeyS', 'ы'],
  ['BracketRight', 'ъ'],
  ['Quote', 'э'],
])

describe('shapeOfLayoutMap', () => {
  it('names a Ukrainian map', () => {
    expect(shapeOfLayoutMap(UKRAINIAN)).toBe('ukrainian')
  })

  it('does not take a Russian map for Ukrainian, though both put «а» on KeyF', () => {
    // The old probe read KeyF alone. This machine has US, Ukrainian and Russian installed.
    expect(shapeOfLayoutMap(RUSSIAN)).toBe('cyrillic')
  })

  it('names a Latin map', () => {
    expect(shapeOfLayoutMap(US)).toBe('latin')
  })

  it('cannot tell without the home key', () => {
    expect(shapeOfLayoutMap(new Map([['KeyS', 'і']]))).toBeUndefined()
  })

  it('recognises Ukrainian by any one of its three marker keys', () => {
    expect(
      shapeOfLayoutMap(
        new Map([
          ['KeyF', 'а'],
          ['Quote', 'є'],
        ]),
      ),
    ).toBe('ukrainian')
    expect(
      shapeOfLayoutMap(
        new Map([
          ['KeyF', 'а'],
          ['BracketRight', 'ї'],
        ]),
      ),
    ).toBe('ukrainian')
  })
})

describe('provesUnproducible', () => {
  it('a Russian-only machine cannot type a Ukrainian text', () => {
    expect(provesUnproducible('cyrillic', 'yq')).toBe(true)
  })

  it('a machine with no Latin layout cannot type an English text', () => {
    expect(provesUnproducible('ukrainian', 'qwerty')).toBe(true)
    expect(provesUnproducible('cyrillic', 'qwerty')).toBe(true)
  })

  it('a Latin map proves nothing: Ukrainian may be installed and active', () => {
    // getLayoutMap() returns the highest-priority Latin layout, so US+Ukrainian machines report
    // «f» on KeyF while Ukrainian is active. Warning here is a false alarm for most learners.
    expect(provesUnproducible('latin', 'yq')).toBe(false)
    expect(provesUnproducible('latin', 'qwerty')).toBe(false)
  })

  it('a Ukrainian map is fine for a Ukrainian text', () => {
    expect(provesUnproducible('ukrainian', 'yq')).toBe(false)
  })
})

describe('domInputSource.probeLayout with a keyboard map', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'keyboard')

  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'keyboard', original)
    else Reflect.deleteProperty(navigator, 'keyboard')
  })

  function probeWith(map: ReadonlyMap<string, string>, expected: 'yq' | 'qwerty') {
    Object.defineProperty(navigator, 'keyboard', {
      configurable: true,
      value: { getLayoutMap: () => Promise.resolve(map) },
    })
    const element = document.createElement('textarea')
    return domInputSource(element, manualClock(0), { expectedLayoutId: expected }).probeLayout()
  }

  it('does not warn a Ukrainian text about a Latin map', async () => {
    await expect(probeWith(US, 'yq')).resolves.toEqual({ producible: true })
  })

  it('does not warn an English text about a Latin map', async () => {
    await expect(probeWith(US, 'qwerty')).resolves.toEqual({ producible: true })
  })

  it('accepts a Ukrainian map for a Ukrainian text', async () => {
    await expect(probeWith(UKRAINIAN, 'yq')).resolves.toEqual({ producible: true })
  })

  it('refuses a Russian-only machine for a Ukrainian text and suggests ЙЦУКЕН', async () => {
    await expect(probeWith(RUSSIAN, 'yq')).resolves.toEqual({
      producible: false,
      suggestedLayoutId: 'yq',
    })
  })

  it('refuses a machine with no Latin layout for an English text', async () => {
    await expect(probeWith(UKRAINIAN, 'qwerty')).resolves.toEqual({
      producible: false,
      suggestedLayoutId: 'qwerty',
    })
  })
})
