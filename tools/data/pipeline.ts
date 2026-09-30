import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { layouts } from '../../packages/curriculum/src/layout/index'
import {
  analyseWord,
  countNgrams,
  difficultyTier,
  encodeNgramTable,
  encodeWordBank,
  normaliseToken,
  type RejectReason,
  type WordFlag,
  type WordRecord,
} from '../../packages/curriculum/src/words/index'
import type { Language, Layout } from '../../packages/domain/src/index'
import { decodeUtf8, parseChecksums, readVerified, sha256, type VerifiedFile } from './checksums'
import { Hunspell } from './hunspell'
import {
  CONTRACTION_FRAGMENTS,
  HYPHEN_PARTICLES,
  isProfane,
  RESIDUAL_RUSSIAN,
  SINGLE_LETTER_WORDS,
} from './lists'

/**
 * The dictionary pipeline: organiser snapshot in, `data/derived/<lang>/{words,ngrams,report}.json`
 * out. Deterministic by construction — integer arithmetic, code-unit sorting, fixed key order, no
 * timestamps — so two runs over the same snapshot are byte-identical (requirements §8.8).
 *
 * Bump ALGORITHM_VERSION whenever a rule below changes what comes out.
 */
export const ALGORITHM_VERSION = '1.0.0'

/** Words kept per language, most frequent first. Stage 2 and the Academy never need more. */
export const WORD_LIMIT = 20_000
/** Trigrams kept per language, heaviest first. All bigrams are kept (there are under a thousand). */
export const TRIGRAM_LIMIT = 4_000

interface LanguageSpec {
  readonly language: Language
  readonly layout: Layout
  readonly source: string
  readonly frequency: { readonly id: string; readonly path: string; readonly license: string }
  readonly hunspell: {
    readonly id: string
    readonly aff: string
    readonly dic: string
    readonly license: string
  }
  readonly wordList?: { readonly id: string; readonly path: string; readonly license: string }
}

const FREQUENCY_LICENSE =
  'CC BY-SA 4.0 (content, per upstream README); MIT (code, vendored LICENSE)'

export const LANGUAGES: readonly LanguageSpec[] = [
  {
    language: 'uk',
    layout: layouts.yq,
    source: 'frequencywords-2018-uk',
    frequency: {
      id: 'frequencywords-uk',
      path: 'ukrainian/wordlists/frequencywords-2018/uk_50k.txt',
      license: FREQUENCY_LICENSE,
    },
    hunspell: {
      id: 'hunspell-uk',
      aff: 'ukrainian/wordlists/hunspell-uk/index.aff',
      dic: 'ukrainian/wordlists/hunspell-uk/index.dic',
      license:
        'GPL-3.0 as packaged (brown-uk/dict_uk via wooorm/dictionaries); build-time filter only',
    },
  },
  {
    language: 'en',
    layout: layouts.qwerty,
    source: 'frequencywords-2018-en',
    frequency: {
      id: 'frequencywords-en',
      path: 'english/wordlists/frequencywords-2018/en_50k.txt',
      license: FREQUENCY_LICENSE,
    },
    hunspell: {
      id: 'hunspell-en',
      aff: 'english/wordlists/hunspell-en/index.aff',
      dic: 'english/wordlists/hunspell-en/index.dic',
      license:
        'SCOWL (c) Kevin Atkinson, permissive with notice; packaging MIT (wooorm/dictionaries)',
    },
    wordList: {
      id: 'dwyl-english-words',
      path: 'english/wordlists/dwyl-english-words/words_alpha.txt',
      license: 'Unlicense',
    },
  },
]

