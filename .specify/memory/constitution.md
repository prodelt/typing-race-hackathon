# Typing-Race Constitution

Governing engineering principles and development standards for the Typing-Race project.
`/speckit-analyze` treats a violation of any MUST below as a CRITICAL finding.

## Core Principles

### I. Spec-Driven & Design-First

Every non-trivial feature or architectural change MUST begin with a specification (`/speckit-specify`) and a technical plan (`/speckit-plan`). Ambiguity is resolved before code: `/speckit-clarify` runs until no `NEEDS CLARIFICATION` marker remains in the spec. Decisions that are hard to reverse, surprising without context, and the result of a real trade-off are recorded as ADRs in `docs/adr/`; domain vocabulary is recorded in `CONTEXT.md` and nowhere else.

Scope changes update `specs/roadmap.md` first, then the affected feature's artifacts. The persistence model is **flow-back**: any artifact may be edited directly, and drift is caught by `/speckit-analyze` and `/speckit-converge` rather than by forbidding edits.

### II. Test-Driven Development & Definition of Done

Domain logic — metrics (SPM/CPM/WPM, accuracy, delays), error counting, the keystroke state machine, key and transition confidence, unlock rules, word filtering, race state transitions — MUST be developed Red-Green-Refactor and MUST carry property-based tests alongside example tests. A task is not done until its tests are green.

A user story is not done until all of the following hold:

1. Every user-visible acceptance scenario in the spec is covered by a Playwright E2E test, run against the **production build**, named after the story's "Independent Test" line in `tasks.md`.
2. The E2E matrix is Chromium, Firefox and WebKit, **except** tests tagged CDP-only, which simulate a physical keyboard layout through the Chrome DevTools Protocol and therefore run in Chromium alone.
3. Server features are tested against local Supabase in Docker; race features are tested across several browser contexts.
4. Accessibility checks report zero axe violations, and visual checks run with animation disabled.
5. CI is green: typecheck, lint, unit, E2E, build, dictionary checksum verification and secret scan.

Tests are opt-in in Spec Kit, so every `/speckit-specify` and `/speckit-tasks` run MUST state this Definition of Done explicitly.

### III. Deep Modules & Information Hiding

Public API surfaces stay minimal; keystroke buffering, inter-key-interval calculation, finger-mapping tables, sync transport and race transport are hidden inside deep modules. Shallow wrappers and state scattered across layers are defects, not style preferences. Every module that talks to the outside world MUST be reachable through a seam with an in-memory adapter, and the seams are agreed before tests are written.

### IV. Calm Visual Design & Real-Time Responsiveness

The "Serene Script" **light** theme is the default; a dark theme and a low-vision preset are additional, never the baseline. Motion follows the rule **expressive frame, calm text**: rich motion on results, unlocks, the race track and route transitions; only caret glide and subtle character feedback inside the typing line. All motion and all sound MUST be switchable off by a single app-level flag, which also makes E2E screenshots deterministic.

Input latency is a correctness property, not a nicety: p95 keystroke-to-paint MUST stay at or below 16 ms, enforced in CI.

### V. Claude Code Is the Only Runtime

`AGENTS.md` is the canonical prose guide for agents; `CLAUDE.md` imports it and adds only Claude-specific operation. Claude Code is the sole wired-up runtime — Spec Kit is installed with the `claude` integration, and skills live in `.claude/skills/`. Cross-tool parity with Antigravity, Gemini CLI or Codex is explicitly not a requirement, because duplicate skill installs let an agent invoke a stale copy.

### VI. Public Repository & Zero Secrets

The repository is public from the first commit. No secret, key, token or connection string is ever committed; only `.env.example` is tracked, and real values live in Vercel and GitHub secrets. Organizer material marked REVIEW_REQUIRED or NOT_DECLARED MUST NOT be committed, and curriculum content is built only from sources with an explicit licence recorded in the dictionary manifest. A secret scan is a blocking CI job.

### VII. Mandatory Authentication

Every learner signs in; there is no anonymous practice mode ([ADR-0002](../../docs/adr/0002-mandatory-authentication.md)). Attempts are append-only and progress is derived server-side from them ([ADR-0005](../../docs/adr/0005-append-only-attempts-as-source-of-truth.md)), with the server recomputing every metric from the keystroke log using the client's own packages ([ADR-0007](../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md)). Offline practice is supported through a local cache and an outbox queue, never by weakening the account requirement.

