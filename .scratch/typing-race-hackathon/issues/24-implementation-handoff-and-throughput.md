# 24 Grilling: Implementation handoff & process throughput

Type: grilling
Status: resolved
Blocked by: 23
Mode: HITL

## Question

The F1 package is done and passes G0. Two things have to be settled before the first lane opens, and
they are the same question from two directions: **how the lanes start, and how much process each one
carries.**

### Part 1 — the handoff

- Foundational runs as one lane. `claude --worktree foundational-f1`, or straight on `main`? It owns
  every hot file and nothing else touches them, so a worktree buys isolation we may not need, while
  `main` skips a PR that nobody else is racing.
- What the first green CI run has to prove before any story lane opens. `tasks.md` puts the checkpoint
  at "every package has green unit and property tests, the shell renders, CI is green, the latency gate
  runs" — is that the bar, or is a working typing line part of it?
- Branch protection on `main` was recorded in ticket 01 as due "at the first code task". That is now.
  Turning it on before the Foundational PR means the Foundational work itself goes through a PR.

### Part 2 — throughput

The user has twice said the pace feels slow. The map's process was built for correctness, and three of
its rules are the actual cost drivers for F1. Each is a MUST in the constitution, so relaxing any of
them is an amendment with an ADR, not an informal exception. The question is which, if any, are worth
amending **for the implementation phase**:

1. **One story, one lane, one PR** (VIII) — seven PRs for F1, each with rebase, `code-review`, CI and a
   human squash merge. The alternative is to batch the four small lanes (US4 Formulas, US5 Settings,
   US6 Session, and possibly US2) into one PR, which costs the per-lane isolation that keeps `tasks.md`
   reconcilable.
2. **Three-engine E2E per acceptance scenario** (II.2, II.3) — 51 scenarios × 3 engines. The
   alternative is Chromium during development with the full matrix gated on `main` and before the demo,
   which trades early Firefox and WebKit signal for wall-clock. Worth noting: research 06 found the
   input path behaves *differently* per engine — Firefox ignores `preventDefault()` on `beforeinput` —
   so this is the one place where the cheap-looking cut has a real chance of biting.
3. **A task closes only with a link to a green run** (DoD) — per-task CI on a free tier is the slowest
   feedback loop we have. The alternative is per-phase CI with local `pnpm test` per task.

There is also a fourth lever that costs nothing: `chrome-devtools` MCP as the inner loop, already in
`plan.md`, which removes most of the reason to wait for CI while building a screen.

**What this ticket must decide:** the handoff mechanics, and for each of the three rules, keep or amend.
An amendment means editing `.specify/memory/constitution.md`, bumping the version and recording an ADR —
so if all three are kept, say so explicitly and the ticket closes with "no amendment", which is a real
answer and not a non-decision.

## Answer

## Decisions — 2026-09-30

### Part 1 — the handoff

- **Foundational runs on `main`**, not behind a pull request. It owns every hot file by definition, no
  other lane is open to race it, so the pull request would have no reviewer and no conflict to prevent.
- **Branch protection goes on before the first story lane opens.** That is the moment ticket 01 was
  really pointing at when it recorded protection as due "at the first code task". Every phase after
  Foundational uses a worktree and a pull request, as principle VIII requires.
- **The bar for opening a story lane** is `tasks.md`'s Phase 2 checkpoint as written: every package has
  green unit and property tests, the shell renders, CI is green, the latency gate runs. A working
  typing line is **not** part of it — that is US1's own deliverable, and making it a precondition would
  collapse US1 into Foundational.

### Part 2 — throughput

Two of the three rules are amended, one is kept. **Constitution v2.1.0**, recorded in
[ADR-0009](../../../docs/adr/0009-test-gates-bind-per-phase-not-per-task.md).

- **Amended — the three-engine matrix binds at the pull request and on `main`**, not on every iteration
  inside a lane. A lane may run Chromium while building. Two exceptions, both narrower than the rule:
  CDP-only tests stay Chromium-only always, and **input-path tests run on all three engines from their
  first commit**. That second exception is the whole reason this relaxation is safe: research 06 proved
  the engines genuinely disagree there — Firefox ignores `preventDefault()` on `beforeinput` — so a
  Chromium-only green run on the keystroke engine would be misleading rather than merely weaker, and
  the defect it hides is the one that invalidates the product.
- **Amended — CI binds per phase and per pull request, not per task.** A task closes on a green local
  `pnpm test`. The per-task CI run added queue time, not information: the unit and property tests are
  the same tests on the same Node. Where CI does add information — the production build, three engines,
  axe, the latency gate, the secret scan — a phase boundary is the first point at which the pieces are
  assembled.
- **Kept — one story, one lane, one pull request** (principle VIII, unchanged). Seven pull requests are
  not the bottleneck; the pull request itself is cheap. The lane isolation is what keeps `tasks.md`
  reconcilable on `main` and makes "no lane imports another lane's unmerged code" checkable instead of
  hoped for. Batching F1's four small lanes was considered and rejected.
- **The fourth lever costs nothing and is already recorded**: `chrome-devtools` MCP as the inner loop in
  `plan.md`, which removes most of the reason to wait for CI while building a screen.

**Reversibility, stated so it is watched rather than assumed:** if a Firefox or WebKit defect reaches
`main` because a lane iterated on Chromium, the amendment was wrong, and the remedy is to restore
v2.0.0 item 2 rather than to accumulate exceptions. Worth checking specifically on the first two story
lanes.

Nothing graduates from the fog. The map's remaining patch is the jury-facing documents outline.
Implementation of F1 starts now, from `tasks.md` T001.

