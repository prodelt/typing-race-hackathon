import { describe, expect, it } from 'vitest'
import { lockedLetters } from './model.js'

describe('lockedLetters', () => {
  it('names the letters of the text that Stage 1 has not opened, once each, in order', () => {
    expect(lockedLetters('на на на знаю нас вона', ['а', 'в', 'о', 'л', 'д', ' '])).toEqual([
      'н',
      'з',
      'ю',
      'с',
    ])
  })

  it('says nothing about an open text, punctuation, digits, spaces or the Shift form of an open letter', () => {
    expect(lockedLetters('На, ні? 7 - ок', ['н', 'а', 'і', 'о', 'к', ' ', ',', '?', '-'])).toEqual(
      [],
    )
  })

  it('counts an unopened capital by its lower-case letter', () => {
    expect(lockedLetters('Київ', ['к', 'и', 'ї'])).toEqual(['в'])
  })
})
