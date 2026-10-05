import { describe, expect, it } from 'vitest'
import { createEngine, manualClock, scriptedInput, segmentText } from './index'
import { backspace, char, ignored, layout, setup, typeText } from './support'

describe('construction and lifecycle', () => {
  it('rejects an empty text', () => {
    expect(() =>
      createEngine({
        text: '',
        errorMode: 'stopOnLetter',
        input: scriptedInput([]),
        clock: manualClock(),
        layout,
      }),
    ).toThrow(RangeError)
  })

  it('starts idle with a blank view', () => {
    const { engine } = setup('ab')
    expect(engine.view).toEqual({
      state: 'idle',
      cursor: 0,
      markedAt: null,
      wrong: [],
      errorCount: 0,
      elapsedMs: 0,
      lastError: null,
    })
  })

  it('begins on the first printable character (FR-014)', () => {
    const { engine, input } = setup('ab')
    input.emit(char('a', 40))
    expect(engine.view.state).toBe('running')
    expect(engine.view.cursor).toBe(1)
  })

  it('begins on start() and measures the first delay from it (FR-014, FR-019)', () => {
    const { engine, input, clock } = setup('a')
    clock.advance(1000)
    engine.start()
    expect(engine.view.state).toBe('running')
    input.emit(char('a', 1250))
    expect(engine.finish().dt).toEqual([250])
  })

  it('does not begin on Backspace, an ignored event or an empty character', () => {
    const { engine, input, views } = setup('a')
    input.emit(backspace(1))
    input.emit(ignored(2))
    input.emit(char('', 3))
    expect(engine.view.state).toBe('idle')
    expect(views).toHaveLength(0)
  })

  it('ignores a second start()', () => {
    const { engine, views } = setup('a')
    engine.start()
    engine.start()
    expect(views).toHaveLength(1)
  })

  it('pause, resume and no-op transitions', () => {
    const { engine, views } = setup('ab')
    engine.pause()
    engine.resume()
    expect(views).toHaveLength(0)
    engine.start()
    engine.resume()
    engine.pause()
    expect(engine.view.state).toBe('paused')
    engine.resume()
    expect(engine.view.state).toBe('running')
    expect(views.map((v) => v.state)).toEqual(['running', 'paused', 'running'])
  })

  it('drops events while paused without logging them or repainting', () => {
    const { engine, input, views } = setup('ab')
    engine.start()
    engine.pause()
    input.emit(char('a', 10))
    expect(engine.view.cursor).toBe(0)
    expect(views).toHaveLength(2)
    engine.resume()
    input.emit(char('a', 20))
    input.emit(char('b', 30))
    expect(engine.finish().kind).toEqual(['char', 'char'])
  })

  it('abandoning produces no log and stops listening', () => {
    const { engine, input } = setup('ab')
    engine.start()
    engine.abandon()
    expect(engine.view.state).toBe('abandoned')
    input.emit(char('a', 10))
    expect(engine.view.cursor).toBe(0)
    expect(() => engine.finish()).toThrow(/abandoned/)
    engine.abandon()
    expect(engine.view.state).toBe('abandoned')
  })

  it('can be abandoned while idle or paused', () => {
    const idle = setup('a')
    idle.engine.abandon()
    expect(idle.engine.view.state).toBe('abandoned')
    const paused = setup('a')
    paused.engine.start()
    paused.engine.pause()
    paused.engine.abandon()
    expect(paused.engine.view.state).toBe('abandoned')
  })

  it('finish() throws before completion and works after', () => {
    const { engine, input } = setup('ab')
    expect(() => engine.finish()).toThrow(/idle/)
    input.emit(char('a', 1))
    expect(() => engine.finish()).toThrow(/running/)
    input.emit(char('b', 2))
    expect(engine.view.state).toBe('completed')
    expect(engine.finish().kind).toEqual(['char', 'char'])
  })

  it('stop() completes a time-boxed run where it stands, so finish() returns the log so far', () => {
    const { engine, input, clock } = setup('abcdef', 'freeBackspace')
    input.emit(char('a', 0))
    input.emit(char('x', 100))
    clock.advance(250)
    engine.stop()
    expect(engine.view.state).toBe('completed')
    expect(engine.view.cursor).toBe(2)
    expect(engine.view.elapsedMs).toBe(250)
    clock.advance(500)
    input.emit(char('c', 800))
    expect(engine.view.elapsedMs).toBe(250)
    const log = engine.finish()
    expect(log.char).toEqual(['a', 'x'])
    expect(log.correct).toEqual([true, false])
  })

  it('stop() also ends a paused run, and does nothing to an idle or finished one', () => {
    const paused = setup('abc')
    paused.input.emit(char('a', 0))
    paused.engine.pause()
    paused.engine.stop()
    expect(paused.engine.view.state).toBe('completed')
    const idle = setup('abc')
    idle.engine.stop()
    expect(idle.engine.view.state).toBe('idle')
    const left = setup('abc')
    left.engine.abandon()
    left.engine.stop()
    expect(left.engine.view.state).toBe('abandoned')
  })

  it('stops listening once completed', () => {
    const { engine, input, views } = setup('a')
    input.emit(char('a', 1))
    input.emit(char('a', 2))
    input.emit(backspace(3))
    expect(views).toHaveLength(1)
    expect(engine.finish().dt).toEqual([0])
  })

  it('a listener can unsubscribe', () => {
    const { engine, input } = setup('abc')
    const seen: number[] = []
    const off = engine.onChange((v) => seen.push(v.cursor))
    input.emit(char('a', 1))
    off()
    input.emit(char('b', 2))
    expect(seen).toEqual([1])
  })
})