### VIII. One Story, One Lane

The unit of isolation is the **user story**: one story = one worktree = one branch = one PR. A task is one Conventional Commit and one `[X]` inside that branch. `[P]` is a batching hint inside a single lane and MUST NOT be split across lanes.

Hot files — `package.json`, the lockfile, `tsconfig*`, Vite/Tailwind config, design tokens, CI workflows, the root router, shared barrels — change only in a feature's **Foundational phase**, which merges before that feature's stories fan out. A story lane MUST NOT edit them, and MUST NOT import code from another lane that has not yet merged.

Each feature's `plan.md` MUST carry a file-ownership table derived from the file paths in `tasks.md`, grouped by `[US]` label, with the paths asserted disjoint. Overlapping paths mean the stories are not independent and are re-cut before any lane starts. Lanes tick only the `[X]` lines inside their own story phase; the human reconciles `tasks.md` on `main` after each squash merge.

### IX. No Nested Agents

The usage budget, not the tooling, is the binding constraint. `implement-spec`, `claude-handoff` and agent teams MUST NOT be used; `code-review`'s two parallel sub-agents are the only sanctioned nesting, and research subagents run only from the main checkout, never from inside a lane. At most three lanes run concurrently; two is the working default.

## Development Workflow & Quality Gates

Canonical chain per feature, run from the main checkout:

1. `/speckit-specify` → `specs/<NNN>-<slug>/spec.md`
2. `/speckit-clarify` — repeat until no `NEEDS CLARIFICATION` remains
3. `/speckit-plan` → `plan.md`, `research.md`, `data-model.md`, `contracts/`, agreed seams, file-ownership table
4. `/speckit-checklist` — requirement quality
5. `/speckit-tasks` → `tasks.md`, with the Definition of Done stated in the request
6. `/speckit-analyze` — fix findings at the source and re-run

Then, per story, in its own worktree: `/speckit-implement` scoped to that story phase, with `/tdd` inside each task; the story's Independent Test as a Playwright spec; `/code-review <merge-base>`; push; PR.

| Gate | Where | Pass condition |
|---|---|---|
| G0 Artifacts | main checkout | `/speckit-analyze`: no CRITICAL, no unaddressed HIGH |
| G1 Requirements | main checkout | `/speckit-checklist` items ticked |
| G2 Story | lane worktree | all story tasks done, Independent Test passes locally |
| G3 Diff | lane worktree | `/code-review <merge-base>`: every finding fixed or waived in the PR body |
| G4 CI | PR | all jobs green, plus E2E re-run against the Vercel preview |
| G5 Merge | PR | human squash merge; branch and worktree removed |
| G6 Feature | main checkout | `/speckit-converge` reports `converged`, plus `/code-review main...HEAD` |

Other skills keep single, non-overlapping jobs: `wayfinder` before a spec exists, `grilling` and `domain-modeling` for decisions, `research` for facts outside the working directory, `prototype` for design questions, `diagnosing-bugs` for defects (whose fix is appended to `tasks.md`), `codebase-design` for module seams. `to-spec`, `to-tickets` and `implement-spec` are not used. `triage` is reserved for post-demo incoming reports. `tasks.md` is the single source of build state; there is no GitHub issue mirror.

`main` is protected and squash-merge only. Lanes rebase before opening a PR and never merge `main` into a lane branch. Worktrees share one stash stack, so `git stash` MUST NOT be used inside a lane.

## Governance

- The Constitution supersedes ad-hoc coding patterns. `/speckit-analyze` reports any MUST violation as CRITICAL.
- **Waivers.** A MUST may be waived for a single PR when the gate is wrong for that specific case, never to save effort. A waiver requires a `Waived: <principle> — <reason>` line in the PR body and a matching note in the feature's `plan.md`. A principle waived twice is a defect in the principle: amend it instead.
- Amendments require updating this document, bumping the version, and recording an ADR. MAJOR removes or redefines a principle; MINOR adds one or materially expands guidance; PATCH clarifies wording.
- This version is recorded in [ADR-0008](../../docs/adr/0008-canonical-agent-workflow.md), which supersedes part of [ADR-0001](../../docs/adr/0001-project-tooling-spec-kit-and-agent-skills.md).

**Version**: 2.0.0 | **Ratified**: 2026-09-03 | **Last Amended**: 2026-09-22
