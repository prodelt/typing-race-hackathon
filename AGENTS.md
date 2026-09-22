# Typing-Race: Touch-Typing Platform & Real-Time Race

Canonical guide for agents working in this repository. `CLAUDE.md` imports this file and adds only Claude Code operation; there is no other runtime.

## Overview

Typing-Race is a pedagogical touch-typing trainer for Ukrainian and English with live multiplayer races and group leaderboards. It implements a three-stage curriculum (Stage 1 scales on unlocked keys, Stage 2 words built only from unlocked keys, Stage 3 Academy n-grams, morphemes and tempo), zero-peek blind test attempts, and feedback analytics that always name one next action.

The binding requirements document is `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md` (organizer material, gitignored, never committed).

## How work is organised

Planning and building are separate phases with separate tools. See [ADR-0008](docs/adr/0008-canonical-agent-workflow.md) for the reasoning and `.specify/memory/constitution.md` for the enforceable rules.

### Before a spec exists — wayfinder

The map and its decision tickets live in `.scratch/typing-race-hackathon/` (`map.md`, `issues/NN-<slug>.md`). One ticket per session; claim it before any work; resolve it with an `## Answer`, set `Status: resolved`, and append a one-line gist plus link to the map's Decisions-so-far. Skills: `wayfinder`, `grilling`, `domain-modeling`, `research`, `prototype`.

### Once a feature is specifiable — Spec Kit

Per feature, from the main checkout: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze`. Then one user story per lane. `to-spec`, `to-tickets` and `implement-spec` are **not used**; `triage` is reserved for post-demo reports.

`specs/roadmap.md` lists the five features, each an independently demonstrable vertical slice:

| ID | Feature directory | Scope | Depends on |
|---|---|---|---|
| F1 | `001-typing-core` | app shell, design tokens, keyboard model (ЙЦУКЕН/QWERTY), keystroke engine, metrics, Stage 1 scales, zero-peek, local progress | — |
| F2 | `002-accounts-and-progress` | auth, RLS, append-only attempts, server-derived progress, offline outbox, history, export/import | F1 |
| F3 | `003-words-and-curriculum` | dictionary pipeline (Foundational phase), Stage 2 words, key unlock ladder | F1 |
| F4 | `004-academy-and-analytics` | Stage 3 Academy, adaptive slow-bigram generator, heatmaps, rhythm and error visualisation | F2, F3 |
| F5 | `005-races-and-leaderboards` | race rooms, Realtime, race validation, group and global leaderboards | F2 |

F1 first; then F2 and F3 in parallel; then F4 and F5. Feature IDs are immutable once referenced. Scope changes edit the roadmap first.

### Lanes

One user story = one worktree = one branch = one PR. A task is one Conventional Commit and one `[X]` in `tasks.md`. Two lanes run concurrently by default, three at most.

- Start a lane with `claude --worktree <story-slug>`; the branch name it generates is fine, because squash-merge removes it from history.
- A lane owns exactly the directories listed for its `[US]` label in the feature's `plan.md` ownership table.
- **Hot files** — `package.json`, the lockfile, `tsconfig*`, Vite/Biome/Tailwind config, design tokens, CI workflows, the root router, shared barrels — change only in a feature's Foundational phase, never in a story lane.
- No imports from another lane's unmerged code. If story B needs story A's module, the stories were mis-cut.
- Rebase before opening the PR; never merge `main` into a lane branch. Never `git stash` inside a worktree — the stash stack is shared.
- Lanes tick only `[X]` lines inside their own story phase; resolve conflicts by keeping both sides.
- No nested agents. `code-review`'s two sub-agents are the only sanctioned nesting.

### Gates

`/speckit-analyze` (artifacts) → `/speckit-checklist` (requirement quality) → TDD and the story's Independent Test in the lane → `/code-review <merge-base>` before the PR → CI → human squash merge → `/speckit-converge` once per feature.

The PR body is the handoff document: story id, tasks covered, Independent Test, `code-review` summary, CI run link, and any `Waived:` line.

## Tech stack

Decided in [ticket 11](.scratch/typing-race-hackathon/issues/11-stack-and-architecture.md) and [ADR-0003](docs/adr/0003-react-spa-with-input-engine-outside-the-framework.md).

- **Runtime**: Vite + React 19, TypeScript, client-rendered SPA. The keystroke path lives **outside** React.
- **Input**: a hidden textarea read through `beforeinput` and `compositionend`; `keydown` is used only for timing and modifiers. This is the only path that works for Ukrainian and the only one Playwright can drive.
- **Workspace**: pnpm monorepo — `engine`, `metrics`, `curriculum`, `dictionary-pipeline`, `ui`. `metrics` and `curriculum` stay free of browser and Node APIs so Supabase Edge Functions can import them.
- **State**: Zustand plus hand-written typed reducers. **Not** XState.
- **Styling**: Tailwind + CSS custom properties ("Serene Script").
- **i18n**: Paraglide. **Lint/format**: Biome.
- **Data fetching**: TanStack Query. **Charts**: hand-written SVG.
- **Backend**: Supabase — PostgreSQL, Auth, RLS, Realtime Broadcast, Edge Functions.
- **Deployment**: Vercel. **Tests**: Vitest, Testing Library, Playwright, fast-check, axe.
- **Mockups**: Claude Design. The old Stitch screens are visual reference only.

## Design system: "Serene Script"

Paper-and-ink tactile ergonomics; a calm, soft-light palette that avoids eye fatigue during long practice. The **light** theme is the default; dark theme and the low-vision preset are additional.

- Background (cream paper) `#FAF9F5` / `#F8FAF5`
- Text (soft slate) `#2D312E` / `#191C19`
- Correct / primary (sage green) `#4A7C59` / `#316342`
- Error / attention (gentle terracotta) `#D95D39` / `#BA1A1A`
- Upcoming / secondary (muted slate) `#94A3B8` / `#717971`
- Typing area `Source Serif 4`, 28px, line height 1.5; UI `Source Sans 3`; metrics and shortcuts `JetBrains Mono`