describe('judging', () => {
  it('stopOnLetter: a wrong key holds the cursor, marks it and counts (FR-016, FR-017)', () => {
    const { engine, input } = setup('ab')
    input.emit(char('x', 1))
    expect(engine.view).toMatchObject({
      cursor: 0,
      markedAt: 0,
      errorCount: 1,
    })
    expect(engine.view.lastError).toEqual({ expected: 'a', got: 'x', at: 0 })
    input.emit(char('y', 2))
    expect(engine.view).toMatchObject({
      cursor: 0,
      markedAt: 0,
      errorCount: 2,
    })
    input.emit(char('a', 3))
    expect(engine.view).toMatchObject({
      cursor: 1,
      markedAt: null,
      errorCount: 2,
    })
  })

  it('stopOnLetter: Backspace clears the mark, keeps the error, and never passes index 0', () => {
    const { engine, input } = setup('ab')
    input.emit(char('x', 1))
    input.emit(backspace(2))
    expect(engine.view).toMatchObject({
      cursor: 0,
      markedAt: null,
      errorCount: 1,
    })
    input.emit(backspace(3))
    expect(engine.view).toMatchObject({ cursor: 0, errorCount: 1 })
    expect(engine.view.lastError).not.toBeNull()
  })

  it('stopOnLetter: Backspace with no mark walks the cursor back one step', () => {
    const { engine, input } = setup('abc')
    input.emit(char('a', 1))
    input.emit(char('b', 2))
    input.emit(backspace(3))
    expect(engine.view.cursor).toBe(1)
  })

  it('worked example: a wrong key corrected by Backspace leaves errorCount raised (FR-024)', () => {
    const { engine, input } = setup('cat')
    input.emit(char('c', 10))
    input.emit(char('o', 20))
    input.emit(backspace(30))
    input.emit(char('a', 40))
    input.emit(char('t', 50))
    expect(engine.view).toMatchObject({
      state: 'completed',
      errorCount: 1,
      cursor: 3,
    })
    const log = engine.finish()
    expect(log).toEqual({
      formatVersion: 1,
      dt: [0, 10, 10, 10, 10],
      kind: ['char', 'char', 'backspace', 'char', 'char'],
      char: ['c', 'o', null, 'a', 't'],
      correct: [true, false, false, true, true],
    })
  })

  it('freeBackspace: every unerased wrong character stays in the view until erased', () => {
    const { engine, input } = setup('abcd', 'freeBackspace')
    input.emit(char('x', 1))
    input.emit(char('b', 2))
    input.emit(char('y', 3))
    expect(engine.view).toMatchObject({ cursor: 3, markedAt: 0, wrong: [0, 2] })
    input.emit(backspace(4))
    expect(engine.view).toMatchObject({ cursor: 2, markedAt: 0, wrong: [0] })
  })

  it('freeBackspace: a wrong key occupies its place and must be erased', () => {
    const { engine, input } = setup('abc', 'freeBackspace')
    input.emit(char('a', 1))
    input.emit(char('x', 2))
    expect(engine.view).toMatchObject({
      cursor: 2,
      markedAt: 1,
      errorCount: 1,
    })
    input.emit(char('c', 3))
    expect(engine.view).toMatchObject({
      cursor: 3,
      markedAt: 1,
      state: 'running',
    })
    input.emit(backspace(4))
    input.emit(backspace(5))
    expect(engine.view).toMatchObject({
      cursor: 1,
      markedAt: null,
      errorCount: 1,
    })
    input.emit(char('b', 6))
    input.emit(char('c', 7))
    expect(engine.view).toMatchObject({ state: 'completed', errorCount: 1 })
  })

  it('freeBackspace: Backspace never walks behind index 0', () => {
    const { engine, input } = setup('ab', 'freeBackspace')
    input.emit(char('a', 1))
    input.emit(backspace(2))
    input.emit(backspace(3))
    expect(engine.view.cursor).toBe(0)
    expect(engine.finish).toThrow()
  })

  it('freeBackspace: a wrong character at the end blocks completion until erased', () => {
    const { engine, input, views } = setup('a', 'freeBackspace')
    input.emit(char('x', 1))
    expect(engine.view).toMatchObject({
      cursor: 1,
      markedAt: 0,
      state: 'running',
    })
    input.emit(char('z', 2))
    expect(views).toHaveLength(1)
    input.emit(backspace(3))
    input.emit(char('a', 4))
    expect(engine.view.state).toBe('completed')
  })

  it('logs wrong keys and Backspace but not a key typed past the end', () => {
    const { engine, input } = setup('a', 'freeBackspace')
    input.emit(char('x', 1))
    input.emit(char('z', 2))
    input.emit(backspace(3))
    input.emit(char('a', 4))
    expect(engine.finish().kind).toHaveLength(3)
  })
})

