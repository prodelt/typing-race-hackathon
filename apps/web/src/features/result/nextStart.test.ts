import { describe, expect, it } from 'vitest'
import { nextStartMode, practiceAdvice } from './nextStart'

const FLOOR = 0.95

function attempt(over: { mode: 'practice' | 'test'; accuracy: number; scaleId?: string }) {
  return {
    mode: over.mode,
    scaleId: over.scaleId ?? 'yq.run.KeyG',
    metrics: { accuracy: over.accuracy },
  }
}

describe('nextStartMode', () => {
  it('opens the test when a practice attempt cleared the floor and the coach points back at the same exercise', () => {
    const last = attempt({ mode: 'practice', accuracy: 0.98 })
    expect(nextStartMode(last, { startsScaleId: 'yq.run.KeyG' }, FLOOR)).toBe('test')
  })

  it('counts landing exactly on the floor as cleared', () => {
    const last = attempt({ mode: 'practice', accuracy: FLOOR })
    expect(nextStartMode(last, { startsScaleId: 'yq.run.KeyG' }, FLOOR)).toBe('test')
  })

  it('stays in practice when the practice attempt was below the floor', () => {
    const last = attempt({ mode: 'practice', accuracy: 0.9 })
    expect(nextStartMode(last, { startsScaleId: 'yq.run.KeyG' }, FLOOR)).toBe('practice')
  })

  it('stays in practice when the coach sends the learner somewhere else', () => {
    // A weak transition drill, or the scale of the next key: a first look, so practice.
    const last = attempt({ mode: 'practice', accuracy: 0.99 })
    expect(nextStartMode(last, { startsScaleId: 'yq.run.KeyH' }, FLOOR)).toBe('practice')
    expect(nextStartMode(last, { startsScaleId: 'yq.review.KeyG-KeyH' }, FLOOR)).toBe('practice')
  })

  it('stays in practice after a test attempt, passed or not', () => {
    expect(
      nextStartMode(
        attempt({ mode: 'test', accuracy: 0.99 }),
        { startsScaleId: 'yq.run.KeyG' },
        FLOOR,
      ),
    ).toBe('practice')
    expect(
      nextStartMode(
        attempt({ mode: 'test', accuracy: 0.5 }),
        { startsScaleId: 'yq.run.KeyG' },
        FLOOR,
      ),
    ).toBe('practice')
  })
})

describe('practiceAdvice: the headline and «Далі» say the same thing', () => {
  it('asks for the test only when «Далі» opens it', () => {
    const last = attempt({ mode: 'practice', accuracy: 0.98 })
    const same = { startsScaleId: 'yq.run.KeyG' }
    expect(practiceAdvice(last, same, FLOOR)).toBe('takeTest')
    expect(nextStartMode(last, same, FLOOR)).toBe('test')
  })

  it('only says the floor is cleared when the coach points at the next key’s scale', () => {
    // The audit's case: «Пройдіть залікову» above a button that opened the next key in practice.
    const last = attempt({ mode: 'practice', accuracy: 0.98 })
    const nextKey = { startsScaleId: 'yq.run.KeyH' }
    expect(practiceAdvice(last, nextKey, FLOOR)).toBe('cleared')
    expect(nextStartMode(last, nextKey, FLOOR)).toBe('practice')
  })

  it('asks to practise up to the floor below it, wherever the coach points', () => {
    const last = attempt({ mode: 'practice', accuracy: 0.9 })
    expect(practiceAdvice(last, { startsScaleId: 'yq.run.KeyG' }, FLOOR)).toBe('below')
    expect(practiceAdvice(last, { startsScaleId: 'yq.run.KeyH' }, FLOOR)).toBe('below')
  })

  it('never disagrees: the button opens the test exactly when the advice is to take it', () => {
    for (const accuracy of [0.5, 0.94, FLOOR, 0.97, 1]) {
      for (const startsScaleId of ['yq.run.KeyG', 'yq.run.KeyH', 'yq.review.KeyG-KeyH']) {
        const last = attempt({ mode: 'practice', accuracy })
        const next = { startsScaleId }
        expect(nextStartMode(last, next, FLOOR) === 'test').toBe(
          practiceAdvice(last, next, FLOOR) === 'takeTest',
        )
      }
    }
  })
})
