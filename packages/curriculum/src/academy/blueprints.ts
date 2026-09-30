import type { Language } from '@typing-race/domain'
import type { AcademyModuleKind, AcademyStep, Bilingual } from './types'

/**
 * The authored plan of each course: which modules, in which §3.3 order, filled from where.
 *
 * The organisers' course is the backbone — its exercises are named by id and regrouped here — and
 * every §3.3 row it does not cover is generated from our word data. Changing this file changes
 * `data/curriculum/<lang>/academy.json`; run `pnpm data` and commit the result.
 */

export type Part =
  | { readonly kind: 'organiser'; readonly ids: readonly string[] }
  /** Lessons of one knowledge collection, in file order: whole paragraphs or their first two sentences. */
  | {
      readonly kind: 'knowledge'
      readonly collection: string
      readonly limit: number
      readonly take: 'paragraph' | 'sentences'
    }
  | {
      readonly kind: 'bigrams' | 'trigrams' | 'sameFinger' | 'rolls' | 'doubles'
      readonly count: number
    }
  | { readonly kind: 'alternation' | 'apostrophe' | 'commaSeries'; readonly count: number }
  | {
      readonly kind: 'morphemes'
      readonly morphemes: readonly { readonly m: string; readonly at: 'start' | 'end' }[][]
    }
  | { readonly kind: 'words'; readonly count: number; readonly perExercise: number }
  | { readonly kind: 'tempo'; readonly targets: readonly number[] }

export interface Blueprint {
  readonly id: string
  readonly step: AcademyStep
  readonly kind: AcademyModuleKind
  readonly title: Bilingual
  readonly summary: Bilingual
  readonly parts: readonly Part[]
}

const org = (...ids: string[]): Part => ({ kind: 'organiser', ids })
const end = (m: string) => ({ m, at: 'end' as const })
const start = (m: string) => ({ m, at: 'start' as const })

/** Tempo series: 150 → 300 SPM, the Basic to Fast benchmarks of the level table. */
const TEMPO_LADDER = [150, 190, 225, 260, 300] as const

