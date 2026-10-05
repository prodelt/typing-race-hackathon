import { layouts } from '@typing-race/curriculum'
import type { InputEvent } from '@typing-race/domain'
import { manualClock, scriptedInput } from '@typing-race/engine'
import { describe, expect, it } from 'vitest'
import { seededRandom } from '../../seams/index.js'
import {
  type BestStore,
  isNewBest,
  readBest,
  SPRINT_MS,
  SPRINT_SECONDS,
  type SprintScore,
  secondsLeft,
  sprintText,
  startSprint,
  writeBest,
} from './model.js'

const memory = (): BestStore => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

const key = (char: string, at: number): InputEvent => ({ kind: 'char', char, at })

/** A sprint on a manual clock and a scripted keyboard, with its score caught as it lands. */
function sprintOn(text: string) {
  const clock = manualClock()
  const input = scriptedInput([])
  const scores: SprintScore[] = []
  const sprint = startSprint({
    text,
    errorMode: 'freeBackspace',
    input,
    clock,
    layout: layouts.qwerty,
    onEnd: (score) => scores.push(score),
  })
  /** Advances the clock to `at` and presses `char` there. */
  const press = (char: string, at: number): void => {
    clock.advance(at - clock.now())
    input.emit(key(char, at))
  }
  return { clock, scores, sprint, press }
}

describe('sprint timer', () => {
  it('counts whole seconds down from 60 and stops at zero', () => {
    expect(SPRINT_SECONDS).toBe(60)
    expect(secondsLeft(0)).toBe(60)
    expect(secondsLeft(500)).toBe(60)
    expect(secondsLeft(1000)).toBe(59)
    expect(secondsLeft(SPRINT_MS - 1)).toBe(1)
    expect(secondsLeft(SPRINT_MS)).toBe(0)
    expect(secondsLeft(SPRINT_MS + 5000)).toBe(0)
  })
})

describe('sprint score', () => {
  it('uses the published formulas: a wrong letter left in the line still counts against accuracy', () => {
    const { scores, press } = sprintOn('abcd abcd abcd')
    press('a', 0)
    press('x', 20_000)
    press('c', 40_000)
    press('d', 60_000)
    // Four keys were pressed, but the minute was up before the fourth: it counts for nothing.
    expect(scores).toEqual([{ spm: 3, accuracy: 2 / 3 }])
  })

  it('stops at 60 s of typing time, not wall time: a pause does not eat the minute', () => {
    const { clock, scores, sprint, press } = sprintOn('abcd abcd abcd')
    press('a', 0)
    clock.advance(20_000)
    sprint.engine.pause()
    clock.advance(100_000)
    expect(sprint.tick()).toBe(40)
    expect(scores).toEqual([])
    sprint.engine.resume()
    press('b', 150_000)
    clock.advance(10_200)
    // The tick lands a little after the mark; the minute is still a minute.
    expect(sprint.tick()).toBe(0)
    expect(scores).toEqual([{ spm: 2, accuracy: 1 }])
  })

  it('scores a line finished early per minute of the time it took', () => {
    const { scores, press } = sprintOn('ab')
    press('a', 0)
    press('b', 15_000)
    expect(scores).toEqual([{ spm: 8, accuracy: 1 }])
  })

  it('ends once, and leaving early ends without a score', () => {
    const done = sprintOn('abcd abcd')
    done.press('a', 0)
    done.clock.advance(SPRINT_MS)
    done.sprint.tick()
    done.sprint.tick()
    done.press('b', 70_000)
    expect(done.scores).toHaveLength(1)

    const left = sprintOn('abcd abcd')
    left.press('a', 0)
    left.sprint.dispose()
    left.clock.advance(SPRINT_MS)
    left.sprint.tick()
    expect(left.scores).toEqual([])
    expect(left.sprint.engine.view.state).toBe('abandoned')
  })

  it('does not start the clock before the first letter', () => {
    const { clock, sprint, scores } = sprintOn('abcd')
    clock.advance(SPRINT_MS * 2)
    expect(sprint.tick()).toBe(60)
    expect(scores).toEqual([])
  })
})

describe('sprint best', () => {
  it('needs the accuracy floor to set a best', () => {
    expect(isNewBest({ spm: 200, accuracy: 0.8 }, null, 0.9)).toBe(false)
    expect(isNewBest({ spm: 200, accuracy: 0.95 }, null, 0.9)).toBe(true)
  })

  it('needs a faster pace than the stored best', () => {
    const best = { spm: 150, accuracy: 0.97 }
    expect(isNewBest({ spm: 150, accuracy: 0.99 }, best, 0.9)).toBe(false)
    expect(isNewBest({ spm: 151, accuracy: 0.91 }, best, 0.9)).toBe(true)
  })

  it('keeps one best per language and survives broken storage', () => {
    const store = memory()
    writeBest(store, 'uk', { spm: 120, accuracy: 0.96 })
    expect(readBest(store, 'uk')).toEqual({ spm: 120, accuracy: 0.96 })
    expect(readBest(store, 'en')).toBeNull()
    store.setItem('typing-race:sprint-best:en', '{oops')
    expect(readBest(store, 'en')).toBeNull()
    const throwing: BestStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(readBest(throwing, 'uk')).toBeNull()
    expect(() => writeBest(throwing, 'uk', { spm: 1, accuracy: 1 })).not.toThrow()
  })
})

describe('sprint text', () => {
  it('uses only the given words and never repeats one twice in a row', () => {
    const text = sprintText(['мама', 'тато'], seededRandom(7), 50)
    const words = text.split(' ')
    expect(words).toHaveLength(50)
    expect(words.every((w) => w === 'мама' || w === 'тато')).toBe(true)
    expect(words.some((w, k) => k > 0 && w === words[k - 1])).toBe(false)
  })

  it('is the same line for the same seed and a new one for a new seed', () => {
    const words = ['мама', 'тато', 'ліс', 'сад', 'дім', 'віл']
    expect(sprintText(words, seededRandom(1), 30)).toBe(sprintText(words, seededRandom(1), 30))
    expect(sprintText(words, seededRandom(1), 30)).not.toBe(sprintText(words, seededRandom(2), 30))
  })
})
