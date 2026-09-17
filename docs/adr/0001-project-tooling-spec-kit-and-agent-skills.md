# ADR 0001: Project Tooling — Spec Kit & Matt Pocock Agent Skills

- **Status**: Accepted
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