**Motion rule — expressive frame, calm text.** Rich motion on results, unlocks, the race track and route transitions; only caret glide and subtle character feedback inside the typing line. CSS-only in the typing line, View Transitions for routes, lazy-loaded Motion for celebration moments, canvas-confetti for bursts. One app-level flag disables all motion and sound, which is also what makes screenshot tests deterministic.

## Repository structure

```text
Typing-race/
├── .claude/skills/      # Spec Kit + Pocock skills (gitignored, restored from skills-lock.json)
├── .scratch/typing-race-hackathon/
│   ├── map.md           # wayfinder map
│   └── issues/          # decision tickets
├── .specify/            # Spec Kit templates, scripts, constitution
│   └── memory/constitution.md
├── docs/
│   ├── adr/             # architecture decision records
│   ├── agents/          # issue tracker and domain conventions
│   └── research/        # resolved research tickets
├── specs/
│   ├── roadmap.md       # the five features and their order
│   └── NNN-<slug>/      # spec.md, plan.md, tasks.md, contracts/, checklists/
├── tasks/               # organizer snapshot — gitignored, never committed
├── AGENTS.md            # this file, canonical
├── CLAUDE.md            # Claude Code entry point, imports this file
└── CONTEXT.md           # domain glossary
```

## Commands

- Spec Kit status: `specify status`, `specify check`, `specify integration status`
- Tests: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- Dev server: `pnpm dev` · Build: `pnpm build`
- Local backend: `supabase start`

## Non-negotiable product rules

- **Error counting**: an incorrect keystroke always counts toward the error total, even when corrected with Backspace. Accuracy is correct character keystrokes divided by all character keystrokes; Backspace is not in the denominator.
- **Zero-peek**: in test attempts the on-screen keyboard guide and next-key highlight are hidden.
- **Speed never gates progress.** Mastery is three consecutive attempts at or above the accuracy floor.
- **One next action.** Feedback always names exactly one thing to do next.
- **Apostrophe** is stored as U+0027, displayed as U+2019, and both fold together on input.
- Every screen the learner can reach is behind sign-in except the product page, formulas, licences, privacy and about.

## Gotchas

- Windows PowerShell: avoid `&&`, use `;` or separate invocations. The Bash tool is also available and takes POSIX syntax.
- Playwright **cannot** type Cyrillic through the keyboard API. Use `beforeinput`/`compositionend`; simulating a physical ЙЦУКЕН layout needs CDP, so those tests are Chromium-only and must be tagged.
- External libraries: run `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` before writing code against one.
- No secrets in commits: `.env.example` is tracked, `.env.local` never is. Organizer material under `tasks/` is never committed.
- `.specify/feature.json` is per-checkout state. In a worktree, set `SPECIFY_FEATURE_DIRECTORY` or let `/speckit-specify` write that worktree's own copy, and check the path every `speckit-*` script prints before acting.
