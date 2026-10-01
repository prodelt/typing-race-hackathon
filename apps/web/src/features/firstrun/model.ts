import { boundaryFor } from '@typing-race/curriculum'
import type { Finger, Language, Layout, StartingLevelChoice } from '@typing-race/domain'

/**
 * First run: the steps a new learner walks before the first exercise, and what "start over" from
 * Settings changes. Pure, so the order, the skip rules and the forward-only guard are pinned by
 * unit tests rather than by clicking through the screens.
 *
 * Nothing is written to the store while the flow runs. The language and the level are held here
 * and committed together on the last step (`finishPlan`), so closing the tab half-way leaves no
 * half-answered learner behind: the next visit simply starts the flow again.
 */

export type Step = 'language' | 'level' | 'diagnostic' | 'fingers'
export type FlowMode = 'first' | 'again'

/** The three numbered steps of the indicator; the diagnostic is part of step 2. */
export const STEPS = ['language', 'level', 'fingers'] as const

export type Recorded = Readonly<Partial<Record<Language, StartingLevelChoice>>>

export interface FlowState {
  readonly mode: FlowMode
  readonly step: Step
  readonly language: Language
  readonly level: StartingLevelChoice | null
  /** What the diagnostic advised, shown next to the options; `null` if it was not taken. */
  readonly recommended: StartingLevelChoice | null
  /** The check's own figures, said next to the advice. */
  readonly advice: DiagnosticResult | null
  /** Levels already recorded per language. Start over never offers one below these. */
  readonly recorded: Recorded
}

export interface DiagnosticResult {
  /** Characters per minute. */
  readonly cpm: number
  /** 0–1. */
  readonly accuracy: number
}

export type FlowEvent =
  | { readonly type: 'pickLanguage'; readonly language: Language }
  | { readonly type: 'pickLevel'; readonly level: StartingLevelChoice }
  | { readonly type: 'startDiagnostic' }
  | { readonly type: 'skipDiagnostic' }
  | { readonly type: 'diagnosticDone'; readonly result: DiagnosticResult }
  | { readonly type: 'next' }
  | { readonly type: 'back' }

/** The order the levels are offered in, least to most experienced. */
export const LEVELS: readonly StartingLevelChoice[] = [
  'neverTouchTyped',
  'knowsHomeRow',
  'touchTypesWantsAccuracy',
]

/** The layout each typing language trains on in the first run. */
export const LAYOUT_OF: Record<Language, 'yq' | 'qwerty'> = { uk: 'yq', en: 'qwerty' }

/** Lower-case letters and spaces only, so a beginner is not stopped by Shift or punctuation. */
export const DIAGNOSTIC_TEXT: Record<Language, string> = {
  uk: 'сонце світить над полем і річка тихо біжить',
  en: 'the quick brown fox jumps over the lazy dog',
}

export function initialFlow(input: {
  readonly mode: FlowMode
  readonly language: Language
  readonly recorded: Recorded
}): FlowState {
  return {
    mode: input.mode,
    step: 'language',
    language: input.language,
    level: input.recorded[input.language] ?? null,
    recommended: null,
    advice: null,
    recorded: input.recorded,
  }
}

/** 1, 2 or 3 for the step indicator. */
export function stepNumber(step: Step): 1 | 2 | 3 {
  if (step === 'language') return 1
  return step === 'fingers' ? 3 : 2
}

/**
 * Forward only: a level that opens fewer keys than the one already recorded for this language is
 * not offered, because the fold guarantees earned keys but not a higher earlier answer.
 */
export function levelOffered(
  layout: Layout,
  level: StartingLevelChoice,
  recorded: StartingLevelChoice | undefined,
): boolean {
  if (recorded === undefined) return true
  return boundaryFor(layout, level) >= boundaryFor(layout, recorded)
}

/**
 * The levels are compared by their boundary on the chosen layout. The model is given only the
 * order here: `LEVELS` is already least to most, and every boundary grows along it on both
 * layouts, so the index is the same comparison without passing a layout into the reducer.
 */
