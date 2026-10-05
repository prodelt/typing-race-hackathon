import { describe, expect, it } from 'vitest'
import { layouts } from '../layout'
import { dailyId, isDailyId, isFreePracticeId, isOwnTextId, ownTextId } from './free-practice'
import { realTextId } from './real-text'

describe('free-practice ids', () => {
  it('names the daily challenge and own text per layout', () => {
    expect(dailyId(layouts.yq)).toBe('yq.daily')
    expect(ownTextId(layouts.yq)).toBe('yq.owntext')
    expect(ownTextId(layouts.qwerty)).not.toBe(ownTextId(layouts.yq))
  })

  it('recognises each kind and nothing else', () => {
    expect(isDailyId(dailyId(layouts.yq))).toBe(true)
    expect(isDailyId(ownTextId(layouts.yq))).toBe(false)
    expect(isOwnTextId(ownTextId(layouts.yq))).toBe(true)
    expect(isOwnTextId(realTextId(layouts.yq))).toBe(false)
    expect(isOwnTextId('yq.owntext.extra')).toBe(false)
  })

  it('counts daily and own text as free practice, and the stock real text not', () => {
    expect(isFreePracticeId(dailyId(layouts.yq))).toBe(true)
    expect(isFreePracticeId(ownTextId(layouts.qwerty))).toBe(true)
    expect(isFreePracticeId(realTextId(layouts.yq))).toBe(false)
    expect(isFreePracticeId('yq.run.KeyG')).toBe(false)
  })
})
