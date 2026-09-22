# 22 Task: Switch Spec Kit to the Claude integration and de-duplicate skills

Type: task
Status: open
Blocked by: 16
Mode: HITL (the user runs the commands; the switch rewrites the skills the running session is using)

## Question

Nothing to decide — [ticket 16](16-multi-agent-workflow-and-constitution.md) decided it. This is the manual work that has to happen **before** the first `/speckit-specify` run, because switching the integration mid-flight is risk R10 in [research 07](../../../docs/research/07-speckit-pocock-workflow.md).

Current state:
- `.specify/integration.json` and `.specify/init-options.json` both say `agy`, so the ten `speckit-*` skills live in `.agents/skills/` — Antigravity's layout, for a runtime this project no longer uses.
- The Pocock skills are installed **twice**, in `.agents/skills/` and `.claude/skills/`, and the `mattpocock-skills` plugin is loaded on top, so several skills appear three times in one session and an agent may invoke a stale copy.

Steps, from the main checkout:

1. `specify integration switch claude --script ps` — keep PowerShell scripts; every installed skill calls `.specify/scripts/powershell/*.ps1`.
2. `specify integration status` — confirm `claude` is the only installed integration and the skills now resolve under `.claude/skills/`.
3. Delete `.agents/skills/` (gitignored; restorable from `skills-lock.json` and `specify init`).
4. Disable the `mattpocock-skills` plugin so `.claude/skills/` plus the tracked `skills-lock.json` is the single pinned source.
5. Confirm the Spec Kit `git` extension is **not** installed — `.specify/extensions.yml` must stay absent, or its `before_specify` branch creation and `after_*` auto-commits will fight the one-branch-per-story flow.
6. Sanity check: invoke one `speckit-*` skill and confirm each skill now appears exactly once in the session menu.

Also worth doing while there: `.specify/.gitignore` has acquired a general-purpose ignore block (`.agents/`, `.claude/`, `docs/`, `tasks/`, `skills/`) which only ever applies *inside* `.specify/`, so those entries are no-ops. The root `.gitignore` already covers what matters.

## Answer
