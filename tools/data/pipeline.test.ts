import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { layouts } from '../../packages/curriculum/src/layout/index'
import {
  ALPHABETS,
  candidateWords,
  parseNgramTable,
  parseWordBank,
  type WordBank,
} from '../../packages/curriculum/src/words/index'
import { ChecksumError, decodeUtf8, parseChecksums, readVerified, sha256 } from './checksums'
import { FIRST_NAMES, isProfane, RESIDUAL_RUSSIAN } from './lists'
import { runPipeline } from './pipeline'

/**
 * The dictionary pipeline's guarantees (requirements §8.3, §8.5–§8.8).
 *
 * Two groups. The first reads only the committed `data/derived/`, so it runs everywhere, CI
 * included. The second needs the organisers' snapshot, which is never committed; it runs when the
 * snapshot is at `tasks/…/dictionaries` or `DICTIONARIES_DIR`, and skips cleanly otherwise.
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const derived = join(repoRoot, 'data/derived')
const snapshotDir =
  process.env['DICTIONARIES_DIR'] ?? join(repoRoot, 'tasks/Typing-Race-2026-Hackathon/dictionaries')
const hasSnapshot = existsSync(join(snapshotDir, 'CHECKSUMS.sha256'))

const read = (path: string) => readFileSync(join(derived, path), 'utf8')
const banks: Record<'uk' | 'en', WordBank> = {
  uk: parseWordBank(JSON.parse(read('uk/words.json'))),
  en: parseWordBank(JSON.parse(read('en/words.json'))),
}
const layoutOf = { uk: layouts.yq, en: layouts.qwerty } as const

describe('the committed word banks', () => {
  it.each(['uk', 'en'] as const)(
    '%s: a Stage 2 selection never contains a locked character (§8.3)',
    (lang) => {
      const layout = layoutOf[lang]
      fc.assert(
        fc.property(fc.integer({ min: 0, max: layout.unlockOrder.length }), (prefix) => {
          const unlocked = new Set([...layout.homeAnchors, ...layout.unlockOrder.slice(0, prefix)])
          const picked = candidateWords(banks[lang], { unlocked })
          const leaks = picked.filter((w) => w.characters.some((c) => !unlocked.has(c)))
          expect(leaks.map((w) => w.word)).toEqual([])
        }),
        { numRuns: 30 },
      )
    },
  )

  it.each(['uk', 'en'] as const)('%s: the first Stage 2 lesson has real words to type', (lang) => {
    const unlocked = layoutOf[lang].homeAnchors
    const words = candidateWords(banks[lang], { unlocked }).filter((w) => w.difficulty.length >= 2)
    expect(words.length).toBeGreaterThanOrEqual(15)
  })

  it('keeps і ї є ґ and only the language alphabets (§8.5)', () => {
    for (const lang of ['uk', 'en'] as const) {
      const allowed = new Set([...ALPHABETS[lang], "'", '-'])
      const strays = banks[lang].words.filter((w) => w.characters.some((c) => !allowed.has(c)))
      expect(strays.map((w) => w.word)).toEqual([])
    }
    const uk = banks.uk.words.map((w) => w.word)
    for (const letter of ['і', 'ї', 'є', 'ґ']) {
      expect(
        uk.some((w) => w.includes(letter)),
        letter,
      ).toBe(true)
    }
    for (const russian of ['что', 'это', 'как', 'нет', 'меня']) expect(uk).not.toContain(russian)
  })

  it('has no obscenity, sexual or insulting word, no lower-case first name and no known russism', () => {
    for (const lang of ['uk', 'en'] as const) {
      const words = banks[lang].words.map((w) => w.word)
      expect(
        words.filter((w) => isProfane(w, lang)),
        `${lang} profane`,
      ).toHaveLength(0)
      expect(
        words.filter((w) => FIRST_NAMES[lang].includes(w)),
        `${lang} names`,
      ).toEqual([])
    }
    const uk = new Set(banks.uk.words.map((w) => w.word))
    expect(RESIDUAL_RUSSIAN.filter((w) => uk.has(w))).toEqual([])
    // Read off the Stage 2 preview before the lists grew: each of these once showed up.
    for (const word of ['дупу', 'шлюха', 'лайна', 'придурок', 'джек', 'мужчина', 'плохого']) {
      expect(uk.has(word), word).toBe(false)
    }
    // Found by an independent audit in the words the focus drills reach: slang, slurs, russisms and
    // lower-case first names the first round of lists missed.
    const auditUk = ['чувак', 'знать', 'ухожу', 'дружище', 'засранець', 'трах', 'оргазм', 'повія']
    const auditUkMore = [
      'жид',
      'негр',
      'сучку',
      'козел',
      'яйця',
      'алан',
      'кларк',
      'біллі',
      'сперма',
    ]
    for (const word of [...auditUk, ...auditUkMore]) expect(uk.has(word), word).toBe(false)
    const en = new Set(banks.en.words.map((w) => w.word))
    for (const word of ['sex', 'sexy', 'balls', 'idiot', 'kill', 'john', 'jack']) {
      expect(en.has(word), word).toBe(false)
    }
    const auditEn = ['sperm', 'hookers', 'lesbian', 'masturbation', 'dildo', 'queer', 'rapist']
    const auditEnMore = ['crappy', 'farts', 'jerks', 'tit', 'cum', 'anal', 'semen', 'joey', 'molly']
    for (const word of [...auditEn, ...auditEnMore]) expect(en.has(word), word).toBe(false)
  })

  it('does not take innocent words down with the vulgar ones that sit inside them', () => {
    for (const word of ['страх', 'члени', 'яйце', 'жити', 'негативний']) {
      expect(isProfane(word, 'uk'), word).toBe(false)
    }
    const en = new Set(banks.en.words.map((w) => w.word))
    for (const word of [
      'basement',
      'therapist',
      'scraping',
      'analysis',
      'title',
      'class',
      'skill',
    ]) {
      expect(isProfane(word, 'en'), word).toBe(false)
    }
    expect(en.has('basement')).toBe(true)
  })

  it('matches the output checksums its report states', () => {
    for (const lang of ['uk', 'en'] as const) {
      const report = JSON.parse(read(`${lang}/report.json`))
      for (const file of ['words.json', 'ngrams.json']) {
        const bytes = readFileSync(join(derived, lang, file))
        expect(sha256(bytes), `${lang}/${file}`).toBe(report.outputs[file].sha256)
      }
      expect(() => parseNgramTable(JSON.parse(read(`${lang}/ngrams.json`)))).not.toThrow()
    }
  })
})

describe('checksums and encoding', () => {
  it('matches an NFD-named checksum entry to the NFC name on disk', () => {
    const nfd = 'ukrainian/texts/радіо.md'.normalize('NFD')
    const map = parseChecksums(`${'a'.repeat(64)}  dictionaries/${nfd}\n`)
    expect(map.get('ukrainian/texts/радіо.md')).toBe('a'.repeat(64))
  })

  it('refuses bytes that are not UTF-8 instead of guessing (§8.6)', () => {
    // `навчання` in Windows-1251.
    const cp1251 = new Uint8Array([0xed, 0xe0, 0xe2, 0xf7, 0xe0, 0xed, 0xed, 0xff])
    expect(() => decodeUtf8(cp1251)).toThrow()
    expect(decodeUtf8(new TextEncoder().encode('навчання ґ'))).toBe('навчання ґ')
  })
})

describe.skipIf(!hasSnapshot)('against the organisers’ snapshot', () => {
  const FREQUENCY = 'ukrainian/wordlists/frequencywords-2018/uk_50k.txt'

  it('reads the Ukrainian list as UTF-8: a known Cyrillic word round-trips (§8.6)', () => {
    const checksums = parseChecksums(
      decodeUtf8(readFileSync(join(snapshotDir, 'CHECKSUMS.sha256'))),
    )
    const text = decodeUtf8(readVerified(snapshotDir, FREQUENCY, checksums).content)
    const line = text.split('\n').find((l) => l.startsWith('навчання '))
    expect(line).toMatch(/^навчання \d+$/)
    expect(text).toContain('\nїх ')
  })

  it('catches a tampered input file (§8.7)', () => {
    const copy = mkdtempSync(join(tmpdir(), 'typing-race-snapshot-'))
    try {
      copyFileSync(join(snapshotDir, 'CHECKSUMS.sha256'), join(copy, 'CHECKSUMS.sha256'))
      mkdirSync(dirname(join(copy, FREQUENCY)), { recursive: true })
      copyFileSync(join(snapshotDir, FREQUENCY), join(copy, FREQUENCY))
      const checksums = parseChecksums(readFileSync(join(copy, 'CHECKSUMS.sha256'), 'utf8'))
      expect(() => readVerified(copy, FREQUENCY, checksums)).not.toThrow()

      const bytes = readFileSync(join(copy, FREQUENCY))
      bytes[0] = (bytes[0] as number) ^ 1
      writeFileSync(join(copy, FREQUENCY), bytes)
      expect(() => readVerified(copy, FREQUENCY, checksums)).toThrow(ChecksumError)
      expect(() => runPipeline(copy)).toThrow(ChecksumError)
    } finally {
      rmSync(copy, { recursive: true, force: true })
    }
  })

  it('produces byte-identical output on every run, equal to what is committed (§8.8)', () => {
    const first = runPipeline(snapshotDir)
    const second = runPipeline(snapshotDir)
    expect([...second]).toEqual([...first])
    for (const [path, content] of first) expect(content, path).toBe(read(path))
  }, 60_000)
})