const uk: readonly Blueprint[] = [
  {
    id: 'warm-up',
    step: 'keys',
    kind: 'warmup',
    title: { uk: 'Розминка: ряди', en: 'Warm-up: the rows' },
    summary: {
      uk: 'Базовий ряд, дзеркальні пари й перші склади: руки стають на місце.',
      en: 'Home row, mirror pairs and first syllables: the hands find their place.',
    },
    parts: [org('u59', 'u60', 'u61', 'u62', 'u63', 'u64')],
  },
  {
    id: 'letters',
    step: 'keys',
    kind: 'letters',
    title: { uk: 'Літери, яких немає деінде', en: 'Letters found nowhere else' },
    summary: {
      uk: 'Ї, Й, Є, Ґ, І та И, Ю і Я, Ж і Ш у різних позиціях слова.',
      en: 'Ї, Й, Є, Ґ, І and И, Ю and Я, Ж and Ш in every position of a word.',
    },
    parts: [org('u5', 'u6', 'u7', 'u21', 'u17', 'u18', 'u49', 'u50')],
  },
  {
    id: 'bigrams',
    step: 'pairs',
    kind: 'bigrams',
    title: { uk: 'Найчастотніші біграми', en: 'The most frequent bigrams' },
    summary: {
      uk: 'Пари літер усередині слів, зважені частотою слів, у яких вони трапляються.',
      en: 'Letter pairs inside words, weighted by the frequency of the words that hold them.',
    },
    parts: [{ kind: 'bigrams', count: 6 }],
  },
  {
    id: 'same-finger',
    step: 'pairs',
    kind: 'sameFinger',
    title: { uk: 'Один палець, дві клавіші', en: 'One finger, two keys' },
    summary: {
      uk: 'Найчастіші переходи, які друкує той самий палець: найповільніше місце будь-якого тексту.',
      en: 'The most frequent moves typed by the same finger: the slowest spot in any text.',
    },
    parts: [{ kind: 'sameFinger', count: 4 }],
  },
  {
    id: 'rolls',
    step: 'pairs',
    kind: 'rolls',
    title: { uk: 'Перекати й чергування рук', en: 'Rolls and hand alternation' },
    summary: {
      uk: 'Сусідні пальці однієї руки підряд, а потім слова, де руки міняються на кожній літері.',
      en: 'Neighbouring fingers of one hand in a row, then words that switch hands on every letter.',
    },
    parts: [
      { kind: 'rolls', count: 4 },
      { kind: 'alternation', count: 3 },
    ],
  },
  {
    id: 'doubles',
    step: 'pairs',
    kind: 'doubles',
    title: { uk: 'Подвоєння', en: 'Double letters' },
    summary: {
      uk: 'Два однакові удари поспіль: рівно, без затримки між ними.',
      en: 'Two identical strokes in a row: even, with no pause between them.',
    },
    parts: [{ kind: 'doubles', count: 3 }, org('u52')],
  },
  {
    id: 'trigrams',
    step: 'morphemes',
    kind: 'trigrams',
    title: { uk: 'Найчастотніші триграми', en: 'The most frequent trigrams' },
    summary: {
      uk: 'Трійки літер, які найчастіше трапляються в словах: готові склади для пальців.',
      en: 'The letter triples most common in words: ready-made syllables for the fingers.',
    },
    parts: [{ kind: 'trigrams', count: 6 }],
  },
  {
    id: 'morphemes',
    step: 'morphemes',
    kind: 'morphemes',
    title: { uk: 'Суфікси, закінчення, префікси', en: 'Suffixes, endings, prefixes' },
    summary: {
      uk: 'Частини слова, що повторюються в тисячах слів: -ння, -ться, -ість, пере-, роз-.',
      en: 'Word parts repeated across thousands of words: -ння, -ться, -ість, пере-, роз-.',
    },
    parts: [
      org('u1', 'u2', 'u13', 'u33', 'u19'),
      {
        kind: 'morphemes',
        morphemes: [
          [end('ість'), end('ння')],
          [end('ого'), end('ому')],
          [start('пере'), start('при')],
          [end('ськ'), end('ати')],
        ],
      },
      org('u57'),
    ],
  },
  {
    id: 'clusters',
    step: 'morphemes',
    kind: 'clusters',
    title: { uk: 'Скупчення приголосних', en: 'Consonant clusters' },
    summary: {
      uk: 'Стр-, здр-, -ство, -ництво: кілька приголосних без голосної між ними.',
      en: 'Стр-, здр-, -ство, -ництво: several consonants with no vowel between them.',
    },
    parts: [org('u31', 'u32', 'u43', 'u44', 'u45', 'u46', 'u51')],
  },
  {
    id: 'words',
    step: 'words',
    kind: 'words',
    title: { uk: 'Найчастотніші слова', en: 'The most frequent words' },
    summary: {
      uk: 'Сотня слів, з яких складається половина будь-якого тексту.',
      en: 'The hundred words that make up half of any text.',
    },
    parts: [org('u39', 'u35', 'u36', 'u37'), { kind: 'words', count: 5, perExercise: 20 }],
  },
  {
    id: 'marks',
    step: 'phrases',
    kind: 'marks',
    title: { uk: 'Великі літери, апостроф, дефіс', en: 'Capitals, apostrophe, hyphen' },
    summary: {
      uk: 'Shift протилежною рукою, апостроф лівим мізинцем, дефіс правим.',
      en: 'Shift with the opposite hand, the apostrophe with the left pinky, the hyphen with the right.',
    },
    parts: [
      org('u26', 'u27', 'u28', 'u54', 'u9', 'u10'),
      { kind: 'apostrophe', count: 2 },
      org('u55'),
    ],
  },
  {
    id: 'punctuation',
    step: 'phrases',
    kind: 'punctuation',
    title: { uk: 'Кома, крапка, лапки, числа', en: 'Comma, full stop, quotes, numbers' },
    summary: {
      uk: 'Розділові знаки й цифри між словами, без зупинки ритму.',
      en: 'Punctuation and digits between words, without breaking the rhythm.',
    },
    parts: [org('u53'), { kind: 'commaSeries', count: 2 }, org('u56', 'u58')],
  },
  {
    id: 'sentences',
    step: 'sentences',
    kind: 'sentences',
    title: { uk: 'Речення', en: 'Sentences' },
    summary: {
      uk: 'Два речення поспіль: велика літера, розділові знаки, крапка в кінці.',
      en: 'Two sentences at a time: a capital, punctuation, a full stop at the end.',
    },
    parts: [{ kind: 'knowledge', collection: 'road-rules', limit: 8, take: 'sentences' }],
  },
  {
    id: 'paragraphs',
    step: 'text',
    kind: 'paragraphs',
    title: { uk: 'Абзаци', en: 'Paragraphs' },
    summary: {
      uk: 'Суцільний текст про кібергігієну: навичка переходить у справжнє письмо.',
      en: 'Continuous text on cyber hygiene: the skill carries over into real writing.',
    },
    parts: [{ kind: 'knowledge', collection: 'cyber-hygiene', limit: 8, take: 'paragraph' }],
  },
  {
    id: 'dictations',
    step: 'text',
    kind: 'paragraphs',
    title: { uk: 'Радіодиктанти національної єдності', en: 'National Unity radio dictations' },
    summary: {
      uk: 'Шістнадцять диктантів 2010-2025 років: довгий зв’язний текст.',
      en: 'Sixteen dictations from 2010 to 2025: long connected text.',
    },
    parts: [
      org(
        'u65',
        'u66',
        'u67',
        'u68',
        'u69',
        'u70',
        'u71',
        'u72',
        'u73',
        'u74',
        'u75',
        'u76',
        'u77',
        'u78',
        'u79',
        'u80',
      ),
    ],
  },
  {
    id: 'anthem',
    step: 'text',
    kind: 'paragraphs',
    title: { uk: 'Державний Гімн України', en: 'The State Anthem of Ukraine' },
    summary: {
      uk: 'Куплет, приспів і повний офіційний текст.',
      en: 'The verse, the chorus and the full official text.',
    },
    parts: [org('u81', 'u82', 'u83')],
  },
  {
    id: 'tempo',
    step: 'tempo',
    kind: 'tempo',
    title: { uk: 'Темпові серії', en: 'Tempo series' },
    summary: {
      uk: 'Короткі серії під метроном, від 150 до 300 знаків на хвилину. Точність важливіша.',
      en: 'Short series to a metronome, from 150 to 300 characters a minute. Accuracy first.',
    },
    parts: [org('u47', 'u48'), { kind: 'tempo', targets: TEMPO_LADDER }],
  },
]

