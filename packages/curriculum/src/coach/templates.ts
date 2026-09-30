import type { NextAction, NextActionRule } from '@typing-race/domain'

/**
 * Message keys for the four rules — FR-034. The coach returns a key plus values, never a sentence,
 * so translation stays in Paraglide's hands and the exact wording for given inputs stays testable.
 */
export const templateKeys = {
  lowerTempo: 'coach.lowerTempo',
  weakTransition: 'coach.weakTransition',
  evenRhythm: 'coach.evenRhythm',
  nextKey: 'coach.nextKey',
  nextScale: 'coach.nextScale',
} as const

/**
 * English reference wording, so a test can assert the exact sentence for given inputs (FR-034).
 * Placeholders are `{name}`; the shipped strings live in the i18n catalogue under the same keys.
 */
export const referenceTemplates: Readonly<Record<string, string>> = {
  [templateKeys.lowerTempo]:
    'Your accuracy was {accuracy}%, below the {floor}% floor. Slow down and repeat this scale.',
  [templateKeys.weakTransition]:
    'The move {from} to {to} is your weakest ({confidence}% confidence). Drill it now.',
  [templateKeys.evenRhythm]:
    'Your accuracy is good but your rhythm is uneven ({rhythm}%). Repeat this scale at an even pace.',
  [templateKeys.nextKey]: 'Next key: {key} ({finger}). Start its scale.',
  [templateKeys.nextScale]: 'Next scale: {scale}.',
}

/** Substitutes `{name}` placeholders. A placeholder with no value is left visible, not blanked. */
export function substitute(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name]
    return value === undefined ? placeholder : String(value)
  })
}

/** The sentence a NextAction reads as in the reference wording. */
export function renderReference(action: NextAction): string {
  return substitute(referenceTemplates[action.template] ?? action.template, action.values)
}

export function makeAction(
  rule: NextActionRule,
  template: string,
  values: Readonly<Record<string, string | number>>,
  startsScaleId: string,
): NextAction {
  return { rule, template, values, startsScaleId }
}

/** Percent, rounded half up — one rounding rule for every figure in every sentence. */
export function percent(fraction: number): number {
  return Math.round(fraction * 100)
}
