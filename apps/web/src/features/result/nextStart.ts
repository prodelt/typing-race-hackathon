import type { AttemptSummary, NextAction } from '@typing-race/domain'

export type StartMode = 'practice' | 'test'

type Attempt = Pick<AttemptSummary, 'mode' | 'scaleId'> & {
  readonly metrics: Pick<AttemptSummary['metrics'], 'accuracy'>
}

/**
 * What the headline tells the learner after a Practice Attempt, decided from the same facts as the
 * «Далі» button so the two never disagree:
 *
 * - `below`: under the accuracy floor; practise to it (the coach slows the tempo on this exercise).
 * - `takeTest`: the floor is cleared and the coach points back at this exercise, so «Далі» opens
 *   its Test Attempt and the headline says to take it.
 * - `cleared`: the floor is cleared but the coach sends the learner elsewhere (the next key's
 *   scale, a weak transition). The headline only says the floor is cleared; the card under it
 *   names where «Далі» goes. Asking for the test here would send the button one way and the words
 *   another.
 *
 * Landing exactly on the floor clears it, as everywhere else (`accuracy >= floor`).
 */
export type PracticeAdvice = 'below' | 'takeTest' | 'cleared'

export function practiceAdvice(
  attempt: Attempt,
  next: Pick<NextAction, 'startsScaleId'>,
  floor: number,
): PracticeAdvice {
  if (attempt.metrics.accuracy < floor) return 'below'
  return next.startsScaleId === attempt.scaleId ? 'takeTest' : 'cleared'
}

/**
 * Which attempt type the Next Action's button opens.
 *
 * It starts in Practice: a first look at a new scale or a drill. The one exception is a Practice
 * Attempt that has just cleared the accuracy floor on the very exercise the coach points back at
 * (`practiceAdvice` is `takeTest`): the headline then says "take the test", so the button does
 * that, instead of reopening practice and leaving the learner to find the test.
 */
export function nextStartMode(
  attempt: Attempt,
  next: Pick<NextAction, 'startsScaleId'>,
  floor: number,
): StartMode {
  return attempt.mode === 'practice' && practiceAdvice(attempt, next, floor) === 'takeTest'
    ? 'test'
    : 'practice'
}
