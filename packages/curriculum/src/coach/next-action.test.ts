import type { AttemptSummary, Progress, Scale, StartingLevelChoice } from '@typing-race/domain'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { deriveProgress } from '../progress/derive'
import {
  fakeConfidence,
  makeAttempt,
  makeCatalogue,
  makeLayout,
  makeScale,
  toSummary,
  transitionAggregates,
} from '../progress/fixtures'
import { transitionScale } from '../scales/transitions'
import { nextAction } from './next-action'
import { renderReference, substitute } from './templates'

const catalogue = makeCatalogue()

function setup(
  language: 'uk' | 'en',
  attempts: AttemptSummary[],
  cat: readonly Scale[] = catalogue,
): { progress: Progress; last: AttemptSummary | null } {
  const layout = makeLayout(language)
  const progress = deriveProgress({
    attempts,
    layout,
    catalogue: cat,
    startingLevelChoice: 'knowsHomeRow',
    confidence: fakeConfidence,
  })
  return { progress, last: progress.history.at(-1) ?? null }
}

function run(
  attempts: AttemptSummary[],
  language: 'uk' | 'en' = 'uk',
  cat: readonly Scale[] = catalogue,
) {
  const layoutId = makeLayout(language).id
  const own = attempts.map((attempt) => ({ ...attempt, layoutId }))
  const { progress, last } = setup(language, own, cat)
  return nextAction({
    progress,
    lastAttempt: last,
    layout: makeLayout(language),
    catalogue: cat,
  })
}

/** An attempt that observed `f>g` six times with `misses` misses: confidence (6 - misses) / 6. */
function withFG(misses: number, extra: Parameters<typeof makeAttempt>[0] = {}): AttemptSummary {
  return toSummary(
    makeAttempt({
      aggregates: transitionAggregates('f', 'g', 6, misses),
      ...extra,
    }),
  )
}

describe('priority 1: accuracy below the floor', () => {
  it('names a lower tempo on the scale just attempted', () => {
    const result = run([toSummary(makeAttempt({ scaleId: 'sc-f', accuracy: 0.9 }))])
    expect(result).toMatchObject({
      rule: 'lowerTempo',
      template: 'coach.lowerTempo',
      values: { accuracy: 90, floor: 95 },
      startsScaleId: 'sc-f',
    })
    expect(renderReference(result)).toBe(
      'Your accuracy was 90%, below the 95% floor. Slow down and repeat this scale.',
    )
  })

  it('beats a weak Transition and uneven rhythm', () => {
    const result = run([withFG(5, { accuracy: 0.5, rhythm: 10 })])
    expect(result.rule).toBe('lowerTempo')
  })
})

