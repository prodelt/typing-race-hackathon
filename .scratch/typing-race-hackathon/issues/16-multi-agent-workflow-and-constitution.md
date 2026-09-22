# 16 Grilling: Multi-agent workflow & constitution

Type: grilling
Status: resolved
Blocked by: 07, 11, 15

## Question

What workflow do parallel agents follow from spec to merged task, and what does the constitution enforce?

**Workflow**
- The final Spec Kit × Pocock-skills combination.
- Agent roles: reconcile the five roles in `CLAUDE.md`.
- Lanes and file ownership per folder.
- Worktree, branch and PR conventions.
- Task flow: claim → TDD → E2E → CI → code-review → merge.
- Handoff notes.
- One Spec Kit feature vs several.

**Constitution amendments**
- Remove "dark mode by default", which contradicts Serene Script.
- Add the E2E Definition of Done.
- Add public-repo secret rules.
- Add mandatory authentication.

**Alignment:** keep `AGENTS.md`, `CLAUDE.md` and `.gemini` in step.

Inputs from research 07:
- Proposed canonical chain and lane model (Lane 0 builds Setup + Foundational and merges first; then one user story per lane).
- Canonical picks: speckit-specify over to-spec; speckit-tasks over to-tickets; speckit-implement over implement/implement-spec (its merger subagents fight protected main, and nested agents blew our usage limit twice); tasks.md as the single source of build state; analyze/code-review/converge as three non-overlapping gates.
- Proposed five features: typing core, dictionary pipeline, accounts/sync, Academy, races.
- Proposed `specify integration switch claude --script ps`.
- Still to decide: who ticks off tasks.md; GitHub issue mirroring; the constitution amendment and its ADR; whether Antigravity parity still matters.

## Answer

Resolved 2026-09-22 by a grilling session. The decision is recorded in [ADR-0008](../../../docs/adr/0008-canonical-agent-workflow.md) and made enforceable by constitution **v2.0.0**. Research 07's proposal was adopted with **five amendments**, all found by re-reading it critically before executing.

### Workflow

**Ownership boundary.** Wayfinder owns everything before a spec exists; Spec Kit owns the artifact chain per feature; the Pocock practice skills (`tdd`, `code-review`, `diagnosing-bugs`, `codebase-design`, `domain-modeling`) are called *inside* Spec Kit steps. `to-spec`, `to-tickets` and `implement-spec` are retired for the build; `triage` waits for post-demo reports; `tasks.md` is the single source of build state.

**Feature split — five features, but re-cut vertically** (amendment 1, the substantive one). Research 07 proposed cutting by layer: typing core, dictionary pipeline, accounts, academy, races. Rejected, because `002-dictionary-pipeline` would have had **no user story at all** — and Spec Kit's `tasks.md` is built entirely around user stories with an "Independent Test" line, so a build-time concern does not fit the form. A layered cut also postpones validation: a mistake in the pipeline's data shape would only surface weeks later, when the Academy finally consumed it. The pipeline moved inside the feature that first consumes it, and every feature is now independently demonstrable:

| ID | Directory | Depends on |
|---|---|---|
| F1 | `001-typing-core` | — |
| F2 | `002-accounts-and-progress` | F1 |
| F3 | `003-words-and-curriculum` — dictionary pipeline is its Foundational phase | F1 |
| F4 | `004-academy-and-analytics` | F2, F3 |
| F5 | `005-races-and-leaderboards` | F2 |

Order: F1 alone, then F2 ∥ F3, then F4 ∥ F5 — the same parallelism as the layered proposal, without the undemonstrable feature. Recorded in `specs/roadmap.md`; IDs are immutable once referenced; scope shifts edit the roadmap first. The empty `specs/001-touch-typing-platform/` was removed.

**Amendment 2 — the justification for decomposition is honesty about what it buys.** Research 07 justified five features by `tasks.md` conflict pressure across 3–4 lanes. That argument weakened the moment lanes dropped to two (below), since two lanes already tick disjoint `[US]` blocks. Decomposition stands on **independent demonstrability**, and ADR-0008 records it that way rather than repeating the conflict argument.

**Lanes.** Story, not task, is the unit of isolation: one user story = one worktree = one branch = one PR; a task is one Conventional Commit and one `[X]`. This overrules the map's earlier standing decision of "one branch per task" — that would have produced 5–15 PRs per story for one human to review. CI runs on every push, so "a task closes only against a green run" survives intact. Lanes tick only their own `[US]` lines, conflicts resolve as "keep both sides", the human reconciles on `main`; the fallback if that gets noisy is human-only ticking.

**Two concurrent lanes, ceiling three**, not the 3–4 research assumed. The binding constraints are one human reviewing PRs and the usage budget, not the tooling.

