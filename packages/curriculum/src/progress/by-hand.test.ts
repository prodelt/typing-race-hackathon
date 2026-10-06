import { describe, expect, it } from 'vitest'
import { typedByHand } from './by-hand'
import { makeAttempt, toSummary } from './fixtures'

describe('typedByHand', () => {
  it('is true for an attempt with no verdict, which is every attempt stored before the rule', () => {
    expect(typedByHand(toSummary(makeAttempt()))).toBe(true)
  })

  it('is false for either verdict', () => {
    expect(typedByHand(makeAttempt({ implausible: 'burst' }))).toBe(false)
    expect(typedByHand(makeAttempt({ implausible: 'tooFast' }))).toBe(false)
  })
})
