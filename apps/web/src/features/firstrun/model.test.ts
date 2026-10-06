import { catalogue, layouts } from '@typing-race/curriculum'
import { describe, expect, it } from 'vitest'
import {
  canContinue,
  DIAGNOSTIC_TEXT,
  diagnosticScore,
  type FlowState,
  fingerZones,
  finishPlan,
  firstExerciseId,
  initialFlow,
  levelOffered,
  recommendLevel,
  reduceFlow,
  stepNumber,
} from './model'

const first = initialFlow({ mode: 'first', language: 'uk', recorded: {} })

function walk(state: FlowState, ...events: Parameters<typeof reduceFlow>[1][]): FlowState {
  return events.reduce(reduceFlow, state)
}

describe('the step order', () => {
  it('starts on the language and walks language → level → fingers', () => {
    expect(first.step).toBe('language')
    const atLevel = walk(first, { type: 'next' })
    expect(atLevel.step).toBe('level')
    const atFingers = walk(
      atLevel,
      { type: 'pickLevel', level: 'neverTouchTyped' },
      { type: 'next' },
    )
    expect(atFingers.step).toBe('fingers')
  })

  it('does not leave the level step until a level is picked', () => {
    const atLevel = walk(first, { type: 'next' })
    expect(canContinue(atLevel)).toBe(false)
    expect(walk(atLevel, { type: 'next' }).step).toBe('level')
  })

  it('goes back one step at a time and stops at the language', () => {
    const atFingers = walk(
      first,
      { type: 'next' },
      { type: 'pickLevel', level: 'knowsHomeRow' },
      { type: 'next' },
    )
    const back = walk(atFingers, { type: 'back' })
    expect(back.step).toBe('level')
    // Going back keeps the answer already given.
    expect(back.level).toBe('knowsHomeRow')
    expect(walk(back, { type: 'back' }, { type: 'back' }).step).toBe('language')
  })

  it('numbers the diagnostic as part of the level step', () => {
    expect(stepNumber('language')).toBe(1)
    expect(stepNumber('level')).toBe(2)
    expect(stepNumber('diagnostic')).toBe(2)
    expect(stepNumber('fingers')).toBe(3)
  })

  it('a language change is kept when picked', () => {
    expect(walk(first, { type: 'pickLanguage', language: 'en' }).language).toBe('en')
  })

  it('a language switched past step 1 (the status bar) returns to the level for that language', () => {
    const atFingers = walk(
      first,
      { type: 'next' },
      { type: 'pickLevel', level: 'knowsHomeRow' },
      { type: 'next' },
    )
    const switched = walk(atFingers, { type: 'pickLanguage', language: 'en' })
    expect(switched.step).toBe('level')
    expect(switched.language).toBe('en')
    expect(switched.level).toBeNull()
    const inCheck = walk(first, { type: 'next' }, { type: 'startDiagnostic' })
    expect(walk(inCheck, { type: 'pickLanguage', language: 'en' }).step).toBe('level')
    // The same language again changes nothing, wherever the flow is.
    expect(walk(atFingers, { type: 'pickLanguage', language: 'uk' })).toBe(atFingers)
  })
})

describe('the diagnostic', () => {
  const atLevel = walk(first, { type: 'next' })

  it('is optional: the level step continues without it', () => {
    const picked = walk(atLevel, {
      type: 'pickLevel',
      level: 'neverTouchTyped',
    })
    expect(canContinue(picked)).toBe(true)
  })

  it('opens from the level step and skipping it returns there with nothing picked for you', () => {
    const open = walk(atLevel, { type: 'startDiagnostic' })
    expect(open.step).toBe('diagnostic')
    const skipped = walk(open, { type: 'skipDiagnostic' })
    expect(skipped.step).toBe('level')
    expect(skipped.level).toBeNull()
    expect(skipped.recommended).toBeNull()
  })

  it('Back from the diagnostic is the same as skipping it', () => {
    const open = walk(atLevel, { type: 'startDiagnostic' })
    expect(walk(open, { type: 'back' }).step).toBe('level')
  })

  it('finishing it returns to the level step with its recommendation picked', () => {
    const done = walk(
      atLevel,
      { type: 'startDiagnostic' },
      { type: 'diagnosticDone', result: { cpm: 150, accuracy: 0.93 } },
    )
    expect(done.step).toBe('level')
    expect(done.recommended).toBe('knowsHomeRow')
    expect(done.level).toBe('knowsHomeRow')
  })

  it('a recommendation below the recorded level picks the recorded one instead', () => {
    const again = initialFlow({
      mode: 'again',
      language: 'uk',
      recorded: { uk: 'touchTypesWantsAccuracy' },
    })
    const done = walk(
      again,
      { type: 'next' },
      { type: 'startDiagnostic' },
      { type: 'diagnosticDone', result: { cpm: 40, accuracy: 0.7 } },
    )
    expect(done.recommended).toBe('neverTouchTyped')
    expect(done.level).toBe('touchTypesWantsAccuracy')
  })

  it('recommends conservatively from speed and accuracy', () => {
    expect(recommendLevel({ cpm: 60, accuracy: 0.99 })).toBe('neverTouchTyped')
    expect(recommendLevel({ cpm: 300, accuracy: 0.8 })).toBe('neverTouchTyped')
    expect(recommendLevel({ cpm: 130, accuracy: 0.92 })).toBe('knowsHomeRow')
    expect(recommendLevel({ cpm: 210, accuracy: 0.92 })).toBe('knowsHomeRow')
    expect(recommendLevel({ cpm: 210, accuracy: 0.96 })).toBe('touchTypesWantsAccuracy')
  })

  it('scores characters per minute and accuracy from the run', () => {
    expect(diagnosticScore({ chars: 40, errors: 0, elapsedMs: 20_000 })).toEqual({
      cpm: 120,
      accuracy: 1,
    })
    expect(diagnosticScore({ chars: 45, errors: 5, elapsedMs: 30_000 }).accuracy).toBe(0.9)
    // A run with no time is not a division by zero.
    expect(diagnosticScore({ chars: 10, errors: 0, elapsedMs: 0 }).cpm).toBe(0)
  })

  it('has a short line in both languages, typable with the layout and without Shift', () => {
    for (const [language, layoutId] of [
      ['uk', 'yq'],
      ['en', 'qwerty'],
    ] as const) {
      const text = DIAGNOSTIC_TEXT[language]
      expect(text.length).toBeGreaterThan(25)
      expect(text.length).toBeLessThan(60)
      const plain = new Set(layouts[layoutId].keys.map((key) => key.plain))
      for (const char of text) expect(plain.has(char), `${language}: ${char}`).toBe(true)
    }
  })
})