/** The rules, as the report states them (requirements §5.2). */
const RULES = {
  unicode:
    'Strict UTF-8 decoding (an invalid byte aborts the run), then NFC. Never NFKC. і ї є ґ are never mapped to other letters.',
  case: 'Lower-cased. Sources are all lower case already; words the spelling dictionary knows only capitalised are proper nouns and are dropped.',
  apostrophe:
    "U+2019, U+02BC, U+0060, U+2018 and U+00B4 fold to U+0027. An apostrophe must sit between two letters. Ukrainian: when a word is not in the dictionary but the same word with an apostrophe inserted before я/ю/є/ї after a consonant is (пять -> п'ять), the apostrophised form is kept and flagged apostrophe-restored.",
  hyphen:
    'A hyphen must sit between two letters, never doubled. A hyphenated word is kept only if the dictionary lists the whole form, or (Ukrainian) it is a word plus the particle -небудь or -таки.',
  stress: 'Combining acute accents (U+0301) are removed.',
  charset: {
    uk: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя plus apostrophe and hyphen; tokens with ы э ъ ё are Russian and dropped; Latin letters, digits and other symbols are dropped.',
    en: 'a-z plus apostrophe and hyphen; digits, non-ASCII letters and other symbols are dropped.',
  },
  singleLetters: 'Only one-letter real words are kept: uk а в є ж з і й о у я; en a.',
  dedupe:
    'Raw tokens that normalise to the same word are merged and their counts summed. Sorted by frequency, then by UTF-16 code units (never locale collation).',
  dictionary:
    'uk: must be produced by hunspell-uk (reverse affix lookup, lower case). en: must be produced by hunspell-en in lower case AND, unless it has an apostrophe or hyphen (which dwyl never has), be listed in dwyl words_alpha. The dictionaries only answer yes/no; no word is taken from them.',
  properNouns:
    'A token the dictionary produces only in capitalised form (джон -> Джон, english -> English) is a proper noun and dropped.',
  stoplists:
    'uk: residual Russian that shares a spelling with a rare Ukrainian form. en: contraction halves (don, didn, isn…). Both: an authored profanity list (roots and exact words); en also drops anything hunspell-en marks NOSUGGEST. Hyphenated reduplications (ха-ха) and single-letter parts (е-е, м-р; з and о excepted) are dropped as noise, and so are words of two or more letters with no vowel (хм, ll, tv).',
  ranking: `Most frequent ${WORD_LIMIT} words are written. N-grams are counted over every surviving word, each word counted once, weighted by its frequency; the ${TRIGRAM_LIMIT} heaviest trigrams are written.`,
  difficulty:
    'sameFingerTransitions: adjacent pairs typed by the same finger, repeated keys included. rowChanges: adjacent pairs on different rows. tier 1-5: ceil((rank band + length band) / 2) with rank bands 500/2000/5000/10000 and length bands 3/5/7/9.',
} as const

interface Step {
  readonly step: string
  readonly kept: number
  readonly removed: Record<string, number>
  readonly examples?: Record<string, string[]>
}

interface Candidate {
  word: string
  frequency: number
  restored: boolean
}

const VOWELS_AND_SOFT = new Set("аеєиіїоуюяьй-'".split(''))
const IOTATED = new Set(['я', 'ю', 'є', 'ї'])

/** A word of two or more letters with no vowel is an interjection or abbreviation (`хм`, `ll`, `tv`). */
const VOWELS: Readonly<Record<Language, RegExp>> = { uk: /[аеєиіїоуюя]/, en: /[aeiouy]/ }

/**
 * Hyphenated tokens the dictionary lists but a typing exercise should not: reduplications
 * (`ха-ха`, `ні-ні`, `бла-бла-бла`) and single-letter parts (`е-е`, `м-р`), except the real
 * one-letter parts of `з-під`, `із-за`, `пліч-о-пліч`.
 */
function isHyphenNoise(word: string): boolean {
  if (!word.includes('-')) return false
  const parts = word.split('-')
  if (parts.every((p) => p === parts[0])) return true
  return parts.some((p) => [...p].length === 1 && p !== 'з' && p !== 'о')
}

function capitalise(word: string): string {
  return word
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-')
}

function parseFrequencyList(text: string, path: string): { token: string; count: number }[] {
  const records: { token: string; count: number }[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] as string).replace(/\r$/, '')
    if (line === '') continue
    const space = line.lastIndexOf(' ')
    const count = Number(line.slice(space + 1))
    if (space <= 0 || !Number.isSafeInteger(count) || count <= 0) {
      throw new Error(`${path}:${i + 1}: expected "word count", got ${JSON.stringify(line)}`)
    }
    records.push({ token: line.slice(0, space), count })
  }
  return records
}

