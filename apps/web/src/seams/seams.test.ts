import type { InputEvent as DomainInputEvent } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { noAssetCache } from './cache.js'
import { manualClock } from './clock.js'
import { domInputSource, scriptedInput } from './input.js'
import { seededRandom } from './random.js'

describe('manualClock (T014)', () => {
  it('advances only when told to', () => {
    const clock = manualClock(100)
    expect(clock.now()).toBe(100)
    clock.advance(250)
    expect(clock.now()).toBe(350)
    // Two reads with no advance in between must agree, or no test of the 3000 ms rhythm-break
    // rule can be written at all.
    expect(clock.now()).toBe(350)
  })

  it('refuses to go backwards', () => {
    // A clock that can run backwards makes a negative inter-keystroke interval possible, and
    // every metric downstream would then have to defend against one.
    expect(() => manualClock().advance(-1)).toThrow()
  })
})

describe('seededRandom (T015)', () => {
  it('gives the same sequence for the same seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        const a = Array.from({ length: 20 }, () => seededRandom(seed).next())
        const b = Array.from({ length: 20 }, () => seededRandom(seed).next())
        expect(a).toEqual(b)
      }),
    )
  })

  it('gives different sequences for different seeds', () => {
    const a = seededRandom(1)
    const b = seededRandom(2)
    const left = Array.from({ length: 10 }, () => a.next())
    const right = Array.from({ length: 10 }, () => b.next())
    expect(left).not.toEqual(right)
  })

  it('stays inside [0, 1)', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 1000; i += 1) {
      const value = random.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('nextInt stays inside [0, bound) for any bound', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 9999 }),
        (bound, seed) => {
          const random = seededRandom(seed)
          for (let i = 0; i < 50; i += 1) {
            const value = random.nextInt(bound)
            expect(Number.isInteger(value)).toBe(true)
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(bound)
          }
        },
      ),
    )
  })

  it('rejects a bound that is not a positive integer', () => {
    expect(() => seededRandom(1).nextInt(0)).toThrow()
    expect(() => seededRandom(1).nextInt(-3)).toThrow()
    expect(() => seededRandom(1).nextInt(2.5)).toThrow()
  })

  it('covers every value of a small bound, so no index is unreachable', () => {
    // A generator that never returns the last index would quietly drop a key from every scale.
    const random = seededRandom(42)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i += 1) seen.add(random.nextInt(5))
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4])
  })
})

describe('scriptedInput (T017)', () => {
  it('replays its events to the first subscriber, in order', () => {
    const events: DomainInputEvent[] = [
      { kind: 'char', char: 'ф', at: 0 },
      { kind: 'backspace', at: 120 },
      { kind: 'ignored', reason: 'modifier', at: 130 },
    ]
    const seen: DomainInputEvent[] = []
    scriptedInput(events).subscribe((event) => seen.push(event))
    expect(seen).toEqual(events)
  })

  it('probes as producible and needs no DOM', async () => {
    await expect(scriptedInput([]).probeLayout()).resolves.toEqual({
      producible: true,
    })
  })
})

