import type { AttemptSummary, NextAction } from '@typing-race/domain'

export type StartMode = 'practice' | 'test'

/**
 * Which attempt type the Next Action's button opens.
 *
 * It starts in Practice: a first look at a new scale or a drill. The one exception is a Practice
 * Attempt that has just cleared the accuracy floor on the very exercise the coach points back at.
 * The headline then says "now take the test attempt", so the button does that, instead of reopening
 * practice and leaving the learner to find the test (the exercise screen still makes the test its
 * primary action in practice mode, FR-036).
 *
 * Landing exactly on the floor clears it, as everywhere else (`accuracy >= floor`).
 */
export function nextStartMode(
  attempt: Pick<AttemptSummary, 'mode' | 'scaleId'> & {
    readonly metrics: Pick<AttemptSummary['metrics'], 'accuracy'>
  },
  next: Pick<NextAction, 'startsScaleId'>,
  floor: number,
): StartMode {
  const clearedPractice = attempt.mode === 'practice' && attempt.metrics.accuracy >= floor
  return clearedPractice && next.startsScaleId === attempt.scaleId ? 'test' : 'practice'
}