describe('priority 2: the weakest Transition with enough samples', () => {
  it('names it and starts the scale focused on it', () => {
    const result = run([withFG(4)])
    expect(result).toMatchObject({
      rule: 'weakTransition',
      template: 'coach.weakTransition',
      values: { transition: 'f>g', from: 'f', to: 'g', confidence: 33 },
      startsScaleId: 'sc-fg',
    })
    expect(renderReference(result)).toBe(
      'The move f to g is your weakest (33% confidence). Drill it now.',
    )
  })

  it('beats uneven rhythm', () => {
    expect(run([withFG(4, { rhythm: 5 })]).rule).toBe('weakTransition')
  })

  it('never names a Transition with fewer than five observations (FR-035)', () => {
    const result = run([
      toSummary(makeAttempt({ aggregates: transitionAggregates('f', 'g', 4, 4) })),
    ])
    expect(result.rule).toBe('nextKey')
  })

  it('does not trust a confidence value the history cannot back', () => {
    const { progress } = setup('uk', [
      toSummary(makeAttempt({ aggregates: transitionAggregates('f', 'g', 3, 3) })),
    ])
    const forged: Progress = {
      ...progress,
      transitionConfidence: { 'f>g': 0.1 },
    }
    const result = nextAction({
      progress: forged,
      lastAttempt: progress.history[0] ?? null,
      layout: makeLayout('uk'),
      catalogue,
    })
    expect(result.rule).toBe('nextKey')
  })

  it('falls through when the Transition is confident enough', () => {
    expect(run([withFG(1)]).rule).toBe('nextKey')
  })

  it('skips a malformed key and a Transition with no startable scale', () => {
    const { progress, last } = setup('uk', [withFG(4)])
    const forged: Progress = {
      ...progress,
      transitionConfidence: {
        '>': 0.1,
        'h>d': 0.1,
        ...progress.transitionConfidence,
      },
      history: [
        ...progress.history,
        toSummary(
          makeAttempt({
            aggregates: {
              keys: {},
              transitions: {
                '>': { count: 9, misses: 9, sumIki: 0, sumIkiSq: 0 },
              },
            },
          }),
        ),
      ],
    }
    const result = nextAction({
      progress: forged,
      lastAttempt: last,
      layout: makeLayout('uk'),
      catalogue,
    })
    expect(result).toMatchObject({
      rule: 'weakTransition',
      startsScaleId: 'sc-fg',
    })
  })

  it('builds the drill on demand when no authored scale focuses on the weak Transition', () => {
    const noTransitionScales = catalogue.filter((s) => s.focus.kind === 'key')
    const action = run([withFG(4)], 'uk', noTransitionScales)
    expect(action.rule).toBe('weakTransition')
    expect(action.startsScaleId).toBe(transitionScale(makeLayout('uk'), 'f>g')?.id)
    expect(action.startsScaleId).toBe('yq.transition.KeyF-KeyG')
  })

  it('falls through when a weak Transition uses a key that is still locked', () => {
    const noTransitionScales = catalogue.filter((s) => s.focus.kind === 'key')
    const locked = toSummary(makeAttempt({ aggregates: transitionAggregates('g', ';', 6, 4) }))
    const { progress } = setup('uk', [locked], noTransitionScales)
    expect(progress.unlockedSet).not.toContain(';')
    expect(run([locked], 'uk', noTransitionScales).rule).toBe('nextKey')
  })

  it('weights same-finger Transitions up for Ukrainian, not for English (FR-033)', () => {
    // f>g is same-finger (both left index); d>f is not. d>f is the more deficient (0.5 vs 0.4),
    // so only the Ukrainian weight (0.4 * 1.5 = 0.6) can put f>g first.
    const scales = [
      ...catalogue,
      makeScale('sc-df', { kind: 'transition', value: 'd>f' }, ['d', 'f']),
    ]
    const history = [
      toSummary(
        makeAttempt({
          aggregates: {
            keys: {},
            transitions: {
              'f>g': { count: 10, misses: 4, sumIki: 0, sumIkiSq: 0 },
              'd>f': { count: 10, misses: 5, sumIki: 0, sumIkiSq: 0 },
            },
          },
        }),
      ),
    ]
    expect(run(history, 'uk', scales).startsScaleId).toBe('sc-fg')
    expect(run(history, 'en', scales).startsScaleId).toBe('sc-df')
  })

  it('breaks an exact tie by key, deterministically', () => {
    const history = [
      toSummary(
        makeAttempt({
          aggregates: {
            keys: {},
            transitions: {
              'g>f': { count: 10, misses: 5, sumIki: 0, sumIkiSq: 0 },
              'f>g': { count: 10, misses: 5, sumIki: 0, sumIkiSq: 0 },
            },
          },
        }),
      ),
    ]
    expect(run(history).startsScaleId).toBe('sc-fg')
    expect(run(history, 'en').startsScaleId).toBe('sc-fg')
  })

  it('does not treat a key with unknown characters as same-finger', () => {
    const history = [
      toSummary(
        makeAttempt({
          aggregates: {
            keys: {},
            transitions: {
              'f>z': { count: 10, misses: 9, sumIki: 0, sumIkiSq: 0 },
            },
          },
        }),
      ),
    ]
    const scales = [...catalogue, makeScale('sc-fz', { kind: 'transition', value: 'f>z' }, ['d'])]
    expect(run(history, 'uk', scales).startsScaleId).toBe('sc-fz')
  })
})

describe('priority 3: uneven rhythm with acceptable accuracy', () => {
  it('names an even-rhythm repeat of the same scale', () => {
    const result = run([toSummary(makeAttempt({ scaleId: 'sc-d', rhythm: 41.6 }))])
    expect(result).toMatchObject({
      rule: 'evenRhythm',
      template: 'coach.evenRhythm',
      values: { rhythm: 42 },
      startsScaleId: 'sc-d',
    })
    expect(renderReference(result)).toBe(
      'Your accuracy is good but your rhythm is uneven (42%). Repeat this scale at an even pace.',
    )
  })

  it('does not fire at exactly the floor', () => {
    expect(run([toSummary(makeAttempt({ rhythm: 70 }))]).rule).toBe('nextKey')
  })
})

