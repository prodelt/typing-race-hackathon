import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { nextAction } from '../packages/curriculum/src/coach/next-action'
import { layouts } from '../packages/curriculum/src/layout/layouts'
import { SHIFT_TOKEN } from '../packages/curriculum/src/layout/unlock-order'
import { catalogue } from '../packages/curriculum/src/scales/catalogue'
import { seededRandom } from '../packages/curriculum/src/scales/seeded-random'
import { REQUIREMENTS_UNMET } from '../packages/curriculum/src/scales/types'
import { AUTHORED_WORDS } from '../packages/curriculum/src/stage2/authored'
import {
  focusDrillFor,
  focusDrillId,
  isWordDrillId,
  resolveWordDrill,
  stage2Gate,
  wordCatalogue,
} from '../packages/curriculum/src/stage2/catalogue'
import {
  drillPool,
  generateWordText,
  isTypable,
  MIN_POOL,
  NO_WEAK,
  weakElements,
} from '../packages/curriculum/src/stage2/select'
import { parseWordBank } from '../packages/curriculum/src/words/bank'
import { normaliseToken, RUSSIAN_ONLY_LETTERS } from '../packages/curriculum/src/words/normalise'
import type { WordBank } from '../packages/curriculum/src/words/types'
import type { Layout, LayoutId, Progress, WordDrill } from '../packages/domain/src/index'

/**
 * Stage 2 (packages/curriculum/src/stage2) against the **real** derived word banks, because the rule that matters (§8.3: a Stage 2
 * exercise never contains a character the learner has not opened) is only as true as the data it
 * runs on. A synthetic bank would prove the filter and miss the bank. It lives here, not beside the
 * module, because reading the derived files needs Node and the curriculum package is kept pure.
 */

const banks: Record<LayoutId, WordBank> = {
  yq: loadBank('uk'),
  qwerty: loadBank('en'),
}

function loadBank(language: 'uk' | 'en'): WordBank {
  const url = new URL(`../data/derived/${language}/words.json`, import.meta.url)
  return parseWordBank(JSON.parse(readFileSync(url, 'utf8')))
}

/** Anchors, space and the first `length` entries of the Unlock Order — the only shape FR-042 allows. */
function unlockedPrefix(layout: Layout, length: number): string[] {
  return [...layout.homeAnchors, ' ', ...layout.unlockOrder.slice(0, length)]
}

const LAYOUT_IDS: readonly LayoutId[] = ['yq', 'qwerty']

/** A drill from the catalogue, or a focus drill on a random letter pair of the layout. */
function drillArb(id: LayoutId): fc.Arbitrary<WordDrill> {
  const letters = [...layouts[id].homeAnchors, ...layouts[id].unlockOrder].filter((c) =>
    /\p{L}/u.test(c),
  )
  const focus = fc
    .tuple(fc.constantFrom(...letters), fc.constantFrom(...letters), fc.boolean())
    .map(([a, b, pair]) =>
      resolveWordDrill(
        focusDrillId(
          id,
          pair ? { kind: 'transition', value: `${a}>${b}` } : { kind: 'key', value: a },
        ),
      ),
    )
    .filter((drill): drill is WordDrill => drill !== undefined)
  return fc.oneof(fc.constantFrom(...wordCatalogue[id]), focus)
}

