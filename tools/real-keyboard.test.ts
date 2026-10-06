import { describe, expect, it } from 'vitest'
import { FOREIGN_STREAK, nextForeignStreak } from '../apps/web/src/features/exercise/layoutHint'
import { keystrokeOf } from '../e2e/harness/realType'
import { layouts } from '../packages/curriculum/src/layout/index'

/**
 * The CDP harness (`e2e/harness/realType.ts`) plays the operating system: it presses the physical
 * key of each character and types what the *active* layout prints on it. When it typed a character
 * the active layout cannot print, `race-real.spec.ts` saw a learner nobody can be: a US keyboard
 * that types «ї». That letter is ЙЦУКЕН, so it rightly reset the race's foreign-letter streak and
 * the layout notice never came, whenever the random race text was the one about Kyiv.
 */

const CYRILLIC = /\p{Script=Cyrillic}/u

describe('the real-key harness on a US layout', () => {
  it('never types a Cyrillic letter, whatever ЙЦУКЕН key it presses', () => {
    const typed = layouts.yq.keys
      .flatMap((key) => [key.plain, key.shifted])
      .filter((char): char is string => char !== null && CYRILLIC.test(char))
      .map((char) => [char, keystrokeOf(char, 'qwerty', 'yq').text])
    expect(typed.filter(([, text]) => CYRILLIC.test(text ?? ''))).toEqual([])
  })

  it('types «Київ с» as a US layout does: R b ] d, a space, c', () => {
    const typed = [...'Київ с'].map((char) => keystrokeOf(char, 'qwerty', 'yq').text)
    expect(typed).toEqual(['R', 'b', ']', 'd', ' ', 'c'])
  })

  it('gives the race enough foreign letters in the six keys race-real.spec.ts presses', () => {
    let streak = 0
    for (const char of 'Київ с') {
      const text = keystrokeOf(char, 'qwerty', 'yq').text
      streak = nextForeignStreak(streak, layouts.yq, { kind: 'char', char: text, at: 0 })
    }
    expect(streak).toBeGreaterThanOrEqual(FOREIGN_STREAK)
  })
})
