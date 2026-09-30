/**
 * A Hunspell membership test by reverse affix lookup — what Hunspell itself does to check a word.
 *
 * The dictionary is never expanded into its word forms: it only answers "is this FrequencyWords
 * token a real word?". Nothing from the `.dic` reaches the output, which is why the GPL-labelled
 * Ukrainian dictionary can serve as a build-time filter for CC BY-SA data (docs/data-sources.md).
 *
 * Supported: single-character flags (neither snapshot `.aff` declares `FLAG`), `SFX` and `PFX` with
 * strip/add/condition, prefix+suffix cross products, `NOSUGGEST` (the English dictionary marks its
 * slurs and obscenities with it) and `ONLYINCOMPOUND`. Not needed and not supported: compounding,
 * continuation classes on affixes, `ICONV`/`IGNORE` (our tokens are already canonical), and `MAP`,
 * `REP`, `TRY` — suggestion directives we must never read, since `MAP гґ` would fold `ґ` into `г`.
 */

interface Affix {
  readonly flag: string
  readonly strip: string
  readonly add: string
  readonly condition: RegExp
  readonly cross: boolean
}

export interface Lookup {
  /** At least one dictionary stem produces the word. */
  readonly found: boolean
  /** Some stem that produces it is marked `NOSUGGEST` — an obscenity or slur. */
  readonly taboo: boolean
}

const NOT_FOUND: Lookup = { found: false, taboo: false }

/** Hunspell conditions are a tiny regex language: literals, `.`, `[...]` and `[^...]`. */
function conditionRegex(condition: string, anchorAtEnd: boolean): RegExp {
  let body = ''
  for (let i = 0; i < condition.length; i++) {
    const c = condition[i] as string
    if (c === '[') {
      const close = condition.indexOf(']', i)
      body += condition.slice(i, close + 1)
      i = close
    } else if (c === '.') body += '[\\s\\S]'
    else body += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(anchorAtEnd ? `${body}$` : `^${body}`, 'u')
}

function parseAff(text: string) {
  const directives = new Map<string, string>()
  const suffixes: Affix[] = []
  const prefixes: Affix[] = []
  const cross = new Map<string, boolean>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    const parts = line.trim().split(/\s+/)
    const kind = parts[0]
    if (kind === 'SFX' || kind === 'PFX') {
      const flag = parts[1] as string
      // A group header is `SFX <flag> <Y|N> <count>`; a rule is `SFX <flag> <strip> <add> <cond>`.
      if (
        parts.length === 4 &&
        (parts[2] === 'Y' || parts[2] === 'N') &&
        /^\d+$/.test(parts[3] ?? '')
      ) {
        cross.set(`${kind}${flag}`, parts[2] === 'Y')
        continue
      }
      const strip = parts[2] === '0' ? '' : (parts[2] ?? '')
      const addField = (parts[3] ?? '').split('/')[0] ?? ''
      const add = addField === '0' ? '' : addField
      const condition = parts[4] ?? '.'
      const affix: Affix = {
        flag,
        strip,
        add,
        condition: conditionRegex(condition, kind === 'SFX'),
        cross: cross.get(`${kind}${flag}`) ?? false,
      }
      ;(kind === 'SFX' ? suffixes : prefixes).push(affix)
    } else if (kind !== undefined && /^[A-Z]+$/.test(kind) && parts.length === 2) {
      directives.set(kind, parts[1] as string)
    }
  }
  if (directives.has('FLAG')) throw new Error(`Unsupported FLAG ${directives.get('FLAG')}`)
  return { directives, suffixes, prefixes }
}

