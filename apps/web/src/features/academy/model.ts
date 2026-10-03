import type { AcademyModule, AcademyStep, Bilingual } from '@typing-race/curriculum'
import type { Language } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'

/** Interface text of a module in the learner's interface language. */
export function local(text: Bilingual): string {
  return getLocale() === 'en' ? text.en : text.uk
}

export const STEP_NAMES: Record<AcademyStep, () => string> = {
  keys: m.academy_step_keys,
  pairs: m.academy_step_pairs,
  morphemes: m.academy_step_morphemes,
  words: m.academy_step_words,
  phrases: m.academy_step_phrases,
  sentences: m.academy_step_sentences,
  text: m.academy_step_text,
  tempo: m.academy_step_tempo,
}

/** Modules grouped by their §3.3 step, keeping course order and each module's 1-based number. */
export function groupBySteps(
  modules: readonly AcademyModule[],
): { step: AcademyStep; modules: { module: AcademyModule; n: number }[] }[] {
  const groups: { step: AcademyStep; modules: { module: AcademyModule; n: number }[] }[] = []
  modules.forEach((module, index) => {
    const last = groups.at(-1)
    if (last !== undefined && last.step === module.step) last.modules.push({ module, n: index + 1 })
    else groups.push({ step: module.step, modules: [{ module, n: index + 1 }] })
  })
  return groups
}

export const LAYOUT_NAME: Record<Language, string> = { uk: 'ЙЦУКЕН', en: 'QWERTY' }

export function percent(fraction: number): number {
  return Math.round(fraction * 100)
}

/**
 * The letters of an exercise text the learner has not unlocked yet, lower case, in order of first
 * appearance. Only letters count: punctuation, digits and the Shift forms of an open letter are not
 * what Stage 1 opens one key at a time.
 */
export function lockedLetters(text: string, unlocked: readonly string[]): string[] {
  const open = new Set(unlocked)
  const seen = new Set<string>()
  for (const char of text.toLowerCase()) {
    if (/\p{L}/u.test(char) && !open.has(char)) seen.add(char)
  }
  return [...seen]
}