function rank(level: StartingLevelChoice): number {
  return LEVELS.indexOf(level)
}

function atLeast(
  level: StartingLevelChoice,
  floor: StartingLevelChoice | undefined,
): StartingLevelChoice {
  return floor !== undefined && rank(floor) > rank(level) ? floor : level
}

export function canContinue(state: FlowState): boolean {
  if (state.step === 'level') return state.level !== null
  return state.step !== 'diagnostic'
}

export function reduceFlow(state: FlowState, event: FlowEvent): FlowState {
  const floor = state.recorded[state.language]
  switch (event.type) {
    case 'pickLanguage':
      if (event.language === state.language) return state
      return {
        ...state,
        language: event.language,
        level: state.recorded[event.language] ?? null,
        recommended: null,
        advice: null,
      }

    case 'pickLevel':
      if (floor !== undefined && rank(event.level) < rank(floor)) return state
      return { ...state, level: event.level }

    case 'startDiagnostic':
      return state.step === 'level' ? { ...state, step: 'diagnostic' } : state

    case 'skipDiagnostic':
      return state.step === 'diagnostic' ? { ...state, step: 'level' } : state

    case 'diagnosticDone': {
      if (state.step !== 'diagnostic') return state
      const recommended = recommendLevel(event.result)
      return {
        ...state,
        step: 'level',
        recommended,
        advice: event.result,
        level: atLeast(recommended, floor),
      }
    }

    case 'next':
      if (!canContinue(state)) return state
      if (state.step === 'language') return { ...state, step: 'level' }
      if (state.step === 'level') return { ...state, step: 'fingers' }
      return state

    case 'back':
      if (state.step === 'fingers') return { ...state, step: 'level' }
      if (state.step === 'diagnostic' || state.step === 'level') {
        return { ...state, step: state.step === 'diagnostic' ? 'level' : 'language' }
      }
      return state

    default: {
      const unhandled: never = event
      return unhandled
    }
  }
}

/**
 * Conservative on purpose: speed alone says nothing about whether the eyes are on the keys, so a
 * fast but sloppy run is advised to start from the beginning, and only a fast *and* clean one is
 * advised to skip the letters.
 */
export function recommendLevel(result: DiagnosticResult): StartingLevelChoice {
  if (result.accuracy >= 0.95 && result.cpm >= 200) return 'touchTypesWantsAccuracy'
  if (result.accuracy >= 0.9 && result.cpm >= 120) return 'knowsHomeRow'
  return 'neverTouchTyped'
}

export function diagnosticScore(run: {
  readonly chars: number
  readonly errors: number
  readonly elapsedMs: number
}): DiagnosticResult {
  const cpm = run.elapsedMs <= 0 ? 0 : Math.round((run.chars / run.elapsedMs) * 60_000)
  const total = run.chars + run.errors
  return { cpm, accuracy: total === 0 ? 0 : run.chars / total }
}

/**
 * What finishing commits. Start over is a fresh walk through these screens and nothing more: it
 * never deletes an attempt (Settings has its own, explicit "clear data" for that), it switches the
 * typing language only if the learner picked another one, and the level it records is still
 * forward only — the store's seam keeps the higher of the old and the new answer.
 */
export function finishPlan(input: {
  readonly currentLanguage: Language
  readonly language: Language
  readonly level: StartingLevelChoice
}): {
  readonly switchLanguage: Language | null
  readonly level: StartingLevelChoice
  readonly clearsHistory: false
} {
  return {
    switchLanguage: input.language === input.currentLanguage ? null : input.language,
    level: input.level,
    clearsHistory: false,
  }
}

/** B's finger zones: 0 pinky (white) → 3 index (deepest pink), the same on both hands. */
export type Zone = 0 | 1 | 2 | 3

const ZONE_OF: Record<Finger, Zone> = { pinky: 0, ring: 1, middle: 2, index: 3, thumb: 0 }

export function fingerZones(layout: Layout): ReadonlyMap<string, Zone> {
  return new Map(layout.keys.map((key) => [key.code, ZONE_OF[key.finger]]))
}