function byFrequency(
  a: { word: string; frequency: number },
  b: { word: string; frequency: number },
) {
  if (a.frequency !== b.frequency) return b.frequency - a.frequency
  return a.word < b.word ? -1 : a.word > b.word ? 1 : 0
}

/** The most frequent removed words per reason, for the report — lets a reader audit a rule. */
function examplesOf(removed: Map<string, Candidate[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const reason of [...removed.keys()].sort()) {
    out[reason] = (removed.get(reason) as Candidate[])
      .sort(byFrequency)
      .slice(0, 15)
      .map((c) => c.word)
  }
  return out
}

function tally(removed: Map<string, Candidate[]>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const reason of [...removed.keys()].sort())
    out[reason] = (removed.get(reason) as Candidate[]).length
  return out
}

function push(map: Map<string, Candidate[]>, reason: string, candidate: Candidate) {
  const list = map.get(reason) ?? []
  list.push(candidate)
  map.set(reason, list)
}

const FLAG_ORDER: readonly WordFlag[] = [
  'apostrophe',
  'apostrophe-restored',
  'hyphen',
  'double-letter',
  'uk-letter',
]

function processLanguage(spec: LanguageSpec, snapshotDir: string, checksums: Map<string, string>) {
  const inputs: VerifiedFile[] = []
  const read = (path: string) => {
    const file = readVerified(snapshotDir, path, checksums)
    inputs.push(file)
    return decodeUtf8(file.content)
  }
  const frequencyText = read(spec.frequency.path)
  const hunspell = new Hunspell(read(spec.hunspell.aff), read(spec.hunspell.dic))
  const wordList =
    spec.wordList === undefined
      ? undefined
      : new Set(
          read(spec.wordList.path)
            .split('\n')
            .map((l) => l.replace(/\r$/, '').trim())
            .filter((l) => l !== ''),
        )

  const steps: Step[] = []
  const raw = parseFrequencyList(frequencyText, spec.frequency.path)
  steps.push({ step: 'read', kept: raw.length, removed: {} })

  // 1. Normalise and check characters; merge tokens that normalise to the same word.
  const rejected = new Map<string, Candidate[]>()
  const merged = new Map<string, Candidate>()
  let mergedCount = 0
  for (const { token, count } of raw) {
    const result = normaliseToken(token, spec.language)
    if (!result.ok) {
      push(rejected, result.reason satisfies RejectReason, {
        word: token,
        frequency: count,
        restored: false,
      })
      continue
    }
    const word = result.word
    if ([...word].length === 1 && !SINGLE_LETTER_WORDS[spec.language].includes(word)) {
      push(rejected, 'single-letter', { word, frequency: count, restored: false })
      continue
    }
    const existing = merged.get(word)
    if (existing === undefined) merged.set(word, { word, frequency: count, restored: false })
    else {
      existing.frequency += count
      mergedCount++
    }
  }
  steps.push({
    step: 'normalise, character rules, single letters',
    kept: raw.length - [...rejected.values()].reduce((n, l) => n + l.length, 0),
    removed: tally(rejected),
    examples: examplesOf(rejected),
  })
  steps.push({ step: 'dedupe', kept: merged.size, removed: { 'merged-duplicate': mergedCount } })

  // 2. The spelling dictionary: real word, restored apostrophe, proper noun, or nothing.
  const notWords = new Map<string, Candidate[]>()
  const taboo = new Set<string>()
  const accepted: Candidate[] = []
  let restoredCount = 0
  const known = (word: string) => {
    const whole = hunspell.lookup(word)
    if (whole.found || spec.language !== 'uk' || !word.includes('-')) return whole
    const parts = word.split('-')
    const found =
      parts.length === 2 &&
      HYPHEN_PARTICLES.includes(parts[1] as string) &&
      hunspell.lookup(parts[0] as string).found
    return { found, taboo: false }
  }
  const restoreApostrophe = (word: string): string | undefined => {
    const chars = [...word]
    for (let i = 1; i < chars.length; i++) {
      if (!IOTATED.has(chars[i] as string) || VOWELS_AND_SOFT.has(chars[i - 1] as string)) continue
      const candidate = [...chars.slice(0, i), "'", ...chars.slice(i)].join('')
      if (hunspell.lookup(candidate).found) return candidate
    }
    return undefined
  }
  for (const candidate of [...merged.values()].sort(byFrequency)) {
    const direct = known(candidate.word)
    if (direct.found) {
      if (direct.taboo) taboo.add(candidate.word)
      accepted.push(candidate)
      continue
    }
    const restored = spec.language === 'uk' ? restoreApostrophe(candidate.word) : undefined
    if (restored !== undefined) {
      restoredCount++
      accepted.push({ word: restored, frequency: candidate.frequency, restored: true })
      continue
    }
    const proper = hunspell.lookup(capitalise(candidate.word)).found
    push(notWords, proper ? 'proper-noun' : 'not-in-dictionary', candidate)
  }
  steps.push({
    step: `dictionary (${spec.hunspell.id})`,
    kept: accepted.length,
    removed: tally(notWords),
    examples: {
      ...examplesOf(notWords),
      'apostrophe-restored': accepted
        .filter((c) => c.restored)
        .slice(0, 15)
        .map((c) => c.word),
    },
  })
  steps.push({
    step: 'apostrophe restoration',
    kept: accepted.length,
    removed: { restored: restoredCount },
  })

  // 3. English only: a second, independent word list.
  let pool = accepted
  if (wordList !== undefined && spec.wordList !== undefined) {
    const missing = new Map<string, Candidate[]>()
    pool = accepted.filter((c) => {
      // The list has no apostrophes or hyphens at all, so it can only vote on plain words.
      if (wordList.has(c.word) || /['-]/.test(c.word)) return true
      push(missing, 'not-in-word-list', c)
      return false
    })
    steps.push({
      step: `word list (${spec.wordList.id})`,
      kept: pool.length,
      removed: tally(missing),
      examples: examplesOf(missing),
    })
  }

  // 4. Stoplists.
  const stopped = new Map<string, Candidate[]>()
  pool = pool.filter((c) => {
    if (taboo.has(c.word) || isProfane(c.word, spec.language)) push(stopped, 'profanity', c)
    else if (spec.language === 'uk' && RESIDUAL_RUSSIAN.includes(c.word))
      push(stopped, 'residual-russian', c)
    else if (spec.language === 'en' && CONTRACTION_FRAGMENTS.includes(c.word)) {
      push(stopped, 'contraction-fragment', c)
    } else if (isHyphenNoise(c.word)) push(stopped, 'hyphen-noise', c)
    else if ([...c.word].length > 1 && !VOWELS[spec.language].test(c.word)) {
      push(stopped, 'no-vowel', c)
    } else return true
    return false
  })
  const stoppedExamples = examplesOf(stopped)
  // Profanity is counted, never printed.
  delete stoppedExamples['profanity']
  steps.push({
    step: 'stoplists',
    kept: pool.length,
    removed: tally(stopped),
    examples: stoppedExamples,
  })

  // 5. A restored apostrophe can produce a word that is already present: merge again.
  const final = new Map<string, Candidate>()
  let remerged = 0
  for (const c of pool) {
    const existing = final.get(c.word)
    if (existing === undefined) final.set(c.word, { ...c })
    else {
      existing.frequency += c.frequency
      existing.restored = existing.restored || c.restored
      remerged++
    }
  }
  const survivors = [...final.values()].sort(byFrequency)
  steps.push({
    step: 'dedupe after restoration',
    kept: survivors.length,
    removed: { 'merged-duplicate': remerged },
  })

  const kept = survivors.slice(0, WORD_LIMIT)
  steps.push({
    step: `keep the ${WORD_LIMIT} most frequent`,
    kept: kept.length,
    removed: { 'below-cut': survivors.length - kept.length },
  })

  const words: WordRecord[] = kept.map((c, index) => {
    const analysis = analyseWord(c.word, spec.layout)
    const flags = new Set<WordFlag>(analysis.flags)
    if (c.restored) flags.add('apostrophe-restored')
    return {
      word: c.word,
      language: spec.language,
      frequency: c.frequency,
      rank: index + 1,
      source: spec.source,
      characters: analysis.characters,
      bigrams: analysis.bigrams,
      difficulty: {
        ...analysis.difficulty,
        tier: difficultyTier(index + 1, analysis.difficulty.length),
      },
      flags: FLAG_ORDER.filter((f) => flags.has(f)),
    }
  })

  const ngrams = countNgrams(survivors)
  const wordsJson = encodeWordBank(
    { language: spec.language, source: spec.source, algorithmVersion: ALGORITHM_VERSION, words },
    spec.layout.id,
  )
  const ngramsJson = encodeNgramTable({
    language: spec.language,
    source: spec.source,
    algorithmVersion: ALGORITHM_VERSION,
    bigrams: ngrams.bigrams,
    trigrams: ngrams.trigrams.slice(0, TRIGRAM_LIMIT),
  })

  const histogram = (values: number[]) => {
    const out: Record<string, number> = {}
    for (const v of [...values].sort((a, b) => a - b)) out[String(v)] = (out[String(v)] ?? 0) + 1
    return out
  }
  const flagCounts: Record<string, number> = {}
  for (const f of FLAG_ORDER) flagCounts[f] = words.filter((w) => w.flags.includes(f)).length

  const report = {
    format: 'typing-race/data-report@1',
    language: spec.language,
    layout: spec.layout.id,
    algorithmVersion: ALGORITHM_VERSION,
    inputs: inputs.map((file) => ({
      path: file.path,
      sha256: file.sha256,
      bytes: file.bytes,
      dataset:
        file.path === spec.frequency.path
          ? spec.frequency.id
          : file.path === spec.wordList?.path
            ? spec.wordList.id
            : spec.hunspell.id,
      license:
        file.path === spec.frequency.path
          ? spec.frequency.license
          : file.path === spec.wordList?.path
            ? spec.wordList.license
            : spec.hunspell.license,
    })),
    rules: {
      unicode: RULES.unicode,
      case: RULES.case,
      apostrophe: RULES.apostrophe,
      hyphen: RULES.hyphen,
      stress: RULES.stress,
      charset: RULES.charset[spec.language],
      singleLetters: RULES.singleLetters,
      dedupe: RULES.dedupe,
      dictionary: RULES.dictionary,
      properNouns: RULES.properNouns,
      stoplists: RULES.stoplists,
      ranking: RULES.ranking,
      difficulty: RULES.difficulty,
    },
    steps,
    counts: {
      before: raw.length,
      afterFiltering: survivors.length,
      written: words.length,
      bigrams: ngrams.bigrams.length,
      trigramsCounted: ngrams.trigrams.length,
      trigramsWritten: Math.min(TRIGRAM_LIMIT, ngrams.trigrams.length),
    },
    written: {
      byLength: histogram(words.map((w) => w.difficulty.length)),
      byTier: histogram(words.map((w) => w.difficulty.tier)),
      flags: flagCounts,
    },
    outputs: {
      'words.json': { sha256: sha256(new TextEncoder().encode(wordsJson)) },
      'ngrams.json': { sha256: sha256(new TextEncoder().encode(ngramsJson)) },
    },
  }

  return {
    [`${spec.language}/words.json`]: wordsJson,
    [`${spec.language}/ngrams.json`]: ngramsJson,
    [`${spec.language}/report.json`]: `${JSON.stringify(report, null, 2)}\n`,
  }
}

/**
 * Runs the whole pipeline in memory. Returns file contents keyed by path under `data/derived/`.
 * Throws `ChecksumError` before deriving anything from a file whose hash does not match.
 */
export function runPipeline(snapshotDir: string): Map<string, string> {
  const checksums = parseChecksums(decodeUtf8(readFileSync(join(snapshotDir, 'CHECKSUMS.sha256'))))
  const files = new Map<string, string>()
  for (const spec of LANGUAGES) {
    for (const [path, content] of Object.entries(processLanguage(spec, snapshotDir, checksums))) {
      files.set(path, content)
    }
  }
  return files
}

export function writeOutput(outDir: string, files: ReadonlyMap<string, string>): void {
  for (const [path, content] of files) {
    const target = join(outDir, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  }
}
