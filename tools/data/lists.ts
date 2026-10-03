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
  ...['мужчина', 'мужчины', 'мужчину', 'плохого', 'плохой'],
  // Colloquial Russian the Ukrainian dictionary lists as slang or by spelling: found in the focus
  // drills' pools, which reach well down the bank.
  ...['чувак', 'чувака', 'чуваки', 'чуваком', 'знать', 'ухожу', 'дружище'],
  ...['парню', 'парнями', 'парне', 'парням', 'дурак', 'дурака', 'дураком'],
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
 * Obscenities, slurs, and the sexual, insulting and violent vocabulary a jury demo should not put
 * in front of a learner. `roots` match anywhere in a word (they are specific enough not to hit an
 * innocent one); `exact` entries match whole words only, because as substrings they would hit
 * innocent words (`сука` in `сукня`, `ass` in `class`, `kill` in `skill`, `дупа` in `дупло`).
 * Case forms are listed one by one for the same reason. Over-filtering costs a typing trainer
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
      // Sexual and insulting vocabulary that is not an obscenity but is no help in a typing lesson.
      ...['секс', 'порно', 'пеніс', 'вагін', 'цицьк', 'сиськ', 'трахн', 'трахав', 'трахат'],
      ...['шлюх', 'проститут', 'бордел', 'збочен', 'придур', 'ідіот', 'кретин', 'дебіл'],
      ...['виродк', 'виродок', 'вилупк', 'вилупок', 'йолоп', 'бовдур', 'сволот', 'мерзот'],
      ...['тварюк', 'падлюк', 'наркоман', 'героїн', 'кокаїн'],
      ...['засран', 'оргазм', 'стерв', 'заткн', 'сперм', 'мінет', 'відсмокт'],
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
      ...['дупа', 'дупу', 'дупи', 'дупі', 'дупою', 'дупо'],
      ...['лайна', 'лайну', 'лайні', 'лайном', 'скотина', 'скотину', 'скотини', 'падло', 'падла'],
      // Forms of words that are a vulgarity only in one reading (`страх` holds `трах`, `член` is
      // also a member), so they are listed whole.
      ...['трах', 'трахається', 'трахались', 'трахаю', 'трахаєш', 'трахнув'],
      ...['повія', 'повій', 'повії', 'повію', 'повією', 'повіям'],
      ...['сучку', 'сучі', 'сучого', 'сучих', 'козел', 'козла', 'козлом', 'козли', 'козлів'],
      ...['жид', 'жиди', 'жидів', 'жида', 'жидом', 'жидові', 'негр', 'негра', 'негрів', 'негри'],
      ...['гнида', 'гниди', 'гнидо'],
      ...['яйця', 'яйцях', 'яйцями', 'яєчка', 'член', 'оральний', 'анальний'],
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
      ...['sexy', 'sexual', 'porn', 'penis', 'vagina', 'orgasm', 'erotic', 'horny', 'condom'],
      ...['pervert', 'stripper', 'prostitut', 'molest', 'nipple', 'bimbo'],
      ...['idiot', 'moron', 'murder', 'suicide', 'terroris'],
      ...['sperm', 'hooker', 'lesbian', 'masturb', 'pedophil', 'striptease', 'testicle'],
      ...['bondage', 'incest', 'dildo', 'vibrator', 'lingerie', 'fetish'],
      ...['kinky', 'topless', 'rectum', 'orgy'],
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
      ...['sex', 'nude', 'naked', 'boob', 'boobs', 'breast', 'breasts', 'rape', 'raped', 'banged'],
      ...['balls', 'jerk', 'loser', 'scum', 'sucker', 'suck', 'sucks', 'sucked', 'butt', 'bum'],
      ...['fart', 'poop', 'pee', 'bugger', 'bloody', 'dumb', 'stupid', 'dyke', 'homo', 'negro'],
      ...['hoe', 'hooker', 'abortion', 'cripple', 'heroin', 'cocaine'],
      ...['kill', 'killed', 'killing', 'killer', 'killers', 'kills', 'killings'],
      // Whole words only: `anal` is in `analysis`, `cum` in `document`, `tit` in `title`,
      // `rapist` in `therapist`, `raping` in `scraping`, `crapp` in `scrapping`, `semen` in `basement`.
      'semen',
      ...['rapist', 'rapists', 'raping', 'crappy', 'crapped', 'crapper'],
      ...[
        'anal',
        'anus',
        'cum',
        'boner',
        'thong',
        'tit',
        'tits',
        'titty',
        'titties',
        'turd',
        'turds',
      ],
      ...['retards', 'queer', 'queers', 'booby', 'boobies', 'craps', 'rapes', 'hoes', 'dammit'],
      ...[
        'farts',
        'farting',
        'farted',
        'jerks',
        'jerking',
        'jerked',
        'sucking',
        'suckers',
        'losers',
      ],
      ...[
        'pisses',
        'pooped',
        'pooping',
        'peed',
        'peeing',
        'buggers',
        'buggered',
        'prick',
        'pricks',
      ],
      ...['buttocks', 'butts', 'fatso', 'fatty', 'sexier', 'sexiest', 'chink', 'gook', 'testicles'],
    ],
  },
}

/**
 * Given names the spelling dictionary also lists in lower case (`john` is a toilet, `jack` a tool),
 * so the proper-noun rule cannot see them. Only names with no other everyday meaning are here:
 * `mark`, `will`, `rose` and `bill` stay because they are words first.
 */
export const FIRST_NAMES: Readonly<Record<Language, readonly string[]>> = {
  uk: [
    ...['джек', 'мері', 'тоні', 'ігор', 'сем', 'бен'],
    ...['кларк', 'алан', 'біллі', 'гері', 'генрі', 'кайл', 'оскар', 'тім'],
  ],
  en: [
    ...['john', 'jack', 'tom', 'bob', 'mike', 'harry', 'charlie', 'peter', 'tony', 'max', 'ted'],
    ...['bobby', 'billy', 'johnny', 'jimmy', 'jenny', 'maria', 'terry', 'lily', 'ed'],
    ...['sally', 'molly', 'phoebe', 'joey', 'rick', 'josh'],
  ],
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