describe('ignored events (FR-020)', () => {
  it('advance nothing, count nothing, and are logged', () => {
    const { engine, input } = setup('ab')
    input.emit(char('a', 10))
    const before = engine.view
    input.emit(ignored(20))
    input.emit({ kind: 'ignored', reason: 'composition', at: 30 })
    input.emit({ kind: 'ignored', reason: 'deadKey', at: 40 })
    input.emit(char('', 45))
    expect(engine.view).toEqual(before)
    input.emit(char('b', 50))
    const log = engine.finish()
    expect(log.kind).toEqual(['char', 'ignored', 'ignored', 'ignored', 'ignored', 'char'])
    expect(log.char).toEqual(['a', null, null, null, null, 'b'])
    expect(log.correct).toEqual([true, false, false, false, false, true])
  })
})

describe('time accounting (FR-022)', () => {
  it('elapsedMs excludes paused time and does not restart on resume', () => {
    const { engine, clock } = setup('ab')
    engine.start()
    clock.advance(100)
    engine.pause()
    clock.advance(5000)
    expect(engine.view.elapsedMs).toBe(100)
    engine.resume()
    clock.advance(50)
    expect(engine.view.elapsedMs).toBe(150)
    expect(engine.view.state).toBe('running')
  })

  it('freezes at completion and while idle', () => {
    const { engine, input, clock } = setup('a')
    clock.advance(99)
    expect(engine.view.elapsedMs).toBe(0)
    input.emit(char('a', 99))
    clock.advance(40)
    input.emit(char('a', 139))
    clock.advance(1000)
    expect(engine.view.elapsedMs).toBe(0)
  })

  it('elapsed covers the running time up to the completing keystroke', () => {
    const { engine, input, clock } = setup('ab')
    input.emit(char('a', 0))
    clock.advance(300)
    input.emit(char('b', 300))
    clock.advance(1000)
    expect(engine.view.elapsedMs).toBe(300)
  })

  it('never logs a negative delta for a late timestamp', () => {
    const { engine, input } = setup('ab')
    input.emit(char('a', 100))
    input.emit(char('b', 90))
    expect(engine.finish().dt).toEqual([0, 0])
  })
})