describe('start over', () => {
  it('begins at the first step with the current language and the recorded level picked', () => {
    const again = initialFlow({
      mode: 'again',
      language: 'en',
      recorded: { en: 'knowsHomeRow' },
    })
    expect(again.step).toBe('language')
    expect(again.language).toBe('en')
    expect(again.level).toBe('knowsHomeRow')
  })

  it('switching language picks that language’s recorded level, or none', () => {
    const again = initialFlow({
      mode: 'again',
      language: 'uk',
      recorded: { uk: 'knowsHomeRow' },
    })
    expect(walk(again, { type: 'pickLanguage', language: 'en' }).level).toBeNull()
    expect(
      walk(
        again,
        { type: 'pickLanguage', language: 'en' },
        { type: 'pickLanguage', language: 'uk' },
      ).level,
    ).toBe('knowsHomeRow')
  })

  it('never offers a level below the recorded one (forward only)', () => {
    const layout = layouts.yq
    expect(levelOffered(layout, 'neverTouchTyped', 'knowsHomeRow')).toBe(false)
    expect(levelOffered(layout, 'knowsHomeRow', 'knowsHomeRow')).toBe(true)
    expect(levelOffered(layout, 'touchTypesWantsAccuracy', 'knowsHomeRow')).toBe(true)
    expect(levelOffered(layout, 'neverTouchTyped', undefined)).toBe(true)
  })

  it('ignores picking a level that is not offered', () => {
    const again = initialFlow({
      mode: 'again',
      language: 'uk',
      recorded: { uk: 'knowsHomeRow' },
    })
    const atLevel = walk(again, { type: 'next' })
    expect(walk(atLevel, { type: 'pickLevel', level: 'neverTouchTyped' }).level).toBe(
      'knowsHomeRow',
    )
  })

  it('resets the flow only: finishing keeps history and switches the language only if it changed', () => {
    expect(
      finishPlan({
        currentLanguage: 'uk',
        language: 'uk',
        level: 'knowsHomeRow',
      }),
    ).toEqual({
      switchLanguage: null,
      level: 'knowsHomeRow',
      clearsHistory: false,
    })
    expect(
      finishPlan({
        currentLanguage: 'uk',
        language: 'en',
        level: 'neverTouchTyped',
      }),
    ).toEqual({
      switchLanguage: 'en',
      level: 'neverTouchTyped',
      clearsHistory: false,
    })
  })
})

describe('the first exercise', () => {
  it('opens the home-row run of the chosen layout for a learner who never touch-typed', () => {
    for (const layout of [layouts.yq, layouts.qwerty]) {
      const id = firstExerciseId(layout, 'neverTouchTyped', `${layout.id}.run.KeyG`)
      const scale = catalogue[layout.id as 'yq' | 'qwerty'].find((each) => each.id === id)
      expect(scale?.type).toBe('run')
      expect(layout.homeAnchors).toContain(scale?.focus.value)
    }
    expect(firstExerciseId(layouts.yq, 'neverTouchTyped', 'yq.run.KeyG')).toBe('yq.run.anchors')
    expect(firstExerciseId(layouts.qwerty, 'neverTouchTyped', 'qwerty.run.KeyG')).toBe(
      'qwerty.run.anchors',
    )
  })

  it('keeps the first closed key for the other levels', () => {
    for (const layout of [layouts.yq, layouts.qwerty]) {
      for (const level of ['knowsHomeRow', 'touchTypesWantsAccuracy'] as const) {
        expect(firstExerciseId(layout, level, `${layout.id}.run.KeyQ`)).toBe(
          `${layout.id}.run.KeyQ`,
        )
      }
    }
  })
})

describe('the finger scheme', () => {
  it('gives every letter key of both layouts a zone, mirrored between the hands', () => {
    for (const layout of [layouts.yq, layouts.qwerty]) {
      const zones = fingerZones(layout)
      const f = layout.keys.find((key) => key.code === 'KeyF')
      const j = layout.keys.find((key) => key.code === 'KeyJ')
      const a = layout.keys.find((key) => key.code === 'KeyA')
      expect(f && zones.get(f.code)).toBe(3)
      expect(j && zones.get(j.code)).toBe(3)
      expect(a && zones.get(a.code)).toBe(0)
      for (const key of layout.keys.filter((k) => k.kind === 'letter')) {
        expect(zones.get(key.code)).toBeDefined()
      }
    }
  })
})
