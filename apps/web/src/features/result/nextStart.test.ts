import { describe, expect, it } from 'vitest'
import { nextStartMode } from './nextStart'

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
