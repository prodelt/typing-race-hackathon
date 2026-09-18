# 07 Research: Combining Spec Kit and Matt Pocock's skills for parallel agents

Type: research
Status: resolved
Blocked by: none

## Question

How should the two tool sets combine into one non-overlapping workflow for several parallel Claude Code agents in git worktrees, without production hell?
- **Spec Kit:** constitution → specify → clarify → plan → tasks → analyze → implement → converge.
- **Matt Pocock's skills:** wayfinder, grilling, domain-modeling, to-spec, to-tickets, triage, tdd, implement, code-review, diagnosing-bugs, codebase-design, handoff.

Find:
- Overlaps and conflicts: to-spec vs speckit-specify, to-tickets vs speckit-tasks, implement vs speckit-implement.
- Which artifact is canonical at each step.
- How `tasks.md` `[P]` markers map to parallel lanes and file ownership.
- Where TDD and the E2E Definition of Done plug in.
- Review and merge gates.
- Handoff conventions.
- One Spec Kit feature vs several.
- The effect of the current `.specify` integration being `agy` (Antigravity) rather than Claude.
- Relevant Claude Code features: subagents, worktrees, hooks, agent teams.
- Real-world usage evidence.

**Inputs:**
- local clones in `skills/` and `spec-kit/`;
- `.agents/skills/*/SKILL.md`;
- `.specify/`;
- official Spec Kit and Claude Code docs.

## Deliverable

`docs/research/07-speckit-pocock-workflow.md` on `main` (folded from its research branch in `2dcaba0`): a workflow diagram, a role/skill matrix, and a proposed recommendation.

## Answer

Resolved 2026-09-17 by a research subagent. Findings: `docs/research/07-speckit-pocock-workflow.md` on `main` (folded from its research branch in `2dcaba0`) (351 lines, 11 sections).

**Proposed workflow** (input for ticket 16, not yet decided)

Wayfinder owns everything before a spec (fog, decisions, research) and produces `specs/roadmap.md`. Then per feature, in the main checkout: `specify → clarify → plan → checklist → tasks → analyze`. Lane 0 builds Setup + Foundational tasks and merges first. Then 3–4 lanes, **one user story each**, in `claude --worktree` checkouts: `/speckit-implement` scoped to that story with `/tdd` inside, Playwright E2E named after the story's "Independent Test" line, `/code-review` since merge-base, PR, green CI, human squash merge. `/speckit-converge` runs once per feature at the end.

**Conflicts resolved**

| Conflict | Canonical | Why |
|---|---|---|
| to-spec vs speckit-specify | `speckit-specify` | everything downstream reads `FEATURE_DIR/spec.md` |
| to-tickets vs speckit-tasks | `speckit-tasks` | its `[P]` / `[US]` / file-path format is the machine contract |
| implement / implement-spec vs speckit-implement | `speckit-implement` | `implement-spec`'s merger subagents fight protected `main`, and nested agents are exactly what blew our usage limit twice |
| taskstoissues vs triage | neither; `tasks.md` stays the single source of build state | they solve opposite problems |
| analyze vs code-review vs converge | all three, non-overlapping | artifacts / diff / codebase |

**Key facts**
- `[P]` is an intra-lane hint only. **The parallel unit is the user-story phase**, not the individual task.
- Spec Kit no longer creates branches (that moved to an optional git extension we should not install), and active-feature state lives in gitignored `.specify/feature.json`. That is precisely why one worktree per feature/story works. Spec Kit's own docs recommend worktrees for parallel slices.
- **Tests are opt-in in Spec Kit**, so our E2E + TDD Definition of Done has to live in the constitution. `analyze` then flags any gap as CRITICAL.

**Recommendations**
- Five Spec Kit features: typing core, dictionary pipeline, accounts/sync, Academy, races.
- `specify integration switch claude --script ps`.

**Open questions** (for ticket 16)
- Who ticks off `tasks.md`.
- Whether to mirror tasks as GitHub issues (would need the GitHub MCP).
- Constitution v1.0.0 amendment plus an ADR.
- Whether Antigravity parity is still required.
