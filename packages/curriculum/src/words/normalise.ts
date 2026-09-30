import type { Language } from '@typing-race/domain'

/**
 * Text normalisation for the Word Bank. The dictionary pipeline and anything that later feeds
 * authored or generated words into an exercise go through the same function, so a word that is
 * valid in one place is valid everywhere.
 *
 * What it never does: fold `і ї є ґ` into anything. NFC keeps `ї` as the single code point U+0457
 * (NFD would split it into `і` + U+0308), and no rule below maps one Ukrainian letter to another.
 */

/** The canonical, stored apostrophe. Displayed as U+2019, but stored and compared as U+0027. */
export const APOSTROPHE = "'"

/**
 * Every character a source uses for the apostrophe: U+2019 (print), U+02BC (macOS, dict_uk),
 * U+0060 (a backtick, 75 times in `uk_full`), U+2018 and U+00B4 (pasted text, dead keys).
 */
const APOSTROPHE_VARIANTS = /[’ʼ`‘´]/g

/** A stress mark. Dictionaries print it; nobody types it, and Hunspell `IGNORE`s it. */
const COMBINING_ACUTE = /́/g

/** Lowercase letters each language's Word Bank allows. The apostrophe and hyphen come on top. */
export const ALPHABETS: Readonly<Record<Language, string>> = {
  uk: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя',
  en: 'abcdefghijklmnopqrstuvwxyz',
}

/** Letters of Russian that Ukrainian does not have. A token containing one is not Ukrainian. */
export const RUSSIAN_ONLY_LETTERS = 'ыэъё'

/** Why a token did not become a word. Each reason is one row in the pipeline's report. */
export type RejectReason =
  | 'empty'
  | 'digit'
  | 'russian-letter'
  | 'foreign-letter'
  | 'other-character'
  | 'bad-apostrophe'
  | 'bad-hyphen'

export type NormaliseResult =
  | { readonly ok: true; readonly word: string }
  | { readonly ok: false; readonly reason: RejectReason }

/** Folds every apostrophe variant to U+0027. Nothing else changes. */
export function foldApostrophes(text: string): string {
  return text.replace(APOSTROPHE_VARIANTS, APOSTROPHE)
}

/**
 * The comparison form of a token: NFC, apostrophes folded, stress marks dropped, lowercase. Does
 * not judge whether the result is a word — `normaliseToken` does that.
 */
export function canonicalForm(raw: string): string {
  return foldApostrophes(raw.normalize('NFC')).replace(COMBINING_ACUTE, '').toLowerCase()
}

/**
 * Normalises one raw token and checks it against the language's character rules:
 *  - only the language's letters, the apostrophe and the hyphen;
 *  - an apostrophe only between two letters (so `'s` and `п'` are rejected, `п'ять` kept);
 *  - a hyphen only between two letters, never doubled (`по-моєму` kept, `just-` rejected).
 */
export function normaliseToken(raw: string, language: Language): NormaliseResult {
  const word = canonicalForm(raw.trim())
  if (word === '') return { ok: false, reason: 'empty' }

  const alphabet = ALPHABETS[language]
  const chars = [...word]
  for (const char of chars) {
    if (alphabet.includes(char) || char === APOSTROPHE || char === '-') continue
    if (/\p{Nd}/u.test(char)) return { ok: false, reason: 'digit' }
    if (language === 'uk' && RUSSIAN_ONLY_LETTERS.includes(char)) {
      return { ok: false, reason: 'russian-letter' }
    }
    if (/\p{L}/u.test(char)) return { ok: false, reason: 'foreign-letter' }
    return { ok: false, reason: 'other-character' }
  }

  const isLetter = (char: string | undefined) => char !== undefined && alphabet.includes(char)
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    if (char !== APOSTROPHE && char !== '-') continue
    if (!isLetter(chars[i - 1]) || !isLetter(chars[i + 1])) {
      return { ok: false, reason: char === APOSTROPHE ? 'bad-apostrophe' : 'bad-hyphen' }
    }
  }
  return { ok: true, word }
}
