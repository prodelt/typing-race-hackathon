import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ChecksumError, decodeUtf8, parseChecksums, readVerified, sha256 } from './checksums'
import { runPipeline } from './pipeline'

/**
 * Requirements §8.6, §8.7 and §8.8 on a snapshot this file writes itself.
 *
 * The organisers' dictionaries are never committed, so the same three checks in `pipeline.test.ts`
 * skip in a clean clone and CI. These run everywhere: seven tiny files at the paths the pipeline
 * reads, a real `CHECKSUMS.sha256`, and the whole pipeline over them. Nothing here depends on the
 * organisers' data, so a failure is the pipeline's, not the snapshot's.
 */

const FILES: Readonly<Record<string, string>> = {
  'ukrainian/wordlists/frequencywords-2018/uk_50k.txt': [
    'я 900',
    'не 800',
    'їжак 120',
    'ґанок 90',
    'є 70',
    'що 60',
    'ты 50', // Russian letters: dropped by the character filter
    'сука 40', // an obscenity: dropped by the stoplist
    'кіт 30',
    'навчання 20',
    '',
  ].join('\n'),
  'ukrainian/wordlists/hunspell-uk/index.aff': 'SET UTF-8\n',
  'ukrainian/wordlists/hunspell-uk/index.dic': [
    '8',
    'я',
    'не',
    'їжак',
    'ґанок',
    'є',
    'що',
    'сука',
    'кіт',
    'навчання',
    '',
  ].join('\n'),
  'english/wordlists/frequencywords-2018/en_50k.txt': [
    'the 900',
    'you 800',
    'sex 120',
    'typing 90',
    'cat 80',
    'xyzzy 70', // not a word in either dictionary
    '',
  ].join('\n'),
  'english/wordlists/hunspell-en/index.aff': 'SET UTF-8\n',
  'english/wordlists/hunspell-en/index.dic': ['5', 'the', 'you', 'sex', 'typing', 'cat', ''].join(
    '\n',
  ),
  'english/wordlists/dwyl-english-words/words_alpha.txt': 'the\nyou\nsex\ntyping\ncat\n',
}

let dir = ''

function writeSnapshot(target: string): void {
  const lines: string[] = []
  for (const [path, content] of Object.entries(FILES)) {
    const full = join(target, path)
    mkdirSync(dirname(full), { recursive: true })
    const bytes = new TextEncoder().encode(content)
    writeFileSync(full, bytes)
    lines.push(`${sha256(bytes)}  dictionaries/${path}`)
  }
  writeFileSync(join(target, 'CHECKSUMS.sha256'), `${lines.join('\n')}\n`)
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'typing-race-synthetic-'))
  writeSnapshot(dir)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const wordsOf = (output: ReadonlyMap<string, string>, lang: 'uk' | 'en'): string[] => {
  const bank = JSON.parse(output.get(`${lang}/words.json`) as string) as {
    words: [string, ...unknown[]][]
  }
  return bank.words.map((row) => row[0])
}

describe('the pipeline on a snapshot written by the test', () => {
  it('reads Cyrillic as UTF-8 and keeps і ї є ґ as they are (§8.6)', () => {
    const uk = wordsOf(runPipeline(dir), 'uk')
    for (const word of ['їжак', 'ґанок', 'є', 'кіт', 'навчання']) expect(uk, word).toContain(word)
    // No letter was folded into a look-alike on the way through.
    expect(uk.some((word) => /[іїєґ]/u.test(word))).toBe(true)
    expect(uk.join('')).not.toMatch(/[ыэъё]/u)
  })

  it('drops what the filters are there to drop', () => {
    const output = runPipeline(dir)
    const uk = wordsOf(output, 'uk')
    expect(uk).not.toContain('ты')
    expect(uk).not.toContain('сука')
    const en = wordsOf(output, 'en')
    expect(en).not.toContain('sex')
    expect(en).not.toContain('xyzzy')
    expect(en).toContain('typing')
  })

  it('refuses an input whose bytes are not UTF-8 instead of guessing (§8.6)', () => {
    // `навчання` in Windows-1251.
    const cp1251 = new Uint8Array([0xed, 0xe0, 0xe2, 0xf7, 0xe0, 0xed, 0xed, 0xff])
    expect(() => decodeUtf8(cp1251)).toThrow()
  })

  it('catches a tampered input before deriving anything from it (§8.7)', () => {
    const copy = mkdtempSync(join(tmpdir(), 'typing-race-tamper-'))
    try {
      writeSnapshot(copy)
      const path = 'ukrainian/wordlists/frequencywords-2018/uk_50k.txt'
      const checksums = parseChecksums(readFileSync(join(copy, 'CHECKSUMS.sha256'), 'utf8'))
      expect(() => readVerified(copy, path, checksums)).not.toThrow()
      expect(() => runPipeline(copy)).not.toThrow()

      const bytes = readFileSync(join(copy, path))
      bytes[0] = (bytes[0] as number) ^ 1
      writeFileSync(join(copy, path), bytes)
      expect(() => readVerified(copy, path, checksums)).toThrow(ChecksumError)
      expect(() => runPipeline(copy)).toThrow(ChecksumError)
    } finally {
      rmSync(copy, { recursive: true, force: true })
    }
  })

  it('produces byte-identical output on every run, wherever the snapshot lives (§8.8)', () => {
    const other = mkdtempSync(join(tmpdir(), 'typing-race-elsewhere-'))
    try {
      writeSnapshot(other)
      const first = runPipeline(dir)
      const second = runPipeline(dir)
      const elsewhere = runPipeline(other)
      expect([...second]).toEqual([...first])
      expect([...elsewhere]).toEqual([...first])
      expect(first.size).toBe(6)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})
