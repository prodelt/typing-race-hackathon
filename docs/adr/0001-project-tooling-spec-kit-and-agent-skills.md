# ADR 0001: Project Tooling — Spec Kit & Matt Pocock Agent Skills

- **Status**: Accepted, superseded in part by [ADR-0008](0008-canonical-agent-workflow.md)
- **Date**: 2026-09-03
- **Deciders**: Engineering Team

## Context

The Typing-Race project requires a structured, resilient development workflow with AI coding agents (Antigravity, Claude Code, Gemini CLI, Codex). Ad-hoc "vibe coding" often results in context rot, architectural divergence, missed edge cases, and hard-to-maintain code.

## Decision

1. Adopt **GitHub Spec Kit** (`specify-cli`) for spec-driven development (SDD):
   - Specifications (`/speckit-specify`)
   - Architecture implementation planning (`/speckit-plan`)
   - Task breakdown (`/speckit-tasks`)
   - Implementation & convergence (`/speckit-implement`, `/speckit-converge`)
   - Project constitution (`.specify/memory/constitution.md`)

2. Adopt **Matt Pocock's Skills** suite (`mattpocock/skills`) for engineering discipline:
   - TDD, Code Review, Bug Diagnosis, Domain Modeling, Deep Modules
   - Interactive grilling sessions (`/grill-me`, `/grill-with-docs`)
   - Issue tracker abstraction (`docs/agents/issue-tracker.md`)
   - Canonical triage roles (`docs/agents/triage-labels.md`)

## Consequences

- Specifications and ADRs precede code changes for major features.
- Agents operate via standardized skills registered under `.agents/skills/` and `.claude/skills/`.
- Cross-tool alignment is maintained via `AGENTS.md` and native mirrors.

## Superseded in part

[ADR-0008](0008-canonical-agent-workflow.md) (2026-09-22) keeps the two tool sets but narrows this decision:

- The cross-tool premise is dropped. Claude Code is the only wired-up runtime; Antigravity, Gemini CLI and Codex are no longer targets, so skills live in `.claude/skills/` alone and `.gemini/GEMINI.md` is removed.
- `to-spec`, `to-tickets` and `implement-spec` are not used for the build; the Spec Kit artifact chain is canonical and the Pocock practice skills are called inside it.
- `triage` and `docs/agents/triage-labels.md` are reserved for post-demo incoming reports, not for build state; `tasks.md` is the single source of build state.
