import type { Language } from '../../packages/domain/src/index'

/**
 * Hand-kept word lists the pipeline applies after the dictionary filter. Authored for this project;
 * each list is short enough to review in one sitting, and every entry has a reason.
 */

/** One-letter tokens that are real words. Every other single letter is a stray keystroke. */
export const SINGLE_LETTER_WORDS: Readonly<Record<Language, readonly string[]>> = {
  uk: ['а', 'в', 'є', 'ж', 'з', 'і', 'й', 'о', 'у', 'я'],
  // `i` is only ever `I`, and the bank is lower case.
  en: ['a'],
}

/**
 * Russian words the Ukrainian dictionary accepts because a Ukrainian word has the same spelling
 * (`но` is an interjection, `его` an archaic form, `мне` a dialect one). FrequencyWords' Ukrainian
 * list is built from subtitles and carries plenty of Russian; these are the ones the spelling
 * filter cannot see, found by reading the most frequent survivors.
 */
export const RESIDUAL_RUSSIAN: readonly string[] = [
  // Read off the 2 000 most frequent survivors; Ukrainian words that merely look Russian
  // (`говорить`, `дома`, `одно`, `мир`, `стать`) are deliberately not here.
  ...['ее', 'его', 'ему', 'мне', 'но', 'он', 'оно', 'во', 'ко', 'ме', 'ден', 'пор', 'пап', 'дал'],
  ...['ладно', 'надо', 'конечно', 'после', 'потом', 'потому', 'почти', 'рядом', 'дальше'],
  ...['трудно', 'здорово', 'осталось', 'повезло', 'типа', 'готов', 'парень', 'парня', 'мужик'],
  ...['найти', 'найду', 'нашли', 'смогу', 'смог', 'будем', 'простите', 'понять', 'умер', 'умерла'],
  ...['вернуться', 'вернуть', 'вернусь', 'вернулась', 'получить', 'получилось', 'получила'],
  ...['получили', 'пришла', 'пришли', 'позволь', 'позволить', 'забрал', 'держать', 'держись'],
  ...['смерти', 'крови', 'новости', 'ума', 'поводу'],
  // The source tokenizer split `п'ять` at the apostrophe; this is the orphaned tail.
  'ять',
]

/**
 * English contraction halves. FrequencyWords split `don't` into `don` + `'t`; `don` then passes
 * the spelling check as the verb "to don" and would be the 33rd most frequent English word.
 */
export const CONTRACTION_FRAGMENTS: readonly string[] = [
  'ain',
  'aren',
  'couldn',
  'didn',
  'doesn',
  'don',
  'hadn',
  'hasn',
  'haven',
  'isn',
  'mustn',
  'needn',
  'shouldn',
  'wasn',
  'weren',
  'wouldn',
]

/**
 * Obscenities and slurs. `roots` match anywhere in a word (they are specific enough not to hit an
 * innocent one); `exact` entries match whole words only, because as substrings they would hit
 * innocent words (`сука` in `сукня`, `ass` in `class`). Over-filtering costs a typing trainer
 * nothing. The English dictionary's own `NOSUGGEST` marks are applied on top of this.
 */
export const PROFANITY: Readonly<
  Record<Language, { roots: readonly string[]; exact: readonly string[] }>
> = {
  uk: {
    roots: [
      'хуй',
      'хуя',
      'хує',
      'хуї',
      'пизд',
      'бляд',
      'їба',
      'їбу',
      'їбе',
      'єба',
      'йоб',
      'підар',
      'підор',
      'залуп',
      'мудак',
      'мудил',
      'гандон',
      'шльондр',
      'курв',
      'сучар',
    ],
    exact: [
      'бля',
      'сука',
      'суки',
      'суко',
      'суку',
      'сукою',
      'сучка',
      'сучки',
      'сучко',
      'педик',
      'педики',
      'срака',
      'сраку',
      'гівно',
      'лайно',
    ],
  },
  en: {
    roots: [
      'fuck',
      'shit',
      'cunt',
      'bitch',
      'whore',
      'slut',
      'nigg',
      'fagg',
      'asshole',
      'bastard',
      'wank',
      'motherf',
      'dickhead',
      'jackass',
      'pussies',
    ],
    exact: [
      'ass',
      'asses',
      'cock',
      'cocks',
      'dick',
      'dicks',
      'fag',
      'fags',
      'piss',
      'pissed',
      'pissing',
      'pussy',
      'twat',
      'tits',
      'retard',
      'retarded',
      'damn',
      'damned',
      'goddamn',
      'crap',
      'bullshit',
    ],
  },
}

export function isProfane(word: string, language: Language): boolean {
  const list = PROFANITY[language]
  return list.exact.includes(word) || list.roots.some((root) => word.includes(root))
}

/**
 * Ukrainian particles that make a hyphenated token a real word when the spelling dictionary does
 * not list the whole form (`що-небудь`, `все-таки`), provided the other part is a word. Anything
 * else hyphenated must be listed whole — which rejects `будь-ласка` (two words, `будь ласка`),
 * Russian `кого-то` (Ukrainian says `когось`) and `нью-йорк`.
 */
export const HYPHEN_PARTICLES: readonly string[] = ['небудь', 'таки']
