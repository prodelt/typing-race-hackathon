# Typing-Race: Touch-Typing Platform & Real-Time Race

## Overview

Typing-Race is a release-ready, pedagogical touch-typing training system and real-time multiplayer speed racing application. It implements a rigorous 3-stage learning methodology (Stage 1: Scales, Stage 2: Words from unlocked keys, Stage 3: Academy frequency n-grams/morphemes/tempo), zero-peek blind typing enforcement, and actionable feedback analytics, coupled with competitive multiplayer racing lobbies.

## Multi-Agent Architecture & Roles

To ensure high-velocity, conflict-free multi-agent execution, development is partitioned across five dedicated agent roles:

1. **Architect & Spec Agent (`agent:architect`)**:
   - Scope: `/wayfinder`, `/speckit-plan`, `/speckit-tasks`, `/domain-modeling`, ADRs.
   - Deliverables: Feature specifications, task graphs, architecture decision records, data models in `CONTEXT.md`.
2. **Core Logic & TDD Agent (`agent:logic-tdd`)**:
   - Scope: `/tdd`, typing state machines, physical key-to-finger bindings (ЙЦУКЕН / QWERTY), SPM/CPM/WPM formulas, error tracking, dictionary pipelines.
   - Deliverables: Unit and property-based tests (Vitest), pure business logic modules with 100% test coverage.
3. **UI & Stitch Designer Agent (`agent:ui-stitch`)**:
   - Scope: StitchMCP screens (`projects/16341605640151885435`), "Serene Script" design system, sub-16ms input loop, smooth caret animations, interactive heatmaps.
   - Deliverables: Accessible, distraction-free React 19 / Tailwind components, responsive layouts (>1024px).
4. **Backend & Supabase Agent (`agent:backend-supabase`)**:
   - Scope: Supabase client, PostgreSQL schemas, Row-Level Security (RLS) policies, Realtime Broadcast channels for multiplayer racing, local-to-cloud progress merge.
   - Deliverables: Database migrations, typed Supabase clients, room synchronization handlers.
5. **Quality Gate & Judge Agent (`agent:judge-qa`)**:
   - Scope: `speckit-converge`, `code-review`, ELT oracle, dictionary license audits, Vercel build verification, hackathon scoring criteria (100/100).
   - Deliverables: Verification reports, performance audits (Lighthouse 95+), automated test proof.

## Agent Skills & Workflows

### Issue Tracker & Wayfinder
- Tasks, decisions, and fog-of-war maps live in `.scratch/typing-race-hackathon/` (`map.md` and `issues/NN-<slug>.md`).
- Active feature specifications live under `specs/` (e.g. `specs/001-touch-typing-platform/`).

### Available Tooling & Slash Commands
- **Spec Kit (Spec-Driven Development)**:
  - `/speckit-constitution` — Establish project principles
  - `/speckit-specify` — Create feature specification
  - `/speckit-plan` — Create technical implementation plan
  - `/speckit-tasks` — Generate actionable task breakdown
  - `/speckit-implement` — Execute implementation tasks
  - `/speckit-converge` — Assess codebase against spec and append remaining work
  - `/speckit-clarify` — De-risk ambiguous requirements before planning
  - `/speckit-checklist` — Generate requirements validation checklists
  - `/speckit-analyze` — Cross-artifact consistency report
- **Matt Pocock's Skills**:
  - `/to-spec` — Synthesize conversation into a formal spec
  - `/to-tickets` — Break down spec into tracer-bullet tickets with blocking edges
  - `/triage` — Move issues through triage state machine
  - `/tdd` — Test-driven development (Red-Green-Refactor)
  - `/implement` — Implement a piece of work based on a spec
  - `/code-review` — Review changes along Standards and Spec axes in parallel
  - `/diagnosing-bugs` — Structured diagnosis loop for hard bugs and regressions
  - `/domain-modeling` — Refine domain model in `CONTEXT.md` and ADRs
  - `/wayfinder` — Map and resolve large multi-session efforts

## Tech Stack

- **Frontend Runtime**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS + Custom CSS Variables ("Serene Script" paper & ink design system)
- **State Management**: Zustand (isolated unbuffered stores for sub-16ms keystroke latency)
- **Design & Mockups**: StitchMCP (Project `projects/16341605640151885435`)
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Realtime Channels)
- **Deployment**: Vercel (zero-config static / edge frontend)
- **Testing**: Vitest + Testing Library + Playwright

## Design System: "Serene Script"

- **Philosophy**: Paper & Ink tactile ergonomics. Calming, soft-light palette designed to eliminate eye fatigue during intense typing practice.
- **Palette**:
  - Background (Cream Paper): `#FAF9F5` / `#F8FAF5`
  - Text (Soft Slate): `#2D312E` / `#191C19`
  - Correct / Primary (Sage Green): `#4A7C59` / `#316342`
  - Error / Attention (Gentle Terracotta): `#D95D39` / `#BA1A1A`
  - Upcoming / Secondary (Muted Slate): `#94A3B8` / `#717971`
- **Typography**:
  - Typing Area: `Source Serif 4` (28px, 1.5 line height)
  - UI Labels & Instructions: `Source Sans 3`
  - Metrics & Shortcuts: `JetBrains Mono`

## Repository Structure

```text
Typing-race/
├── .agents/skills/      # Cross-agent skills (Spec Kit + Matt Pocock)
├── .claude/             # Claude Code integration & commands
├── .scratch/            # Wayfinder map and decision tickets
│   └── typing-race-hackathon/
│       ├── map.md
│       └── issues/
├── .specify/            # Spec Kit templates, scripts & active feature state
│   ├── feature.json
│   └── memory/
│       └── constitution.md
├── docs/                # Architecture decision records and agent docs
│   └── adr/
├── specs/               # Spec Kit feature specs and validation checklists
│   └── 001-touch-typing-platform/
│       ├── spec.md
│       └── checklists/
├── tasks/               # Hackathon reference specifications and raw dictionaries
│   └── Typing-Race-2026-Hackathon/
├── CONTEXT.md           # Domain glossary and concept models
├── AGENTS.md            # Canonical cross-tool agent guide
└── CLAUDE.md            # Native Claude mirror
```

## Commands

- Spec Kit status: `specify status` | `specify check`
- Test suite: `npm run test` (Vitest)
- Dev server: `npm run dev` (Vite)
- Build: `npm run build`

## Code Style & Testing Rules

- **Deep Modules**: Keep public API surfaces minimal; hide keystroke buffering, IKI calculations, and finger-mapping tables inside deep internal modules.
- **TDD Requirement**: Red-Green-Refactor cycle is mandatory for metrics (SPM, WPM, accuracy %, delay calculation), word filtering algorithms, and multiplayer state transitions.
- **Error Counting**: Keystrokes typed incorrectly must always count toward the total error count, even when corrected using Backspace.
- **Zero-Peek Blind Mode**: In test evaluation modes, on-screen keyboard guides and next-key highlights must be hidden.

## Gotchas

- On Windows PowerShell, avoid `&&`; use `;` or separate invocations.
- External libraries: use `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` before writing code against new libraries.
- No secrets in commits: keep `.env.example` committed, never `.env.local`.
