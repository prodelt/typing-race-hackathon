import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { layouts } from '../layout/layouts'
import { analyseWord, difficultyTier } from './analyse'
import { candidateWords, encodeWordBank, parseWordBank } from './bank'
import { countNgrams } from './ngrams'
import { ALPHABETS, canonicalForm, normaliseToken } from './normalise'
import type { WordBank, WordRecord } from './types'

function bankOf(words: readonly string[]): WordBank {
  const records: WordRecord[] = words.map((word, index) => {
    const a = analyseWord(word, layouts.yq)
    return {
      word,
      language: 'uk',
      frequency: 1000 - index,
      rank: index + 1,
      source: 'test',
      characters: a.characters,
      bigrams: a.bigrams,
      difficulty: { ...a.difficulty, tier: difficultyTier(index + 1, a.difficulty.length) },
      flags: a.flags,
    }
  })
  return { language: 'uk', source: 'test', algorithmVersion: 'test', words: records }
}

const ukLetter = fc.constantFrom(...ALPHABETS.uk, "'")
const ukWord = fc.array(ukLetter, { minLength: 1, maxLength: 10 }).map((cs) => cs.join(''))

describe('Stage 2 word selection (requirements §8.3)', () => {
  it('never returns a word with a locked character, and misses no word made of unlocked ones', () => {
    const order = layouts.yq.unlockOrder
    fc.assert(
      fc.property(
        fc.uniqueArray(ukWord, { minLength: 1, maxLength: 40 }),
        fc.integer({ min: 0, max: order.length }),
        (words, prefix) => {
          const unlocked = new Set([...layouts.yq.homeAnchors, ...order.slice(0, prefix)])
          const picked = candidateWords(bankOf(words), { unlocked })
          for (const w of picked) for (const c of w.characters) expect(unlocked).toContain(c)
          const typeable = words.filter((w) => [...w].every((c) => unlocked.has(c)))
          expect(picked.map((w) => w.word).sort()).toEqual([...typeable].sort())
        },
      ),
    )
  })

  it('treats a typographic apostrophe in the unlocked set as the apostrophe key', () => {
    const bank = bankOf(["п'ять", 'пам'])
    const unlocked = ['п', 'я', 'т', 'ь', 'а', 'м']
    expect(candidateWords(bank, { unlocked }).map((w) => w.word)).toEqual(['пам'])
    expect(candidateWords(bank, { unlocked: [...unlocked, '’'] }).map((w) => w.word)).toEqual([
      'пам',
      "п'ять",
    ])
  })
})

describe('Ukrainian letters survive normalisation (requirements §8.5)', () => {
  it('leaves any word of Ukrainian letters exactly as it is', () => {
    fc.assert(
      fc.property(ukWord, (word) => {
        const result = normaliseToken(word, 'uk')
        if (result.ok) expect(result.word).toBe(word)
        else expect(result.reason).toMatch(/^bad-apostrophe$/)
      }),
    )
  })

  it('composes a decomposed ї and lower-cases Ґ Є І Ї without substituting them', () => {
    expect(canonicalForm('їжак')).toBe('їжак')
    expect(canonicalForm('ҐАНОК')).toBe('ґанок')
    expect(canonicalForm('ЄДНІСТЬ')).toBe('єдність')
    expect(canonicalForm('ЇЖАК')).toBe('їжак')
    for (const word of ['ґанок', 'єдність', 'їжак', 'існує']) {
      expect(normaliseToken(word, 'uk')).toEqual({ ok: true, word })
    }
  })

  it('folds every apostrophe variant to U+0027 and rejects Russian-only letters', () => {
    for (const a of ['’', 'ʼ', '`', '‘', '´']) {
      expect(normaliseToken(`п${a}ять`, 'uk')).toEqual({ ok: true, word: "п'ять" })
    }
    expect(normaliseToken('объект', 'uk')).toEqual({ ok: false, reason: 'russian-letter' })
    expect(normaliseToken("'s", 'en')).toEqual({ ok: false, reason: 'bad-apostrophe' })
    expect(normaliseToken('fiancé', 'en')).toEqual({ ok: false, reason: 'foreign-letter' })
  })
})

describe('word analysis (requirements §5.3)', () => {
  it('reproduces the requirements example for навчання, with row changes counted per pair', () => {
    const a = analyseWord('навчання', layouts.yq)
    expect(a.characters).toEqual(['н', 'а', 'в', 'ч', 'а', 'н', 'н', 'я'])
    expect(a.bigrams).toEqual(['на', 'ав', 'вч', 'ча', 'ан', 'нн', 'ня'])
    // The example says 3, which is the number of distinct rows; adjacent row-changing pairs are 5.
    expect(a.difficulty).toEqual({ length: 8, sameFingerTransitions: 1, rowChanges: 5 })
  })

  it('round-trips a bank through the stored format', () => {
    const bank = bankOf(['навчання', "п'ять", 'будь-який', 'я'])
    const parsed = parseWordBank(JSON.parse(encodeWordBank(bank, 'yq')))
    expect(parsed).toEqual(bank)
  })

  it('weights an n-gram by the words it occurs in, once per word', () => {
    const { bigrams } = countNgrams([
      { word: 'нн', frequency: 5 },
      { word: 'ннн', frequency: 7 },
      { word: 'ан', frequency: 3 },
    ])
    expect(bigrams).toEqual([
      { ngram: 'нн', weight: 12, words: 2 },
      { ngram: 'ан', weight: 3, words: 1 },
    ])
  })
})
