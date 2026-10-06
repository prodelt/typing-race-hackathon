import { isDailyId, typedByHand, type WordBank } from '@typing-race/curriculum'
import type { AttemptSummary, Language } from '@typing-race/domain'
import { seededRandom } from '../../seams/index.js'

/** Words in one daily challenge. */
export const DAILY_WORDS = 20
/** The challenge draws from this many most frequent words, so it stays readable for everyone. */
const POOL = 300
/** Per language, like the challenge itself: `typing-race:daily:uk`. Sign-out wipes it. */
const storageKey = (language: Language): string => `typing-race:daily:${language}`

/** The learner's local calendar day as `YYYY-MM-DD`. */
export function localDay(at: Date): string {
  const y = at.getFullYear()
  const mo = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

/** FNV-1a over `day:language`: the same day and language give every learner the same seed. */
export function dailySeed(day: string, language: string): number {
  let hash = 0x811c9dc5
  for (const ch of `${day}:${language}`) {
    hash ^= ch.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** The day's words: a seeded shuffle of the bank's most frequent words. */
export function pickDailyWords(bank: WordBank, day: string): readonly string[] {
  const pool = [...bank.words]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, POOL)
    .map((w) => w.word)
  const random = seededRandom(dailySeed(day, bank.language))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1))
    const t = pool[i] as string
    pool[i] = pool[j] as string
    pool[j] = t
  }
  return pool.slice(0, DAILY_WORDS)
}

/**
 * Days with a cleared challenge in this language: a completed daily attempt in it at or above the
 * accuracy floor. Each language has its own challenge, so its own done-today and day count.
 */
export function clearedDays(
  attempts: readonly AttemptSummary[],
  floor: number,
  stored: readonly string[],
  language: Language,
): readonly string[] {
  const days = new Set(stored)
  for (const a of attempts) {
    if (
      isDailyId(a.scaleId) &&
      a.language === language &&
      typedByHand(a) &&
      a.metrics.accuracy >= floor
    ) {
      days.add(localDay(new Date(a.completedAt)))
    }
  }
  return [...days].sort()
}

/** Consecutive cleared days ending today, or yesterday when today is not cleared yet. */
export function dayStreak(days: readonly string[], today: Date): number {
  const set = new Set(days)
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!set.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (set.has(localDay(cursor))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function readStoredDays(language: Language): readonly string[] {
  try {
    const raw = storage()?.getItem(storageKey(language))
    if (raw == null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : []
  } catch {
    return []
  }
}

export function writeStoredDays(language: Language, days: readonly string[]): void {
  try {
    storage()?.setItem(storageKey(language), JSON.stringify(days.slice(-400)))
  } catch {
    // Private mode or full storage: the attempts still carry today's result.
  }
}
