import type { Language } from '@typing-race/domain'

/**
 * Authored Content for the two Stage 2 sets the frequency banks leave thin.
 *
 * The Ukrainian bank keeps only 14 apostrophe words, because the frequency source drops most
 * apostrophes and the pipeline only restores the ones the spelling dictionary confirms. The
 * English bank has no hyphenated word at all, because the frequency source splits on hyphens.
 * These lists are common, correctly spelled words of each language, written with U+0027 as the
 * stored apostrophe. They go through the same unlocked-character filter as bank words: an
 * authored word is never a way round the rule that every character must be open.
 */
export const AUTHORED_WORDS: Readonly<Record<Language, readonly string[]>> = {
  uk: [
    "п'ять",
    "м'ясо",
    "сім'я",
    "сім'ї",
    "пам'ять",
    "об'єкт",
    "об'єм",
    "з'їсти",
    "з'їв",
    "м'яч",
    "м'ята",
    "м'який",
    "м'яко",
    "б'є",
    "п'є",
    "п'ю",
    "в'яз",
    "в'їзд",
    "з'їзд",
    "під'їзд",
    "дев'ять",
    "з'ява",
    "з'явився",
    "з'ясувати",
    "здоров'я",
    "подвір'я",
    "прислів'я",
    "пір'я",
    "бур'ян",
    "кар'єра",
    "комп'ютер",
    "інтерв'ю",
    "п'ятниця",
    "об'єднати",
    "з'єднати",
    "солов'ї",
  ],
  en: [
    'well-known',
    'e-mail',
    't-shirt',
    'x-ray',
    'self-made',
    'part-time',
    'full-time',
    'one-way',
    'long-term',
    'follow-up',
    'check-in',
    'sign-up',
    'up-to-date',
    'so-called',
    'twenty-one',
    'half-time',
    'left-hand',
    'right-hand',
    'old-fashioned',
    'brother-in-law',
    'good-looking',
    'far-off',
    'all-out',
    'user-friendly',
  ],
}