**No specialised agent roles.** The five roles in `AGENTS.md`/`CLAUDE.md` (`agent:architect`, `agent:logic-tdd`, `agent:ui-stitch`, `agent:backend-supabase`, `agent:judge-qa`) are dropped: current models handle any lane without a role prompt, and the descriptions had drifted into fiction, still naming a Stitch project and tools this stack no longer uses. What they really encoded — file ownership — is kept, but **derived per feature** rather than declared once: each `plan.md` groups the file paths in `tasks.md` by `[US]` label and asserts they are disjoint. Overlapping paths mean the stories are not independent, and that is fixed at `/speckit-tasks` before any lane starts. A static project-wide table would be stale by the second feature.

**Amendment 3 — hot files belong to a Foundational phase, not to "Lane 0".** The research rule "hot files belong to Lane 0 only" becomes a rule with no owner once Lane 0 merges and F3 needs a CI job for dictionary checksums. Corrected invariant: hot files change only in **a feature's Foundational phase**, which merges before that feature's stories fan out. "Lane 0" is a role inside each feature, not a one-time global event. The global foundation still lives in F1; later features' Foundational phases are short.

**Amendment 4 — do not fight `claude --worktree` over branch names.** It generates `worktree-<name>`, not `feat/us1-<slug>`. Squash-merge erases branch names from history and `code-review` pins `merge-base`, not a name, so the generated name is accepted.

**Gates**, six, non-overlapping: G0 `/speckit-analyze` (artifacts) · G1 `/speckit-checklist` (requirement quality) · G2 TDD + the story's Independent Test in the lane · G3 `/code-review <merge-base>` in the lane before the PR · G4 CI, plus an E2E re-run against the Vercel preview · G5 human squash merge · G6 `/speckit-converge` once per feature plus a final `/code-review main...HEAD`.

**Handoff is a context pointer, never a copy.** A lane starts with the feature directory, story id, its ownership lines and the branch. The PR body is the handoff document: story id, tasks covered, Independent Test, `code-review` summary, CI link, any `Waived:` line. No separate handoff documents; `claude-handoff` is not used.

**No GitHub issue mirror.** `/speckit-taskstoissues` needs the GitHub MCP server and would create hundreds of issues with no labels and no blocking edges. The public repository already shows the process artifacts — map, tickets, ADRs, research.

**No nested agents.** `code-review`'s two sub-agents are the only sanctioned nesting; research subagents run only from the main checkout. This is what blew the usage budget twice.

### Constitution v2.0.0

MAJOR, because principles IV and V are redefined and four principles are added. Nine principles: I Spec-Driven & Design-First (with flow-back persistence and roadmap-first) · II TDD & Definition of Done · III Deep Modules · IV Calm Visual Design & Real-Time Responsiveness · V Claude Code Is the Only Runtime · VI Public Repository & Zero Secrets · VII Mandatory Authentication · VIII One Story, One Lane · IX No Nested Agents. Plus the canonical chain, the gate table, and Governance.

**Amendment 5 — the constitution needed a release valve and one precision fix.**

- **Waivers.** `/speckit-analyze` reports any MUST violation as CRITICAL, so a heavy Definition of Done is a ratchet: the only way past a badly-worded MUST would be a version bump. Governance now defines an explicit escape — a `Waived: <principle> — <reason>` line in the PR body plus a matching note in the feature's `plan.md`, allowed only when the gate is wrong for that case and never to save effort. A principle waived twice is a defect in the principle.
- **Three-engine E2E, stated precisely.** [Ticket 06](06-quality-tooling-research.md) proved Playwright cannot type Cyrillic through the keyboard API and that simulating a physical ЙЦУКЕН layout needs CDP, which is Chromium-only. A blanket "every E2E on three engines" MUST would make `analyze` flag those tests as violations. Principle II therefore reads: Chromium, Firefox and WebKit, **except** tests tagged CDP-only.

### Alignment

`AGENTS.md` is now the single canonical document, rewritten against the decisions of tickets 09–21 (real stack, lane rules, Serene Script with the light theme as default, the motion rule, product invariants, gotchas). `CLAUDE.md` is a short file that imports it with `@AGENTS.md` and adds only Claude-specific operation: skills location, worktrees, subagent limits, shell, language policy. `.gemini/GEMINI.md` is **deleted** — Claude Code is the only runtime. Three near-identical copies had already drifted apart once.

[ADR-0001](../../../docs/adr/0001-project-tooling-spec-kit-and-agent-skills.md) is marked superseded in part: its cross-tool premise and its listing of `to-spec`/`to-tickets`/`implement` as equal alternatives no longer hold.

### Tooling follow-up

`.worktreeinclude` was added at the root (`.env.local`, `.specify/feature.json`) so each lane gets its own Spec Kit active-feature state. The Spec Kit integration switch (`agy` → `claude`) and skill de-duplication are manual and touch the running session's own skills, so they became [ticket 22](22-spec-kit-integration-switch.md) rather than being done here. The Spec Kit `git` extension stays uninstalled.
