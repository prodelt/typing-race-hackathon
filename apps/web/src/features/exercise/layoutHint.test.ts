import { layouts } from '@typing-race/curriculum'
import type { InputEvent } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { FOREIGN_STREAK, isOfLayout, nextForeignStreak } from './layoutHint.js'

const yq = layouts.yq
const qwerty = layouts.qwerty
const char = (value: string): InputEvent => ({ kind: 'char', char: value, at: 0 })

/** Folds a typed string through the streak, as the race does keystroke by keystroke. */
function streakAfter(layout: typeof yq, typed: string): number {
  return [...typed].reduce((streak, c) => nextForeignStreak(streak, layout, char(c)), 0)
}

describe('nextForeignStreak', () => {
  it('counts Latin letters typed against a Ukrainian race', () => {
    expect(streakAfter(yq, 'hel')).toBe(FOREIGN_STREAK)
  })

  it('counts Cyrillic letters typed against an English race', () => {
    expect(streakAfter(qwerty, 'при')).toBe(FOREIGN_STREAK)
  })

  it('counts the Russian-only letters a Ukrainian text has no place for', () => {
    expect(streakAfter(yq, 'ыэъ')).toBe(FOREIGN_STREAK)
  })

  it('resets on a letter the layout produces', () => {
    expect(streakAfter(yq, 'heк')).toBe(0)
    expect(streakAfter(yq, 'hекl')).toBe(1)
  })

  it('ignores spaces, digits, signs, backspace and ignored events', () => {
    expect(streakAfter(yq, 'h 1,l')).toBe(2)
    expect(nextForeignStreak(2, yq, { kind: 'backspace', at: 0 })).toBe(2)
    expect(nextForeignStreak(2, yq, { kind: 'ignored', reason: 'modifier', at: 0 })).toBe(2)
  })

  it('treats a capital as its small letter', () => {
    expect(streakAfter(yq, 'К')).toBe(0)
    expect(streakAfter(yq, 'H')).toBe(1)
  })
})

describe('isOfLayout', () => {
  it('is true only for a letter the layout produces', () => {
    expect(isOfLayout(yq, char('к'))).toBe(true)
    expect(isOfLayout(yq, char('k'))).toBe(false)
    expect(isOfLayout(yq, char(' '))).toBe(false)
    expect(isOfLayout(yq, { kind: 'backspace', at: 0 })).toBe(false)
  })
})
