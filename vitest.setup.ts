import fc from 'fast-check'

/**
 * Global fast-check configuration.
 *
 * Constitution principle II makes property tests mandatory for domain logic, so they run on every
 * `pnpm test` and their cost is everyone's cost. 100 runs is the point where the metric and unlock
 * properties in `specs/001-typing-core/contracts/` still find counterexamples without turning the
 * suite into a coffee break; raise `numRuns` locally when hunting a specific bug, never in this file.
 *
 * `seed` is left unset on purpose: fast-check picks a fresh one per run and prints it on failure, so
 * a red build is reproducible with `fc.assert(..., { seed: <printed> })` while the suite keeps
 * exploring new inputs. A pinned seed would make the suite deterministic and blind.
 */
fc.configureGlobal({
  numRuns: 100,
  verbose: 1,
  // A property that shrinks forever is a bug in the property, not a reason to wait.
  interruptAfterTimeLimit: 20_000,
  markInterruptAsFailure: true,
})