/** `word/FLAGS` per line after a count line; `\/` escapes a slash; a tab starts morphology. */
function parseDic(text: string): Map<string, Set<string>> {
  const stems = new Map<string, Set<string>>()
  const lines = text.split('\n')
  for (let i = 1; i < lines.length; i++) {
    let line = (lines[i] as string).replace(/\r$/, '')
    const tab = line.indexOf('\t')
    if (tab >= 0) line = line.slice(0, tab)
    line = line.trim()
    if (line === '') continue
    let slash = -1
    for (let k = 0; k < line.length; k++) {
      if (line[k] === '/' && line[k - 1] !== '\\') {
        slash = k
        break
      }
    }
    const word = (slash >= 0 ? line.slice(0, slash) : line).replace(/\\\//g, '/').normalize('NFC')
    const flags = stems.get(word) ?? new Set<string>()
    for (const flag of slash >= 0 ? line.slice(slash + 1) : '') flags.add(flag)
    stems.set(word, flags)
  }
  return stems
}

function indexByAdd(affixes: readonly Affix[]): Map<string, Affix[]> {
  const index = new Map<string, Affix[]>()
  for (const affix of affixes) {
    const list = index.get(affix.add) ?? []
    list.push(affix)
    index.set(affix.add, list)
  }
  return index
}

export class Hunspell {
  readonly stemCount: number
  private readonly stems: Map<string, Set<string>>
  private readonly suffixesByAdd: Map<string, Affix[]>
  private readonly prefixesByAdd: Map<string, Affix[]>
  private readonly maxSuffix: number
  private readonly maxPrefix: number
  private readonly noSuggest: string | undefined
  private readonly onlyInCompound: string | undefined

  constructor(aff: string, dic: string) {
    const parsed = parseAff(aff)
    this.stems = parseDic(dic)
    this.stemCount = this.stems.size
    this.suffixesByAdd = indexByAdd(parsed.suffixes)
    this.prefixesByAdd = indexByAdd(parsed.prefixes)
    this.maxSuffix = Math.max(0, ...[...this.suffixesByAdd.keys()].map((a) => a.length))
    this.maxPrefix = Math.max(0, ...[...this.prefixesByAdd.keys()].map((a) => a.length))
    this.noSuggest = parsed.directives.get('NOSUGGEST')
    this.onlyInCompound = parsed.directives.get('ONLYINCOMPOUND')
  }

  /** Case-sensitive: `джон` does not match the stem `Джон`; ask for `Джон` to find it. */
  lookup(word: string): Lookup {
    let found = false
    let taboo = false
    const accept = (flags: Set<string>) => {
      if (this.onlyInCompound !== undefined && flags.has(this.onlyInCompound)) return
      found = true
      if (this.noSuggest !== undefined && flags.has(this.noSuggest)) taboo = true
    }
    this.visit(word, accept)
    return found ? { found, taboo } : NOT_FOUND
  }

  /** Calls `accept` with the flags of every stem that produces `word`. */
  private visit(word: string, accept: (flags: Set<string>) => void): void {
    const bare = this.stems.get(word)
    if (bare !== undefined) accept(bare)
    this.visitSuffixed(word, undefined, accept)

    for (let len = 1; len <= Math.min(this.maxPrefix, word.length); len++) {
      const prefixes = this.prefixesByAdd.get(word.slice(0, len))
      if (prefixes === undefined) continue
      for (const prefix of prefixes) {
        const base = prefix.strip + word.slice(len)
        if (base === '' || !prefix.condition.test(base)) continue
        const flags = this.stems.get(base)
        if (flags?.has(prefix.flag)) accept(flags)
        if (prefix.cross) this.visitSuffixed(base, prefix.flag, accept)
      }
    }
  }

  /** Reverse-applies every suffix rule; with `prefixFlag`, only cross-product rules on stems that carry it too. */
  private visitSuffixed(
    word: string,
    prefixFlag: string | undefined,
    accept: (flags: Set<string>) => void,
  ): void {
    const n = word.length
    for (let len = 0; len <= Math.min(this.maxSuffix, n); len++) {
      const suffixes = this.suffixesByAdd.get(len === 0 ? '' : word.slice(n - len))
      if (suffixes === undefined) continue
      const base = word.slice(0, n - len)
      for (const suffix of suffixes) {
        if (prefixFlag !== undefined && !suffix.cross) continue
        const stem = base + suffix.strip
        if (stem === '' || !suffix.condition.test(stem)) continue
        const flags = this.stems.get(stem)
        if (flags === undefined || !flags.has(suffix.flag)) continue
        if (prefixFlag !== undefined && !flags.has(prefixFlag)) continue
        accept(flags)
      }
    }
  }
}