const en: readonly Blueprint[] = [
  {
    id: 'warm-up',
    step: 'keys',
    kind: 'warmup',
    title: { uk: 'Розминка: ряди', en: 'Warm-up: the rows' },
    summary: {
      uk: 'Базовий ряд, верхній і нижній: руки стають на місце.',
      en: 'Home, top and bottom rows: the hands find their place.',
    },
    parts: [org('e1', 'e2', 'e68', 'e3', 'e69', 'e70', 'e4', 'e6', 'e5')],
  },
  {
    id: 'finger-control',
    step: 'keys',
    kind: 'warmup',
    title: { uk: 'Контроль пальців', en: 'Finger control' },
    summary: {
      uk: 'Ізоляція кожного пальця й дзеркальні рухи обох рук.',
      en: 'Each finger in isolation, then mirrored moves of both hands.',
    },
    parts: [org('e60', 'e61', 'e62', 'e63', 'e52', 'e53', 'e54', 'e55')],
  },
  {
    id: 'letters',
    step: 'keys',
    kind: 'letters',
    title: { uk: 'Слабкі літери й вертикалі', en: 'Weak letters and vertical reaches' },
    summary: {
      uk: 'Q, X, Z, J, K і стовпчики клавіш, які палець проходить згори донизу.',
      en: 'Q, X, Z, J, K and the key columns a finger travels top to bottom.',
    },
    parts: [org('e18', 'e19', 'e20', 'e36', 'e37', 'e38', 'e39')],
  },
  {
    id: 'bigrams',
    step: 'pairs',
    kind: 'bigrams',
    title: { uk: 'Найчастотніші біграми', en: 'The most frequent bigrams' },
    summary: {
      uk: 'Пари літер усередині слів, зважені частотою слів, у яких вони трапляються.',
      en: 'Letter pairs inside words, weighted by the frequency of the words that hold them.',
    },
    parts: [{ kind: 'bigrams', count: 6 }, org('e32', 'e34')],
  },
  {
    id: 'same-finger',
    step: 'pairs',
    kind: 'sameFinger',
    title: { uk: 'Один палець, дві клавіші', en: 'One finger, two keys' },
    summary: {
      uk: 'Найчастіші переходи, які друкує той самий палець: найповільніше місце будь-якого тексту.',
      en: 'The most frequent moves typed by the same finger: the slowest spot in any text.',
    },
    parts: [{ kind: 'sameFinger', count: 4 }, org('e40', 'e41', 'e42', 'e43')],
  },
  {
    id: 'rolls',
    step: 'pairs',
    kind: 'rolls',
    title: { uk: 'Перекати й чергування рук', en: 'Rolls and hand alternation' },
    summary: {
      uk: 'Сусідні пальці однієї руки підряд, а потім слова, де руки міняються на кожній літері.',
      en: 'Neighbouring fingers of one hand in a row, then words that switch hands on every letter.',
    },
    parts: [
      org('e28', 'e29', 'e30', 'e31'),
      { kind: 'rolls', count: 3 },
      org('e56'),
      { kind: 'alternation', count: 2 },
    ],
  },
  {
    id: 'doubles',
    step: 'pairs',
    kind: 'doubles',
    title: { uk: 'Подвоєння', en: 'Double letters' },
    summary: {
      uk: 'Два однакові удари поспіль: рівно, без затримки між ними.',
      en: 'Two identical strokes in a row: even, with no pause between them.',
    },
    parts: [{ kind: 'doubles', count: 3 }, org('e21')],
  },
  {
    id: 'trigrams',
    step: 'morphemes',
    kind: 'trigrams',
    title: { uk: 'Найчастотніші триграми', en: 'The most frequent trigrams' },
    summary: {
      uk: 'Трійки літер, які найчастіше трапляються в словах: готові склади для пальців.',
      en: 'The letter triples most common in words: ready-made syllables for the fingers.',
    },
    parts: [{ kind: 'trigrams', count: 6 }, org('e33', 'e35')],
  },
  {
    id: 'morphemes',
    step: 'morphemes',
    kind: 'morphemes',
    title: { uk: 'Суфікси, закінчення, префікси', en: 'Suffixes, endings, prefixes' },
    summary: {
      uk: 'Частини слова, що повторюються в тисячах слів: -ing, -tion, -ly, un-, re-.',
      en: 'Word parts repeated across thousands of words: -ing, -tion, -ly, un-, re-.',
    },
    parts: [
      org('e44', 'e13'),
      {
        kind: 'morphemes',
        morphemes: [
          [end('ing'), end('ed')],
          [end('tion'), end('ment')],
          [end('ly'), end('ness')],
          [start('un'), start('re')],
        ],
      },
    ],
  },
  {
    id: 'clusters',
    step: 'morphemes',
    kind: 'clusters',
    title: { uk: 'Скупчення приголосних', en: 'Consonant clusters' },
    summary: {
      uk: 'Str-, -ght, thr-, scr-: кілька приголосних без голосної між ними.',
      en: 'Str-, -ght, thr-, scr-: several consonants with no vowel between them.',
    },
    parts: [org('e12', 'e14', 'e15', 'e27')],
  },
  {
    id: 'words',
    step: 'words',
    kind: 'words',
    title: { uk: 'Найчастотніші слова', en: 'The most frequent words' },
    summary: {
      uk: 'Сотня слів, з яких складається половина будь-якого тексту.',
      en: 'The hundred words that make up half of any text.',
    },
    parts: [org('e8'), { kind: 'words', count: 5, perExercise: 20 }],
  },
  {
    id: 'marks',
    step: 'phrases',
    kind: 'marks',
    title: { uk: 'Великі літери, апостроф, дефіс', en: 'Capitals, apostrophe, hyphen' },
    summary: {
      uk: 'Shift протилежною рукою, апостроф і дефіс правим мізинцем.',
      en: 'Shift with the opposite hand, the apostrophe and hyphen with the right pinky.',
    },
    parts: [org('e23', 'e45', 'e24'), { kind: 'apostrophe', count: 1 }],
  },
  {
    id: 'punctuation',
    step: 'phrases',
    kind: 'punctuation',
    title: { uk: 'Кома, крапка, лапки, числа', en: 'Comma, full stop, quotes, numbers' },
    summary: {
      uk: 'Розділові знаки й цифри між словами, без зупинки ритму.',
      en: 'Punctuation and digits between words, without breaking the rhythm.',
    },
    parts: [org('e22', 'e46', 'e47'), { kind: 'commaSeries', count: 2 }, org('e25', 'e26', 'e11')],
  },
  {
    id: 'sentences',
    step: 'sentences',
    kind: 'sentences',
    title: { uk: 'Речення', en: 'Sentences' },
    summary: {
      uk: 'Два речення поспіль: велика літера, розділові знаки, крапка в кінці.',
      en: 'Two sentences at a time: a capital, punctuation, a full stop at the end.',
    },
    parts: [
      org('e7', 'e10'),
      { kind: 'knowledge', collection: 'english', limit: 6, take: 'sentences' },
    ],
  },
  {
    id: 'paragraphs',
    step: 'text',
    kind: 'paragraphs',
    title: { uk: 'Абзаци', en: 'Paragraphs' },
    summary: {
      uk: 'Джером, Лікок, Твен, Сакі: суцільний текст із гумором.',
      en: 'Jerome, Leacock, Twain, Saki: continuous text with a sense of humour.',
    },
    parts: [{ kind: 'knowledge', collection: 'english-humour', limit: 8, take: 'paragraph' }],
  },
  {
    id: 'civic-classics',
    step: 'text',
    kind: 'paragraphs',
    title: { uk: 'Класичні промови й документи', en: 'Civic classics' },
    summary: {
      uk: 'Декларація незалежності, Геттисберзька промова, Мілль, Дуглас, Панкгерст.',
      en: 'The Declaration of Independence, the Gettysburg Address, Mill, Douglass, Pankhurst.',
    },
    parts: [
      org(
        'e71',
        'e72',
        'e73',
        'e74',
        'e75',
        'e76',
        'e77',
        'e78',
        'e79',
        'e80',
        'e81',
        'e82',
        'e83',
      ),
    ],
  },
  {
    id: 'tempo',
    step: 'tempo',
    kind: 'tempo',
    title: { uk: 'Темпові серії', en: 'Tempo series' },
    summary: {
      uk: 'Короткі серії під метроном, від 150 до 300 знаків на хвилину. Точність важливіша.',
      en: 'Short series to a metronome, from 150 to 300 characters a minute. Accuracy first.',
    },
    parts: [org('e16', 'e17', 'e64', 'e67'), { kind: 'tempo', targets: TEMPO_LADDER }],
  },
]

export const blueprints: Readonly<Record<Language, readonly Blueprint[]>> = { uk, en }
