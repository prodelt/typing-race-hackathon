# 22 Task: Switch Spec Kit to the Claude integration and de-duplicate skills

Type: task
Status: resolved
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

Spec Kit now reports `claude` as the only installed integration, with `--script ps` preserved, and the ten `speckit-*` skills resolve under `.claude/skills/`. The switch was not a pure relocation: it also moved Spec Kit from **1.0.1 to 1.0.5.dev0**, rewriting four PowerShell scripts. The diffs were read before being accepted — `create-new-feature.ps1`, `common.ps1`, `check-prerequisites.ps1` and `setup-plan.ps1` contain **no** `git checkout`, `git switch` or `git branch` call, so research 07's finding still holds and one-worktree-per-story is safe. One of the fixes is directly useful here: `Get-BranchName` previously died with an `ArgumentNullException` when a feature description contained no Latin characters, which a Ukrainian description would have triggered.

`.specify/integrations/agy.manifest.json` is gone, `claude.manifest.json` replaces it. The one "modified managed file" the CLI warned about was `.specify/.gitignore`, not the constitution, and the switch preserved it because neither `--force` nor `--refresh-shared-infra` was passed. The constitution survives untouched at v2.0.0.

The `mattpocock-skills` plugin turned out to be installed at **user** scope, shared with the user's other projects, so disabling it outright would be a side effect well beyond this repo. The fix is narrower: `enabledPlugins` accepts `false` from project-level settings (entries that *enable* a plugin are honoured only from administrator-managed settings, but entries that *block* one are honoured from settings a user can write, and project settings override `~/.claude/settings.json`). So the plugin is blocked for this checkout alone, in a tracked `.claude/settings.json`, which also documents the decision for anyone cloning the repo. Nothing is lost by blocking it: all twelve skills the workflow names — `wayfinder`, `grilling`, `domain-modeling`, `research`, `prototype`, `code-review`, `codebase-design`, `tdd`, `resolving-merge-conflicts`, `writing-for-agents`, `wizard`, `diagnosing-bugs` — are present in `.claude/skills/` with their own `SKILL.md`, pinned by `skills-lock.json`.

The Spec Kit `git` extension is confirmed absent: no `.specify/extensions.yml` and no `.specify/extensions/` directory, so no `before_specify` branch creation and no `after_*` auto-commits.

Two side cleanups landed with it. `.specify/.gitignore` lost the general-purpose block appended to it (`node_modules/`, `dist/`, `.agents/`, `.claude/`, `skills/`, `tasks/` and the rest); every one of those entries was a no-op, because a nested `.gitignore` only matches inside its own directory and `.specify/` contains none of them, while the root `.gitignore` already covers what matters. What is left is the two real entries, `feature.json` and `extensions/*/local-config.yml`. And `.specify/feature.json` still pointed at `specs/001-touch-typing-platform`, a directory that never existed under that name and predates the vertical re-cut in ticket 16; it now points at `specs/001-typing-core`, matching the roadmap. `/speckit-specify` rewrites the pointer itself through `Save-FeatureJson`, so this only matters for the window before ticket 23 runs — but a pointer at a missing directory is exactly the trap `AGENTS.md` warns about when it says to check the path every `speckit-*` script prints.

Two steps were performed by the user, because the session's permission classifier blocks an agent from deleting a large local tree and from writing its own settings file:

- `Remove-Item -Recurse -Force .agents` — the duplicated skill copies. `.agents/` held nothing but `skills/`, nothing under it was tracked, and it is restorable from `skills-lock.json`. A backup was taken first.
- Creating `.claude/settings.json` with `"enabledPlugins": { "mattpocock-skills@claude-plugins-official": false }`.

After those, each skill resolves from exactly one place: `.claude/skills/`, pinned by the tracked `skills-lock.json`. The dedup only takes effect on the next session start, since the skill menu is built once per session — so ticket 23 must be run from a fresh session, not this one.
