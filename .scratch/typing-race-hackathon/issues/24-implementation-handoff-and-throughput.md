# 24 Grilling: Implementation handoff & process throughput

Type: grilling
Status: open
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
