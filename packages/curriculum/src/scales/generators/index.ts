import type { ScaleType } from '@typing-race/domain'
import type { Generator } from '../types'
import { alternate } from './alternate'
import { fingerIsolation } from './finger-isolation'
import { fingerSpan } from './finger-span'
import { mirror } from './mirror'
import { modifiers } from './modifiers'
import { run } from './run'
import { tempo } from './tempo'
import { vertical } from './vertical'

/** One generator per type, written out rather than looked up by flag so coverage is auditable (R6). */
export const generators: Record<ScaleType, Generator> = {
  run,
  mirror,
  alternate,
  fingerIsolation,
  vertical,
  fingerSpan,
  modifiers,
  tempo,
}

export { tempoSteps } from './tempo'
export { transitionDrill } from './transition'
export { homePartners } from './vertical'
