/**
 * Public surface of @typing-race/curriculum — specs/001-typing-core/contracts/curriculum.md.
 *
 * Five sub-surfaces, each its own directory, re-exported here in one line apiece. The split is not
 * cosmetic: `layout` and `scales` are static data and pure generators, while `progress` and `coach`
 * are folds over a learner's history, and keeping the boundary legible is what let two agents build
 * them at once without touching each other's files.
 *
 * No browser and no Node APIs anywhere in this package — F2's Edge Functions import it unchanged
 * to validate that an attempt's text was legitimate (ADR-0007).
 */

export * from './coach/index.js'
export * from './layout/index.js'
export * from './levels/index.js'
export * from './progress/index.js'
export * from './scales/index.js'
