# 16 Grilling: Multi-agent workflow & constitution

Type: grilling
Status: open
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