describe('domInputSource (T016, T018)', () => {
  function harness() {
    const element = document.createElement('textarea')
    document.body.append(element)
    const clock = manualClock(0)
    const seen: DomainInputEvent[] = []
    const source = domInputSource(element, clock)
    source.subscribe((event) => seen.push(event))
    return { element, clock, seen }
  }

  function beforeInput(element: HTMLTextAreaElement, inputType: string, data: string | null) {
    element.dispatchEvent(
      new window.InputEvent('beforeinput', {
        inputType,
        data,
        bubbles: true,
        cancelable: true,
      }),
    )
  }

  it('reads characters from beforeinput, not from keydown', () => {
    // keydown carries no reliable character for Ukrainian, and Playwright cannot type Cyrillic
    // through the keyboard API in any engine (research 06). This is the whole reason for the seam.
    const { element, seen } = harness()
    beforeInput(element, 'insertText', 'ф')
    expect(seen).toEqual([{ kind: 'char', char: 'ф', at: 0 }])
  })

  it('takes an insertText of several characters as no keystroke at all', () => {
    // One key makes one character. A whole line in one `insertText` is a script or an extension
    // typing for the learner, and must not type (ADR-0003, 2026-10-06); an input method commits
    // through `compositionend`, which is still judged character by character.
    const { element, seen } = harness()
    beforeInput(element, 'insertText', 'фіва олдж')
    expect(seen).toEqual([{ kind: 'ignored', reason: 'burst', at: 0 }])
    expect(element.value).toBe('')
  })

  it('still reads one character made of two UTF-16 units as one keystroke', () => {
    // Counted in code points, so a character outside the BMP is not mistaken for a burst.
    const { element, seen } = harness()
    beforeInput(element, 'insertText', '𝔞')
    expect(seen).toEqual([{ kind: 'char', char: '𝔞', at: 0 }])
  })

  it('emits backspace for a backward deletion', () => {
    const { element, seen } = harness()
    beforeInput(element, 'deleteContentBackward', null)
    expect(seen).toEqual([{ kind: 'backspace', at: 0 }])
  })

  it('never lets the textarea accumulate text, even if preventDefault is ignored', () => {
    // Firefox ignores preventDefault() on beforeinput (research 06), so the value is cleared
    // defensively as well. A textarea that grows would start reporting its own contents back.
    const { element } = harness()
    element.value = 'leftover'
    beforeInput(element, 'insertText', 'ф')
    expect(element.value).toBe('')
  })

  it('emits ignored rather than swallowing a modifier chord', () => {
    // FR-020 promises a modifier does not break the session, and an event nobody records cannot
    // prove that.
    const { element, seen } = harness()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    expect(seen).toEqual([
      { kind: 'ignored', reason: 'modifier', at: 0 },
      { kind: 'ignored', reason: 'modifier', at: 0 },
    ])
  })

  it('ignores the auto-repeat of a held key, and cancels the text it would insert', () => {
    const { element, seen } = harness()
    const repeat = new KeyboardEvent('keydown', {
      key: 'a',
      repeat: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(repeat)
    expect(repeat.defaultPrevented).toBe(true)
    expect(seen).toEqual([{ kind: 'ignored', reason: 'repeat', at: 0 }])
  })

  it('lets a held Backspace repeat: deleting several characters is what holding it is for', () => {
    const { element, seen } = harness()
    const repeat = new KeyboardEvent('keydown', {
      key: 'Backspace',
      repeat: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(repeat)
    expect(repeat.defaultPrevented).toBe(false)
    expect(seen).toEqual([])
  })

  it('emits ignored for a dead key', () => {
    const { element, seen } = harness()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Dead', bubbles: true }))
    expect(seen).toEqual([{ kind: 'ignored', reason: 'deadKey', at: 0 }])
  })

  it('emits ignored for a paste rather than counting it as typing', () => {
    const { element, seen } = harness()
    beforeInput(element, 'insertFromPaste', 'фіва олдж')
    expect(seen).toEqual([{ kind: 'ignored', reason: 'composition', at: 0 }])
  })

  it('holds a composition back until compositionend, then judges its result', () => {
    const { element, seen } = harness()
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    beforeInput(element, 'insertCompositionText', 'ф')
    expect(seen).toEqual([])

    element.dispatchEvent(new CompositionEvent('compositionend', { data: 'фі', bubbles: true }))
    expect(seen.map((e) => (e.kind === 'char' ? e.char : e.kind))).toEqual(['ф', 'і'])
  })

  it('timestamps every event from the injected clock', () => {
    const { element, clock, seen } = harness()
    beforeInput(element, 'insertText', 'ф')
    clock.advance(250)
    beforeInput(element, 'insertText', 'і')
    expect(seen.map((e) => e.at)).toEqual([0, 250])
  })

  it('reports producible when the browser cannot tell us the physical layout', async () => {
    // navigator.keyboard is Chromium-only. Blocking an attempt on a question Firefox and Safari
    // cannot answer would make them unusable, so an unknown layout is not a mismatch.
    const { element, clock } = harness()
    await expect(domInputSource(element, clock).probeLayout()).resolves.toEqual({
      producible: true,
    })
  })
})

describe('noAssetCache (T023)', () => {
  it('registers nothing and says so', async () => {
    // Every test but the offline scenario runs with this, or a stale cache silently passes a
    // failing build.
    const cache = noAssetCache()
    expect(cache.status()).toBe('unsupported')
    await expect(cache.register()).resolves.toBe('unsupported')
  })
})