describe('§8.3: a Stage 2 exercise contains no locked character', () => {
  for (const id of LAYOUT_IDS) {
    it(`holds for every drill, unlocked prefix, seed and weak set on ${id}`, () => {
      const layout = layouts[id]
      fc.assert(
        fc.property(
          drillArb(id),
          fc.integer({ min: 0, max: layout.unlockOrder.length }),
          fc.integer({ min: 0, max: 2 ** 31 - 1 }),
          fc.boolean(),
          (drill, length, seed, adaptive) => {
            const unlocked = unlockedPrefix(layout, length)
            const open = new Set(unlocked)
            const text = generateWordText({
              drill,
              bank: banks[id],
              layout,
              unlocked,
              random: seededRandom(seed),
              weak: adaptive ? { keys: [...unlocked].slice(0, 2), transitions: [] } : NO_WEAK,
            })
            if (text === REQUIREMENTS_UNMET) return
            for (const char of text) expect(isTypable(layout, open, char), char).toBe(true)
            expect(text.length).toBeGreaterThanOrEqual(drill.size)
            expect(text).not.toMatch(/ {2}|^ | $/)
          },
        ),
        { numRuns: 300 },
      )
    }, 60_000) // ~2 s alone; generous because `pnpm test` runs every project in parallel
  }

  it('offers nothing before the whole home row is open', () => {
    for (const id of LAYOUT_IDS) {
      const layout = layouts[id]
      const beforeGate = unlockedPrefix(layout, stage2Gate(layout).length - 1)
      for (const drill of wordCatalogue[id]) {
        expect(drillPool({ drill, bank: banks[id], layout, unlocked: beforeGate })).toEqual([])
      }
    }
  })

  it('never types a capital before Shift is open', () => {
    const layout = layouts.yq
    const beforeShift = layout.unlockOrder.indexOf(SHIFT_TOKEN)
    const capitals = wordCatalogue.yq.find((d) => d.kind === 'capitals') as WordDrill
    const closed = { drill: capitals, bank: banks.yq, layout }
    expect(drillPool({ ...closed, unlocked: unlockedPrefix(layout, beforeShift) })).toEqual([])
    const words = drillPool({ ...closed, unlocked: unlockedPrefix(layout, beforeShift + 1) })
    expect(words.length).toBeGreaterThanOrEqual(MIN_POOL)
    for (const word of words) expect(word[0]).toBe(word[0]?.toUpperCase())
  })
})