describe('apostrophe and Ukrainian (FR-006, FR-007)', () => {
  it('folds U+2019 typed against a U+0027 text, storing U+0027', () => {
    const { engine, input } = setup("п'ять")
    for (const e of typeText('п’ять')) input.emit(e)
    expect(engine.view).toMatchObject({ state: 'completed', errorCount: 0 })
    expect(engine.finish().char).toContain("'")
    expect(engine.finish().char).not.toContain('’')
  })

  it('folds U+0027 typed against a U+2019 text', () => {
    const { engine, input } = setup('п’ять')
    for (const e of typeText("п'ять")) input.emit(e)
    expect(engine.view).toMatchObject({ state: 'completed', errorCount: 0 })
  })

  it('does not fold anything else', () => {
    const { engine, input } = setup("a'")
    input.emit(char('a', 1))
    input.emit(char('`', 2))
    expect(engine.view.errorCount).toBe(1)
  })

  it('judges і ї є ґ as themselves and rejects lookalikes', () => {
    const { engine, input } = setup('іїєґ')
    for (const e of typeText('іїєґ')) input.emit(e)
    expect(engine.view).toMatchObject({ state: 'completed', errorCount: 0 })
    for (const [want, lookalike] of [
      ['і', 'i'],
      ['ї', 'ï'],
      ['є', 'e'],
      ['ґ', 'г'],
    ] as const) {
      const t = setup(want)
      t.input.emit(char(lookalike, 1))
      expect(t.engine.view).toMatchObject({ errorCount: 1, cursor: 0 })
    }
  })
})

describe('composition', () => {
  it('judges a multi-character event one character at a time, in order', () => {
    const { engine, input, views } = setup('привіт')
    input.emit(char('при', 10))
    expect(engine.view.cursor).toBe(3)
    input.emit(char('віт', 20))
    expect(engine.view.state).toBe('completed')
    expect(views).toHaveLength(2)
    expect(engine.finish().dt).toEqual([0, 0, 0, 10, 0, 0])
  })

  it('judges every character even after a wrong one, skipping none', () => {
    const { engine, input } = setup('прив')
    input.emit(char('пxив', 10))
    expect(engine.view).toMatchObject({ cursor: 1, errorCount: 3 })
    expect(engine.finish).toThrow()
    const log = engine.view
    expect(log.markedAt).toBe(1)
  })

  it('logs each character of a composition as its own entry', () => {
    const { engine, input } = setup('ab')
    input.emit(char('ab', 10))
    const log = engine.finish()
    expect(log.char).toEqual(['a', 'b'])
    expect(log.correct).toEqual([true, true])
  })

  it('drops characters typed past the end of the text', () => {
    const { engine, input } = setup('ab')
    input.emit(char('abc', 10))
    expect(engine.finish().char).toEqual(['a', 'b'])
  })

  it('counts code points, not UTF-16 units', () => {
    const { engine, input } = setup('a😀b')
    input.emit(char('a😀', 1))
    expect(engine.view.cursor).toBe(2)
  })
})

describe('view and segmentation', () => {
  it('carries no metric (FR-069)', () => {
    const { engine } = setup('a')
    expect(Object.keys(engine.view).sort()).toEqual([
      'cursor',
      'elapsedMs',
      'errorCount',
      'lastError',
      'markedAt',
      'state',
      'wrong',
    ])
  })

  it('fires onChange once per processed event, never for a dropped one', () => {
    const { input, views } = setup('abc')
    input.emit(char('a', 1))
    input.emit(char('x', 2))
    input.emit(backspace(3))
    input.emit(ignored(4))
    expect(views).toHaveLength(4)
  })

  it('splits typed, awaited and upcoming text (FR-015)', () => {
    expect(segmentText('hello', { cursor: 2 })).toEqual({
      typed: 'he',
      awaited: 'l',
      upcoming: 'lo',
    })
    expect(segmentText('hi', { cursor: 2 })).toEqual({
      typed: 'hi',
      awaited: '',
      upcoming: '',
    })
  })
})
