# ADR-0010: Twenty-four-hour challenge mode

**Status**: Accepted · **Date**: 2026-09-30 · **Supersedes for the duration**: parts of
[ADR-0008](0008-canonical-agent-workflow.md) and constitution v2.1.0 items VIII and IX

## Context

The wayfinder map's standing decisions open with *"No deadline pressure. Optimize for the best
result. Work proceeds task by task to avoid production hell."* Every process artifact in this
repository was built under that assumption: 149 tasks in F1 alone, one worktree and one pull request
per user story, a three-engine end-to-end matrix, 100% coverage on the logic packages, and axe and
Lighthouse as blocking gates.

On 2026-09-30, mid-implementation, the constraint changed: the whole product is due in **24 hours**,
and the user's decision is that all five roadmap features ship, not a subset.

The arithmetic is not close. Seven pull requests for F1 alone, each with a worktree, a rebase, a
`code-review` pass and a CI wait, is several hours of coordination before a line of product code is
written — and F1 is one feature of five. The ceremony was bought with time the project no longer has.

## Decision

For the duration of the challenge, and only for it:

1. **Everything runs on `main`.** No worktrees, no story branches, no pull requests. Constitution
   VIII's "one story, one lane, one PR" is suspended. The property VIII exists to protect — that no
   lane imports another lane's unmerged code — is trivially satisfied when there is only one lane.
2. **`Waived: IX` — nested agents are allowed.** Work is fanned out to Sonnet subagents over
   directories that already carry a written contract and a list of test obligations in
   `specs/001-typing-core/contracts/`. Each subagent owns a disjoint directory and may not touch a
   package barrel, a configuration file or another agent's tree.
3. **Gates during the work are `pnpm typecheck`, `pnpm lint` and `pnpm test`.** Property tests stay
   mandatory for domain logic — they are the requirements' own §8.1–§8.5 checks, not our own
   ceremony, and an error in the accuracy formula or the unlock rule is exactly the sort of defect
   that surfaces during a demo. Playwright runs on Chromium during the work and in full at the end.
   axe and Lighthouse run once, at the end.
4. **The Definition of Done is otherwise unchanged.** Nothing here licenses skipping a test that
   proves a requirement. It changes *when* the slower gates bind, not whether they do.

## Consequences

- **The risk we accept** is integration debt: four agents writing against one type surface can agree
  on the types and still disagree on behaviour. Mitigated by extracting `@typing-race/domain` —
  types only, no runtime — before the fan-out, so the nouns are fixed in one file rather than
  negotiated in four.
- **The risk we do not accept** is shipping unproven claims. The requirements' §11 lists undelivered
  promises as grounds for rejection, so a half-built feature is worse than an absent one. If the
  clock runs out mid-feature, the feature is removed from the demo route rather than shown broken.
- **This is not a precedent.** The condition that produced it is a stated deadline on a single
  challenge. When it passes, the constitution's v2.1.0 text applies again unamended, and a second
  invocation of this ADR would mean the constitution is wrong rather than the situation exceptional
  — which is the test the constitution itself sets for a repeated waiver.
- `/speckit-analyze` will report VIII and IX as violations for as long as this is in force. That is
  correct behaviour and the finding is answered by this ADR, not by editing the constitution.

## Alternatives considered

**Keep the full process and cut scope to F1.** Rejected by the user, who chose full scope after the
trade-off was put to them explicitly.

**Amend the constitution to v3.0.0.** Rejected: an amendment says the rule was wrong, and it is not
— it was written for a project with no deadline, and that project is the normal case here. A
time-boxed waiver with a written expiry says what actually happened.

**Drop the property tests too.** Rejected. They are the cheapest gate per defect caught in this
codebase, they encode the requirements' own mandatory checks, and the failure they prevent — a wrong
accuracy or unlock rule found live — is the most expensive one available.
