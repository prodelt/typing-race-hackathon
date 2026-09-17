# Typing-Race Constitution

Governing engineering principles and development standards for the Typing-Race project.

## Core Principles

### I. Spec-Driven & Design-First

Every non-trivial feature or architectural change begins with an explicit specification (`/speckit-specify` or `/to-spec`) and technical implementation plan (`/speckit-plan`). Ambiguities must be resolved before writing code.

### II. Test-Driven Development (TDD)

Where core logic is involved (WPM calculation, race timer state machine, input verification, networking protocols), development strictly adheres to the Red-Green-Refactor cycle. Tests verify expected behavior before production code is considered done.

### III. Deep Modules & Information Hiding

Interfaces should be simple, clean, and expressive, hiding implementation details and complex state inside deep modules. Avoid shallow wrappers and scattered state.

### IV. Premium Visual Aesthetics & Real-time Responsiveness

Typing-Race interfaces must feel dynamic, responsive, and visually stunning:

- Modern typography, sleek color palettes, dark mode by default.
- Micro-animations for keystroke accuracy, race progression, and real-time competitor positions.
- Low input latency is critical: typing responsiveness must never lag.

### V. Cross-Tool Agent Compatibility

Agent configurations must maintain cross-compatibility across Antigravity, Claude Code, Codex, and Gemini. `AGENTS.md` is the canonical standard; `CLAUDE.md` and `.gemini/GEMINI.md` are kept aligned.

## Development Workflow & Quality Gates

1. **Specify**: `/speckit-specify` (or `/to-spec`)
2. **Plan & Review**: `/speckit-plan` (or `/grill-me` / `/grill-with-docs`)
3. **Tasks**: `/speckit-tasks` (or `/to-tickets`)
4. **Implement**: `/speckit-implement` (or `/tdd` / `/implement`)
5. **Converge & Review**: `/speckit-converge` and `/code-review`

## Governance

- The Constitution supersedes ad-hoc coding patterns.
- Amendments require updating this document and recording an architectural decision record (ADR).

**Version**: 1.0.0 | **Ratified**: 2026-09-03 | **Last Amended**: 2026-09-03
