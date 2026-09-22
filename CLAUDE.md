# Typing-Race — Claude Code

The canonical agent guide is `AGENTS.md`. It is imported here, so everything in it applies:

@AGENTS.md

The enforceable rules are in `.specify/memory/constitution.md`; `/speckit-analyze` reports a violation of any MUST there as CRITICAL. The workflow itself is decided in `docs/adr/0008-canonical-agent-workflow.md`.

## Claude Code specifics

- **Skills** live in `.claude/skills/` (gitignored, restored from the tracked `skills-lock.json`). Spec Kit is installed with the `claude` integration and `--script ps`, so its skills sit there too. Do not reinstall the `agy` integration, and do not install the Spec Kit `git` extension — its auto-branching and auto-commits fight this repo's git flow.
- **Worktrees**: start a lane with `claude --worktree <story-slug>`. `.claude/worktrees/` is gitignored, and `.worktreeinclude` copies `.env.local` and `.specify/feature.json` into each new lane. A worktree shares `.git`, plugins, permission approvals and the stash stack with the main checkout.
- **Subagents**: `code-review` spawns two by design — that is the only nesting allowed. No `implement-spec`, no `claude-handoff`, no agent teams. Research subagents run only from the main checkout.
- **Shell**: PowerShell is primary, the Bash tool is also available; each takes its own syntax. Avoid `&&` in PowerShell.
- **Language**: chat with the user in Ukrainian. Agent-facing artifacts (map, tickets, spec, plan, tasks, ADRs, `CONTEXT.md`, code, commits) are written in English; jury-facing documents (README, `docs/pedagogy.md`, `docs/data-sources.md`, the AI-use declaration) are written in Ukrainian.
