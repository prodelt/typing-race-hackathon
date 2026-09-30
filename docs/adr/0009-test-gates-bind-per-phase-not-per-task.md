---
status: accepted
---

# Test gates bind per phase, not per task, and the three-engine matrix binds at the PR

Principle II keeps every one of its obligations, and two of them are re-scoped to the boundary where they actually catch something. A task closes on a green **local** run; a **phase** and a pull request close on a green CI run. The Chromium / Firefox / WebKit matrix binds at the pull-request and `main` gate rather than on every iteration inside a lane — with the input path exempted from the relaxation, because that is the one place where the engines genuinely disagree. Decided 2026-09-30 while opening the implementation of [F1](../../specs/001-typing-core/plan.md), resolving [ticket 24](../../.scratch/typing-race-hackathon/issues/24-implementation-handoff-and-throughput.md). Constitution **v2.1.0**.

## Why this came up

F1's `tasks.md` holds 149 tasks and its spec holds 51 acceptance scenarios. Under v2.0.0 that is 149 CI runs on a free tier and 153 end-to-end runs per full pass. The user raised the pace twice during the planning session, and the honest answer was that the process — not the work — was the cost. Three rules were the drivers; this ADR changes two of them and deliberately leaves the third alone.

## Considered options

**Keep v2.0.0 unchanged.** The safest reading, and it was genuinely on the table: per-task CI gives a jury-legible audit trail, and three engines from the first commit gives the earliest possible signal. Rejected because the signal is mostly redundant. A task's unit and property tests are the same tests locally and in CI, run on the same Node; the CI run adds queue time, not information. Where CI *does* add information — the production build, the three engines, axe, the latency gate, the secret scan — it does so at a phase boundary, because that is the first point at which the pieces are assembled.

**Relax the matrix everywhere, including the input path.** Rejected, and this is the part worth recording. [Research 06](../research/06-quality-tooling.md) established by experiment that the engines behave *differently* on the path F1 is built around: Playwright cannot type Cyrillic through the keyboard API in any engine, and **Firefox ignores `preventDefault()` on `beforeinput`**. A Chromium-only green run on the keystroke engine would therefore not be a weaker signal — it would be a misleading one, and the bug it hides is the one that invalidates the whole product. So the input path keeps all three engines from its first commit. The relaxation applies to screens, not to the engine.

**Batch the four small story lanes into one pull request**, dropping one-story-one-lane for F1's P2 stories. Rejected. Seven pull requests are not the bottleneck — the pull request itself is cheap, and the lane isolation is what keeps `tasks.md` reconcilable on `main` and what makes "no lane imports another lane's unmerged code" checkable rather than hoped for. Principle VIII stands unchanged.

**Run the Foundational phase in a worktree behind a pull request**, as every story lane does. Rejected for F1's Foundational phase alone: it owns every hot file by definition, nothing else may touch them, and no other lane is open to race it, so the pull request would have no reviewer and no conflict to prevent. It runs on `main`, and **branch protection is enabled before the first story lane opens** — which is the moment ticket 01 was really pointing at when it recorded protection as due "at the first code task".

## Consequences

- **Constitution v2.1.0** amends principle II items 2 and 5 and the sentence on task completion, and adds "phase CI green" to gate G2. The principle itself — TDD, property tests, an E2E per acceptance scenario against the production build, zero axe violations, the latency gate — is untouched. Nothing was deleted; two gates moved to a coarser boundary.
- **A task closes on a green local `pnpm test`.** A phase and a pull request close on a linked green CI run. The per-task audit trail the jury sees becomes per-phase, which is still a trail and is one the jury can actually read.
- **A lane may iterate on Chromium.** The full matrix runs on the pull request and on `main`. Tests that touch the input path — `packages/engine` and everything in `e2e/exercise.spec.ts` that drives characters — declare all three engines from the start.
- **F1's Foundational phase runs on `main`.** Branch protection goes on before the first story lane. Every later phase, in F1 and in F2–F5, goes through a worktree and a pull request as principle VIII requires.
- **The waiver ledger is unaffected.** This is an amendment, not a waiver: it changes the rule for everyone rather than excusing one pull request. F1's one waiver remains principle VII, recorded in its `plan.md`.
- **Reversibility.** If a Firefox or WebKit defect reaches `main` because a lane iterated on Chromium, that is the signal this amendment was wrong, and the remedy is to restore v2.0.0 item 2 rather than to add exceptions. Worth watching on the first two story lanes specifically.
