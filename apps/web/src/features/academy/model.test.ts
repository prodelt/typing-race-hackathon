import { type AcademyCourse, parseAcademyCourse } from '@typing-race/curriculum'
import { describe, expect, it } from 'vitest'
import enJson from '../../../../../data/curriculum/en/academy.json'
import ukJson from '../../../../../data/curriculum/uk/academy.json'
import { isMechanics, lockedLetters } from './model.js'

const courses = { en: parseAcademyCourse(enJson), uk: parseAcademyCourse(ukJson) }

/** `isMechanics` for the exercise of that title, which must exist. */
function mechanics(course: AcademyCourse, title: string): boolean {
  for (const module of course.modules) {
    const exercise = module.exercises.find((candidate) => candidate.title === title)
    if (exercise !== undefined) return isMechanics(course, module, exercise)
  }
  throw new Error(`no exercise «${title}»`)
}

describe('isMechanics', () => {
  it('does not call a drill of real words mechanics', () => {
    for (const title of [
      'the · you',
      'her · and',
      'his · our',
      'the · and · for',
      'th/he/ther - English rhythm',
      'ou/ow/you - right upper',
      'Double Letters',
      'tch/tion/sion',
      'str/ght Clusters',
    ]) {
      expect(mechanics(courses.en, title), title).toBe(false)
    }
    for (const title of [
      'не · на',
      'від · при',
      'тебе · але · тут',
      'Подовжені приголосні',
      'Чергування е/о/і',
      'Скупчення приголосних',
    ]) {
      expect(mechanics(courses.uk, title), title).toBe(false)
    }
  })

  it('calls a drill with letter groups that are not words mechanics', () => {
    for (const title of [
      'th · he',
      'ing · hat',
      'thi · tha',
      'll · ee',
      '-ing · -ed',
      '-tion · -ment',
      'Simple Alternation',
      'jk/kj/; - right home center',
      'as/sa/ask - left pinky+ring',
      'in/ng/ing - endings',
    ]) {
      expect(mechanics(courses.en, title), title).toBe(true)
    }
    for (const title of ['ти · ро', 'ого · так', 'нн · тт', '-ість · -ння', 'пере- · при-']) {
      expect(mechanics(courses.uk, title), title).toBe(true)
    }
  })

  it('never marks running text, word lists or the warm-up', () => {
    for (const course of Object.values(courses)) {
      for (const module of course.modules) {
        if (['bigrams', 'sameFinger', 'rolls', 'alternation', 'doubles'].includes(module.kind))
          continue
        if (['trigrams', 'morphemes', 'clusters'].includes(module.kind)) continue
        for (const exercise of module.exercises) {
          expect(isMechanics(course, module, exercise), exercise.title).toBe(false)
        }
      }
    }
  })
})

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
