import { describe, expect, it } from 'vitest'
import { createStopwatch } from './clock-accounting'
import { createLogBuilder, LOG_FORMAT_VERSION } from './log'
import { manualClock, scriptedInput } from './testing'

describe('createStopwatch', () => {
  it('accumulates only running segments', () => {
    const clock = manualClock(10)
    const watch = createStopwatch(clock)
    expect(watch.elapsed()).toBe(0)
    watch.pause()
    watch.resume()
    watch.resume()
    clock.advance(30)
    expect(watch.elapsed()).toBe(30)
    watch.pause()
    clock.advance(500)
    watch.resume()
    clock.advance(5)
    expect(watch.elapsed()).toBe(35)
  })
})

describe('createLogBuilder', () => {
  it('appends to parallel arrays and hands out copies', () => {
    const log = createLogBuilder()
    log.append(5, 'char', 'a', true)
    const first = log.snapshot()
    log.append(7, 'backspace', null, false)
    expect(first.dt).toEqual([5])
    expect(log.snapshot()).toEqual({
      formatVersion: LOG_FORMAT_VERSION,
      dt: [5, 7],
      kind: ['char', 'backspace'],
      char: ['a', null],
      correct: [true, false],
    })
  })
})

describe('test doubles', () => {
  it('manualClock starts where told and advances on demand', () => {
    const clock = manualClock()
    expect(clock.now()).toBe(0)
    clock.advance(12)
    expect(clock.now()).toBe(12)
    expect(manualClock(7).now()).toBe(7)
  })

  it('scriptedInput delivers on step and play, and unsubscribes', async () => {
    const input = scriptedInput([
      { kind: 'backspace', at: 1 },
      { kind: 'backspace', at: 2 },
      { kind: 'backspace', at: 3 },
    ])
    const seen: number[] = []
    const off = input.subscribe((e) => seen.push(e.at))
    expect(input.step()).toBe(true)
    input.play()
    expect(input.step()).toBe(false)
    expect(seen).toEqual([1, 2, 3])
    off()
    input.emit({ kind: 'backspace', at: 9 })
    expect(seen).toHaveLength(3)
    await expect(input.probeLayout()).resolves.toEqual({ producible: true })
    input.focus()
    expect(input.focusCalls).toBe(1)
  })
})