describe('priority 4: the next key or scale', () => {
  it('names the next locked key and its scale', () => {
    const result = run([toSummary(makeAttempt({ completedAt: 1 }))])
    // knowsHomeRow opens d f g, so the next locked key is h.
    expect(result).toMatchObject({
      rule: 'nextKey',
      template: 'coach.nextKey',
      values: { key: 'h', finger: 'index' },
      startsScaleId: 'sc-h',
    })
    expect(renderReference(result)).toBe('Next key: h (index). Start its scale.')
  })

  it('works with no attempt at all', () => {
    const progress = deriveProgress({
      attempts: [],
      layout: makeLayout(),
      catalogue,
      startingLevelChoice: 'neverTouchTyped',
    })
    const result = nextAction({
      progress,
      lastAttempt: null,
      layout: makeLayout(),
      catalogue,
    })
    expect(result).toMatchObject({ rule: 'nextKey', startsScaleId: 'sc-d' })
  })

  it('falls back to the first unfinished scale when the next key has no scale', () => {
    // After h is unlocked, the next locked key is `;`, which has no scale.
    const progress = deriveProgress({
      attempts: [],
      layout: makeLayout(),
      catalogue,
      startingLevelChoice: 'touchTypesWantsAccuracy',
    })
    const result = nextAction({
      progress,
      lastAttempt: null,
      layout: makeLayout(),
      catalogue,
    })
    expect(result).toMatchObject({
      rule: 'nextKey',
      template: 'coach.nextScale',
      startsScaleId: 'sc-d',
    })
    expect(renderReference(result)).toBe('Next scale: sc-d.')
  })

  it('falls back to a finished scale, then to the catalogue, and never to nothing', () => {
    const layout = makeLayout()
    const progress = deriveProgress({
      attempts: [],
      layout,
      catalogue,
      startingLevelChoice: 'touchTypesWantsAccuracy',
    })
    const done: Progress = {
      ...progress,
      completedScales: catalogue.map((s) => s.id),
    }
    expect(nextAction({ progress: done, lastAttempt: null, layout, catalogue }).startsScaleId).toBe(
      'sc-d',
    )

    const locked: Progress = { ...progress, unlockedSet: ['a', 's', ' '] }
    const needy = catalogue.filter((s) => s.requires.length > 0)
    const result = nextAction({
      progress: locked,
      lastAttempt: null,
      layout,
      catalogue: needy,
    })
    expect(result.startsScaleId).toBe('sc-f')

    const empty = nextAction({
      progress: locked,
      lastAttempt: null,
      layout,
      catalogue: [],
    })
    expect(empty).toMatchObject({ rule: 'nextKey', startsScaleId: '' })
  })

  it('reports an empty finger when the next key is not in the layout table', () => {
    const layout = { ...makeLayout(), unlockOrder: ['z'] }
    const cat = [makeScale('sc-z', { kind: 'key', value: 'z' }, [])]
    const progress = deriveProgress({
      attempts: [],
      layout,
      catalogue: cat,
      startingLevelChoice: 'neverTouchTyped',
    })
    const result = nextAction({
      progress,
      lastAttempt: null,
      layout,
      catalogue: cat,
    })
    expect(result.values).toEqual({ key: 'z', finger: '' })
  })
})

describe('exactly one (SC-010)', () => {
  const attemptArb = fc.record({
    scale: fc.constantFrom('sc-d', 'sc-f', 'sc-g', 'sc-h', 'sc-fg'),
    mode: fc.constantFrom<'practice' | 'test'>('practice', 'test'),
    accuracy: fc.double({ min: 0.5, max: 1, noNaN: true }),
    rhythm: fc.double({ min: 0, max: 100, noNaN: true }),
    count: fc.integer({ min: 0, max: 12 }),
    misses: fc.integer({ min: 0, max: 12 }),
  })

  it('returns one well-formed NextAction for every reachable progress state', () => {
    fc.assert(
      fc.property(
        fc.array(attemptArb, { maxLength: 30 }),
        fc.constantFrom<'uk' | 'en'>('uk', 'en'),
        fc.constantFrom<StartingLevelChoice>(
          'neverTouchTyped',
          'knowsHomeRow',
          'touchTypesWantsAccuracy',
        ),
        (items, language, choice) => {
          const layout = makeLayout(language)
          const attempts = items.map((item, i) =>
            toSummary(
              makeAttempt({
                id: `n${i}`,
                scaleId: item.scale,
                mode: item.mode,
                accuracy: item.accuracy,
                rhythm: item.rhythm,
                completedAt: i + 1,
                layoutId: layout.id,
                aggregates: transitionAggregates(
                  'f',
                  'g',
                  item.count,
                  Math.min(item.misses, item.count),
                ),
              }),
            ),
          )
          const progress = deriveProgress({
            attempts,
            layout,
            catalogue,
            startingLevelChoice: choice,
            confidence: fakeConfidence,
          })
          const result = nextAction({
            progress,
            lastAttempt: progress.history.at(-1) ?? null,
            layout,
            catalogue,
          })
          expect(Array.isArray(result)).toBe(false)
          expect(['lowerTempo', 'weakTransition', 'evenRhythm', 'nextKey']).toContain(result.rule)
          expect(result.template).toMatch(/^coach\./)
          expect(catalogue.map((s) => s.id)).toContain(result.startsScaleId)
          // Never a formatted sentence: only a key and values.
          expect(result.template).not.toContain(' ')
        },
      ),
    )
  })
})

describe('substitute (FR-034)', () => {
  it('replaces placeholders and leaves an unknown one visible', () => {
    expect(substitute('{a} and {b} and {a}', { a: 1, b: 'x' })).toBe('1 and x and 1')
    expect(substitute('{missing}', {})).toBe('{missing}')
  })

  it('renders an unknown template key as the key itself', () => {
    expect(
      renderReference({
        rule: 'nextKey',
        template: 'coach.unknown',
        values: {},
        startsScaleId: '',
      }),
    ).toBe('coach.unknown')
  })
})
