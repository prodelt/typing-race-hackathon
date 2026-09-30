import type { NgramTable, WordBank } from '@typing-race/curriculum'
import { parseNgramTable, parseWordBank } from '@typing-race/curriculum'

/**
 * The derived word banks and n-gram tables (`data/derived/<lang>/`), loaded lazily per language so
 * they never enter the initial bundle. Each dynamic import is its own chunk, cached after the first
 * load by the module system and, offline, by the service worker's precache.
 */
export type DataLanguage = 'uk' | 'en'

const wordLoaders: Record<DataLanguage, () => Promise<{ default: unknown }>> = {
  uk: () => import('../../../../../data/derived/uk/words.json'),
  en: () => import('../../../../../data/derived/en/words.json'),
}

const ngramLoaders: Record<DataLanguage, () => Promise<{ default: unknown }>> = {
  uk: () => import('../../../../../data/derived/uk/ngrams.json'),
  en: () => import('../../../../../data/derived/en/ngrams.json'),
}

const banks = new Map<DataLanguage, Promise<WordBank>>()
const tables = new Map<DataLanguage, Promise<NgramTable>>()

export function loadWordBank(language: DataLanguage): Promise<WordBank> {
  let bank = banks.get(language)
  if (bank === undefined) {
    bank = wordLoaders[language]().then((module) => parseWordBank(module.default))
    banks.set(language, bank)
  }
  return bank
}

export function loadNgramTable(language: DataLanguage): Promise<NgramTable> {
  let table = tables.get(language)
  if (table === undefined) {
    table = ngramLoaders[language]().then((module) => parseNgramTable(module.default))
    tables.set(language, table)
  }
  return table
}