describe('the Path the learner walks', () => {
  it('opens with real home-row words, short and frequent first', () => {
    const layout = layouts.yq
    const unlocked = unlockedPrefix(layout, stage2Gate(layout).length)
    const first = wordCatalogue.yq[0] as WordDrill
    const words = drillPool({ drill: first, bank: banks.yq, layout, unlocked })
    expect(words.length).toBeGreaterThanOrEqual(MIN_POOL)
    // The bank ranks by frequency; the first words are the everyday ones, not rare long ones.
    expect(words.slice(0, 6)).toEqual(expect.arrayContaining(['в', 'і', 'до']))
    for (const word of words) expect([...word].every((c) => 'фівапролджє'.includes(c))).toBe(true)
  })

  it('climbs the length ladder in order: short, then medium, then long', () => {
    const ladder = wordCatalogue.qwerty.filter((d) => d.kind === 'length')
    expect(ladder.map((d) => d.after)).toEqual([null, ladder[0]?.id, ladder[1]?.id])
    const layout = layouts.qwerty
    const unlocked = unlockedPrefix(layout, layout.unlockOrder.length)
    const [short, , long] = ladder.map((drill) =>
      drillPool({ drill, bank: banks.qwerty, layout, unlocked }),
    )
    expect(Math.max(...(short ?? []).map((w) => w.length))).toBeLessThanOrEqual(4)
    expect(Math.min(...(long ?? []).map((w) => w.length))).toBeGreaterThanOrEqual(8)
  })

  it('gives every key opened after the home row its own words, each containing that key', () => {
    for (const id of LAYOUT_IDS) {
      const layout = layouts[id]
      const gate = stage2Gate(layout).length
      for (let i = gate; i < layout.unlockOrder.length; i++) {
        const char = layout.unlockOrder[i] as string
        const drill = wordCatalogue[id].find(
          (d) => (d.kind === 'newKey' || d.kind === 'ukLetter') && d.focus?.value === char,
        )
        if (drill === undefined) continue
        const before = unlockedPrefix(layout, i)
        const after = unlockedPrefix(layout, i + 1)
        expect(drillPool({ drill, bank: banks[id], layout, unlocked: before })).toEqual([])
        for (const word of drillPool({ drill, bank: banks[id], layout, unlocked: after })) {
          expect(word).toContain(char)
        }
      }
      // The demo moment: opening к on ЙЦУКЕН right after the home row brings real words with it.
      if (id === 'yq') {
        const k = wordCatalogue.yq.find((d) => d.focus?.value === 'к') as WordDrill
        const words = drillPool({
          drill: k,
          bank: banks.yq,
          layout,
          unlocked: unlockedPrefix(layout, layout.unlockOrder.indexOf('к') + 1),
        })
        expect(words.length).toBeGreaterThanOrEqual(MIN_POOL)
      }
    }
  })

  it('trains і ї є ґ as themselves and never as a Russian letter', () => {
    const layout = layouts.yq
    const unlocked = unlockedPrefix(layout, layout.unlockOrder.length)
    for (const letter of ['і', 'ї', 'є', 'ґ']) {
      const drill = wordCatalogue.yq.find((d) => d.kind === 'ukLetter' && d.focus?.value === letter)
      expect(drill, letter).toBeDefined()
      const words = drillPool({ drill: drill as WordDrill, bank: banks.yq, layout, unlocked })
      for (const word of words) {
        expect(word).toContain(letter)
        expect([...word].some((c) => RUSSIAN_ONLY_LETTERS.includes(c))).toBe(false)
      }
    }
  })

  it('has enough apostrophe and hyphen words in both languages once the keys are open', () => {
    for (const id of LAYOUT_IDS) {
      const layout = layouts[id]
      const unlocked = unlockedPrefix(layout, layout.unlockOrder.length)
      for (const kind of ['apostrophe', 'hyphen'] as const) {
        const drill = wordCatalogue[id].find((d) => d.kind === kind) as WordDrill
        const words = drillPool({ drill, bank: banks[id], layout, unlocked })
        expect(words.length, `${id} ${kind}`).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('authors only words that pass the pipeline normaliser unchanged', () => {
    for (const language of ['uk', 'en'] as const) {
      for (const word of AUTHORED_WORDS[language]) {
        expect(normaliseToken(word, language)).toEqual({ ok: true, word })
      }
    }
  })
})

describe('adaptation', () => {
  it('draws words holding the weak key more often than the unweighted pool would', () => {
    const layout = layouts.yq
    const unlocked = unlockedPrefix(layout, layout.unlockOrder.indexOf('т') + 1)
    const drill = wordCatalogue.yq[0] as WordDrill
    const args = { drill, bank: banks.yq, layout, unlocked }
    const share = (weak: typeof NO_WEAK) => {
      let hits = 0
      let total = 0
      for (let seed = 1; seed <= 60; seed++) {
        const words = generateWordText({ ...args, weak, random: seededRandom(seed) }).split(' ')
        total += words.length
        hits += words.filter((w) => w.includes('ш')).length
      }
      return hits / total
    }
    expect(share({ keys: ['ш'], transitions: [] })).toBeGreaterThan(share(NO_WEAK) * 1.5)
  })

  it('reads weak elements from confidence, letters only, weakest first', () => {
    const progress = {
      keyConfidence: { а: 0.4, о: 0.7, ' ': 0.1, л: 0.95, д: undefined },
      transitionConfidence: { 'о>л': 0.5, 'а> ': 0.1, 'в>а': 0.6 },
    } as unknown as Progress
    expect(weakElements(progress, layouts.yq)).toEqual({
      keys: ['а', 'о'],
      transitions: ['о>л', 'в>а'],
    })
  })

  it('trains a weak transition in real words once Stage 2 is open', () => {
    const layout = layouts.yq
    const unlocked = unlockedPrefix(layout, stage2Gate(layout).length)
    const history = [
      {
        id: 'a',
        scaleId: 'yq.words.first',
        layoutId: 'yq',
        language: 'uk',
        mode: 'practice',
        seed: 1,
        startedAt: 0,
        completedAt: 1,
        elapsedMs: 1,
        metrics: { accuracy: 1, rhythmConsistency: { value: 95, breaksExcluded: 0 } },
        aggregates: {
          keys: {},
          transitions: { 'о>л': { count: 9, misses: 3, sumIki: 0, sumIkiSq: 0 } },
        },
      },
    ]
    const progress = {
      unlockedSet: unlocked,
      completedScales: [],
      keyConfidence: {},
      transitionConfidence: { 'о>л': 0.4 },
      history,
    } as unknown as Progress
    const args = { progress, lastAttempt: null, layout, catalogue: catalogue.yq }
    // Without Stage 2 the coach names it through a Stage 1 transition drill; with it, in words.
    expect(isWordDrillId(nextAction(args).startsScaleId)).toBe(false)
    const action = nextAction({ ...args, focusDrill: focusDrillFor(layout, unlocked) })
    expect(action.rule).toBe('weakTransition')
    expect(action.startsScaleId).toBe('yq.words.focus.о>л')
    expect(isWordDrillId(action.startsScaleId)).toBe(true)
    const drill = resolveWordDrill(action.startsScaleId) as WordDrill
    const words = drillPool({ drill, bank: banks.yq, layout, unlocked })
    expect(words.every((w) => w.includes('ол'))).toBe(true)
    expect(words.length).toBeGreaterThanOrEqual(MIN_POOL)
  })
})
