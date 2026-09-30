import type { AttemptSummary } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import enJson from '../../../../data/curriculum/en/academy.json'
import ukJson from '../../../../data/curriculum/uk/academy.json'
import { MASTERY_STREAK } from '../progress/derive'
import { courseProblems, parseAcademyCourse, stepRank } from './course'
import { academyLevel, academyNextStep, academyProgress } from './progress'
import { foldText, hasRussianOnlyLetter } from './text'
import { ACADEMY_STEPS, type AcademyCourse } from './types'

const courses = { uk: parseAcademyCourse(ukJson), en: parseAcademyCourse(enJson) }

describe('the committed Academy courses', () => {
  it.each(['uk', 'en'] as const)('%s: no validation problems', (lang) => {
    expect(courseProblems(courses[lang])).toEqual([])
  })

  it.each(['uk', 'en'] as const)('%s: modules follow the §3.3 difficulty order', (lang) => {
    const ranks = courses[lang].modules.map((m) => stepRank(m.step))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    // Every §3.3 step from key pairs to tempo series is present.
    for (const step of ACADEMY_STEPS) expect(ranks).toContain(stepRank(step))
  })

  it.each(['uk', 'en'] as const)('%s: no module and no exercise is empty', (lang) => {
    for (const module of courses[lang].modules) {
      expect(module.exercises.length, module.id).toBeGreaterThan(0)
      for (const e of module.exercises) expect(e.text.trim().length, e.id).toBeGreaterThan(0)
    }
  })

  it('uk: no exercise contains a Russian-only letter, and і ї є ґ survive', () => {
    const all = courses.uk.modules.flatMap((m) => m.exercises.map((e) => e.text)).join(' ')
    expect(hasRussianOnlyLetter(all)).toBe(false)
    for (const letter of ['і', 'ї', 'є', 'ґ']) expect(all).toContain(letter)
  })

  it('the demo scenario exists: a bigram module built from the heaviest bigrams', () => {
    for (const course of Object.values(courses)) {
      const bigrams = course.modules.find((m) => m.kind === 'bigrams')
      expect(bigrams?.step).toBe('pairs')
      expect(bigrams?.exercises[0]?.source).toBe('derived')
    }
  })
})

describe('text folding', () => {
  it('never substitutes a Ukrainian letter and always folds the apostrophe', () => {
    const alphabet = [...'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя']
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...alphabet), { minLength: 1, maxLength: 12 }), (w) => {
        const word = w.join('')
        expect(foldText(word, true)).toBe(word)
        expect(foldText(`${word}’${word}`, false)).toBe(`${word}'${word}`)
      }),
    )
  })
})

describe('validation', () => {
  const base = courses.uk
  it('rejects a course whose modules break the §3.3 order', () => {
    const swapped: AcademyCourse = { ...base, modules: [...base.modules].reverse() }
    expect(courseProblems(swapped).some((p) => p.includes('§3.3'))).toBe(true)
  })
  it('rejects an empty module and a Russian letter', () => {
    const [first, ...rest] = base.modules
    if (first === undefined) throw new Error('no modules')
    const broken: AcademyCourse = {
      ...base,
      modules: [
        { ...first, exercises: [] },
        {
          ...first,
          id: 'x',
          exercises: [
            {
              id: 'academy.uk.x.1',
              title: 'x',
              text: 'ёлка',
              focus: null,
              targetSpm: null,
              source: 'derived',
            },
          ],
        },
        ...rest,
      ],
    }
    const problems = courseProblems(broken)
    expect(problems.some((p) => p.includes('no exercises'))).toBe(true)
    expect(problems.some((p) => p.includes('untypable') || p.includes('Russian'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

const small: AcademyCourse = {
  ...courses.uk,
  modules: courses.uk.modules
    .slice(2, 4)
    .map((m) => ({ ...m, exercises: m.exercises.slice(0, 3) })),
}
const smallIds = small.modules.flatMap((m) => m.exercises.map((e) => e.id))

function attempt(scaleId: string, mode: 'test' | 'practice', accuracy: number, at: number) {
  return {
    id: `a${at}`,
    scaleId,
    layoutId: 'yq',
    language: 'uk',
    mode,
    seed: 0,
    startedAt: at - 1,
    completedAt: at,
    elapsedMs: 1,
    metrics: { accuracy, spm: 999 },
    aggregates: { keys: {}, transitions: {} },
  } as unknown as AttemptSummary
}

const arbitraryHistory = fc
  .array(
    fc.record({
      exercise: fc.constantFrom(...smallIds),
      mode: fc.constantFrom('test' as const, 'practice' as const),
      pass: fc.boolean(),
    }),
    { maxLength: 60 },
  )
  .map((list) =>
    list.map((a, i) =>
      attempt(a.exercise, a.mode, a.pass ? 1 : academyLevel.accuracyFloor - 0.01, i + 1),
    ),
  )

/** Independent restatement of the Mastery Rule: some run of 3 consecutive passing tests. */
function everMastered(history: readonly AttemptSummary[], id: string): boolean {
  let run = 0
  for (const a of history) {
    if (a.scaleId !== id || a.mode !== 'test') continue
    run = a.metrics.accuracy >= academyLevel.accuracyFloor ? run + 1 : 0
    if (run >= MASTERY_STREAK) return true
  }
  return false
}

describe('Academy progress', () => {
  it('a module is complete only when every one of its exercises is mastered', () => {
    fc.assert(
      fc.property(arbitraryHistory, (history) => {
        const progress = academyProgress(small, history)
        for (const module of small.modules) {
          const allMastered = module.exercises.every((e) => everMastered(history, e.id))
          expect(progress.modules[module.id]?.complete).toBe(allMastered)
        }
        expect(progress.complete).toBe(small.modules.every((m) => progress.modules[m.id]?.complete))
      }),
    )
  })

  it('practice attempts never master anything, however accurate', () => {
    fc.assert(
      fc.property(arbitraryHistory, (history) => {
        const practice = history.map((a) => ({ ...a, mode: 'practice' as const }))
        const progress = academyProgress(small, practice)
        expect(progress.exercisesMastered).toBe(0)
        expect(progress.fraction).toBe(0)
      }),
    )
  })

  it('attempts on another layout do not count', () => {
    const id = smallIds[0] as string
    const history = [1, 2, 3].map((t) => ({
      ...attempt(id, 'test', 1, t),
      layoutId: 'qwerty' as const,
    }))
    expect(academyProgress(small, history).exercises[id]?.mastered).toBe(false)
  })

  it('the next step stays on an unmastered exercise, then moves on', () => {
    const id = smallIds[0] as string
    const fail = [attempt(id, 'test', 0.5, 1)]
    const afterFail = academyNextStep(small, academyProgress(small, fail), {
      exerciseId: id,
      mode: 'test',
      accuracy: 0.5,
    })
    expect(afterFail).toEqual({ kind: 'practice', exerciseId: id, reason: 'belowFloor' })

    const passes = [1, 2, 3].map((t) => attempt(id, 'test', 1, t))
    const afterMastery = academyNextStep(small, academyProgress(small, passes), {
      exerciseId: id,
      mode: 'test',
      accuracy: 1,
    })
    expect(afterMastery).toEqual({ kind: 'next', exerciseId: smallIds[1], moduleComplete: false })
  })
})
