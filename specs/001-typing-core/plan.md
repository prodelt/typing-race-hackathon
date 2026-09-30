# Implementation Plan: Typing Core

**Feature**: F1 `001-typing-core` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Branch**: none at feature level — one branch per user story lane (Constitution VIII). All
`speckit-*` commands for this feature run from the main checkout.

**Input**: [spec.md](./spec.md) — 83 functional requirements, 19 success criteria, 6 user stories,
zero open clarifications, 16/16 on [checklists/requirements.md](./checklists/requirements.md).

## Summary

F1 builds the whole typing loop for Stage 1 in Ukrainian and English, and nothing beyond it. A
learner picks a starting level, opens a generated keyboard scale, types it while every keystroke is
judged in place, takes a zero-peek Test Attempt, satisfies the Mastery Rule three times, unlocks the
next key, and finds all of it after closing the browser — with no account and no server anywhere.

The technical shape was settled on the wayfinder map and is not reopened here: a client-rendered
Vite + React SPA whose **keystroke path lives outside React** ([ADR-0003](../../docs/adr/0003-react-spa-with-input-engine-outside-the-framework.md)),
reading a hidden textarea through `beforeinput` and `compositionend` because that is the only path
that works for Ukrainian and the only one Playwright can drive; a pnpm workspace whose `metrics` and
`curriculum` packages stay free of browser and Node APIs so F2's Edge Functions can import them
unchanged ([ADR-0007](../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md)). What
this plan adds is the eight decisions in [research.md](./research.md), the seams in
**Agreed Test Seams** below, and the ownership table that makes six parallel lanes safe.

## Technical Context

**Language/Version**: TypeScript 7.0.2 on Node 24.19.0. Fallback to the 6.x line is recorded in
[research.md R3](./research.md#r3-toolchain-versions) and costs one `tsconfig` change.

**Primary Dependencies**: Vite 8.3.1 · React 19.3.0 · TanStack Router 1.170.40 (code-based routes) ·
Zustand 5.0.15 with hand-written typed reducers · Tailwind CSS 4.3.3 with the tokens as CSS custom
properties · Paraglide 2.25.4 · Biome 2.5.14. TanStack Query 5.104.0 is installed but idle: F1 has no
server to fetch from, and it is present so F2 does not touch the lockfile in a story lane.

**Storage**: the browser only. IndexedDB behind the `ProgressStore` seam for progress, aggregates,
settings and the twenty most recent keystroke logs; the Cache API behind the `AssetCache` seam for the
shell. No server, no network at runtime.

**Testing**: Vitest 5.0.2 with fast-check 4.10.2 for the property tests principle II mandates;
Playwright 1.63.0 across Chromium, Firefox and WebKit against the production build;
`@axe-core/playwright` 4.13.0 for the zero-violation gate; a separate Chromium-only Playwright
project for the latency gate.

**Target Platform**: desktop browsers with a physical keyboard, from 1024 px wide. Current Chromium,
Firefox and WebKit. Mobile and virtual keyboards are out of scope for the product, not merely for F1.

**Project Type**: pnpm monorepo — one web application over four libraries.

**Performance Goals**: keystroke-to-paint p95 ≤ 16 ms, enforced in CI per
[research.md R8](./research.md#r8-measuring-keystroke-to-paint). Initial JavaScript budget 150 KB
(ticket 15). Between two keystrokes, nothing outside the typing line changes (FR-069).

**Constraints**: offline practice after the first page load (FR-074); no personal data, no network
calls, no third-party analytics (FR-053) — which forces **self-hosted, subset fonts**, since Google
Fonts would be both a third party and a network dependency; every motion and sound off behind one
flag (FR-064); three themes, light default.

**Scale/Scope**: one learner per browser. Eleven routes, ten screens. Four packages. Sixteen scale
generators counting the `modifiers` sub-variants, over two layouts. Roughly 60 keys per layout in the
Unlock Order.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design — result unchanged.*

| # | Principle | Status | How |
|---|---|---|---|
| I | Spec-driven & design-first | **Pass** | Spec clarified before this plan; `specs/roadmap.md` was edited first when the unlock ladder moved from F3 into F1; ADR-0003 and ADR-0007 already record the hard-to-reverse calls, and no new one arises here |
| II | TDD & Definition of Done | **Pass** | Restated verbatim below; every domain function in R4–R7 gets property tests; every acceptance scenario gets an E2E named after its story's Independent Test |
| III | Deep modules & information hiding | **Pass** | Four seams with in-memory adapters, agreed below **before** any test is written; keystroke buffering, interval maths and the finger tables stay private behind the package surfaces in [contracts/](./contracts/) |
| IV | Calm visual design & real-time responsiveness | **Pass** | Light theme default, dark and low-vision additional; motion confined to caret and judged character inside the typing line; the 16 ms gate is a CI job, not an aspiration |
| V | Claude Code is the only runtime | **Pass** | Nothing in F1 touches agent configuration; `.claude/skills/` remains the single source |
| VI | Public repository & zero secrets | **Pass** | F1 has no credentials to hold. Secret scan is a CI job. No organizer material enters the repository — the spec paraphrases and quotes nothing |
| VII | Mandatory authentication | **WAIVED** | See below |
| VIII | One story, one lane | **Pass** | One Foundational phase owning every hot file, then six lanes over disjoint trees — asserted in **File Ownership** below |
| IX | No nested agents | **Pass** | `code-review`'s two sub-agents only; research subagents, if any, run from the main checkout |

### Waiver

> `Waived: VII — authentication arrives in F2`

**Scope**: feature F1 only, every story lane within it, and every F1 pull request body.

**Why the gate is wrong for this case, not merely inconvenient**: principle VII exists so that no
learner practises anonymously in the shipped product, and so that progress is server-derived and
therefore trustworthy. F1 ships nothing to a learner: it is deployed to Vercel previews only and
never to a public production URL, so there is no anonymous practice to prevent. The alternative —
bringing Supabase auth forward into F1 — would move the roadmap's F1/F2 boundary, put a server, RLS
and an Edge Function inside the feature whose whole purpose is the input engine, and delay the first
demonstrable slice for a guarantee nobody can yet benefit from.

**What is not waived**: F2 replaces the local store with server-derived progress and puts every
learning screen behind sign-in. The local store therefore carries an explicit version marker and a
documented format (FR-082) so that F2 can decide whether to import it, and `progress()` is already
asynchronous behind its seam so the swap is not a rewrite.

**Amendment test**: the constitution says a principle waived twice is a defect in the principle. This
is its first waiver, and it is inherently non-repeatable — F2 removes the condition that produced it.

## Project Structure

### Documentation (this feature)

```text
specs/001-typing-core/
├── spec.md                  # clarified specification
├── plan.md                  # this file
├── research.md              # Phase 0 — the eight decisions
├── data-model.md            # Phase 1 — the in-browser model
├── quickstart.md            # Phase 1 — how to prove F1 works
├── contracts/               # Phase 1 — package surfaces and seam signatures
│   ├── engine.md
│   ├── metrics.md
│   ├── curriculum.md
│   └── seams.md
├── checklists/
│   └── requirements.md      # spec quality, 16/16
└── tasks.md                 # /speckit-tasks output — not created here
```

### Source Code (repository root)

```text
typing-race/
├── package.json · pnpm-workspace.yaml · pnpm-lock.yaml
├── tsconfig.base.json · biome.json · .env.example
├── .github/workflows/ci.yml
├── packages/
│   ├── engine/              # keystroke state machine; the only package that knows about input
│   ├── metrics/             # SPM/CPM/WPM, accuracy, IKI, rhythm, Aggregates, Confidence
│   │                        #   no browser and no Node APIs — F2's Edge Functions import this
│   ├── curriculum/
│   │   └── src/{layout,scales,levels,progress,coach}/
│   │                        # finger map, Unlock Order, the eight generators, level table,
│   │                        #   the progress fold with the Mastery Rule, the Next Action rules
│   │                        #   no browser and no Node APIs
│   └── ui/                  # tokens, three themes, primitives, icons, the motion flag
└── apps/web/
    ├── src/app/             # router, shell, navigation, footer, command palette, boot, theming
    ├── src/seams/           # the four seams: real adapters and in-memory adapters
    ├── src/sw/              # service worker — shell and Stage 1 data precache
    ├── src/instrument/      # the latency probe, dead in production builds
    └── src/features/{product,exercise,result,path,formulas,settings,session}/
└── e2e/
    ├── harness/             # the text-input driver, the CDP layout driver, store seeding
    └── *.spec.ts            # one spec per story, named after its Independent Test
```

**Structure Decision**: a pnpm monorepo, because the package boundary is what keeps `metrics` and
`curriculum` free of browser APIs — a constraint ADR-0007 turns into a hard F2 dependency, and one
that a folder convention inside a single app would not survive. `engine` is separate from `metrics`
because the engine is the only code that knows input exists, and `metrics` must be runnable on a
server against a stored log. `ui` is separate so the three themes and the motion flag have one owner.

## Agreed Test Seams

Principle III requires that every module talking to the outside world be reachable through a seam
with an in-memory adapter, and that **the seams be agreed before tests are written**. This section is
that agreement. Signatures are in [contracts/seams.md](./contracts/seams.md).

| Seam | The outside world it hides | Real adapter | In-memory adapter | Why it must be a seam |
|---|---|---|---|---|
| `InputSource` | The hidden textarea, `beforeinput`, `compositionend`, `keydown` | DOM listeners on the hidden textarea | `scriptedInput([...])` replaying a fixed event list | Without it, every engine test needs a DOM and a real keyboard. It is also the seam the CDP layout driver attaches behind, which is what makes the one CDP-only scenario possible at all |
| `Clock` | `performance.now()` | `performance.now()` | a manually advanced clock | Every metric in R4, R5 and R8 is a function of time. Real time in unit tests means flaky assertions about rhythm and confidence; there is no way to test the 3000 ms break rule against a real clock |
| `ProgressStore` | IndexedDB | IndexedDB, async, version-marked | an in-memory map with the same async surface | It is the seam **F2 replaces with Supabase**, so its shape is designed for that now: asynchronous, batched, idempotent by attempt id, and version-marked (FR-082) |
| `AssetCache` | The service worker and the Cache API | registration plus a precache manifest | a no-op that reports "unsupported" | Every test except the one offline E2E must run with it off, or a stale cache silently passes a failing build |
| `Random` | Non-determinism | seeded PRNG seeded from the session | seeded PRNG with a fixed seed | The scale generators in R6 are pure functions of a seed; a test that cannot fix the seed cannot assert on generated text |

`MotionFlag` is not an outside-world seam but is read once at boot from `ui`, and must be settable
from a test, because "visual checks run with animation disabled" is what makes them deterministic.

**Rule that follows from these seams**: no code outside `apps/web/src/seams/` touches IndexedDB, the
Cache API, `performance.now()`, `Math.random()` or a DOM input event. This is checkable by a lint
rule and should be one.

## File Ownership

Constitution VIII: each feature's plan carries a file-ownership table derived from the paths in
`tasks.md`, grouped by `[US]` label, with **the paths asserted disjoint**. Overlapping paths mean the
stories are not independent and are re-cut before any lane starts.

### Foundational phase — merges before any story lane opens

Owns every **hot file** (Constitution VIII names them: `package.json`, the lockfile, `tsconfig*`,
Vite/Biome/Tailwind config, design tokens, CI workflows, the root router, shared barrels) and, in
addition, every seam or pure-logic module that **three or more stories read**. That second half is
not optional: a story lane may not import another lane's unmerged code, so anything with three
consumers cannot live in a lane.

| Paths | Contents |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig*.json`, `biome.json`, `vite.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `.env.example` | toolchain; pnpm established via Corepack and pinned in `packageManager` |
| `.github/workflows/ci.yml` | typecheck · lint · unit · E2E ×3 engines · latency · axe · build · secret scan · dictionary-checksum stub |
| `packages/ui/**` | Serene Script tokens as custom properties, the three themes, finger colours, primitives, icons, the motion flag |
| `packages/metrics/**` | R4 Confidence, R5 Rhythm Consistency, SPM/CPM/WPM, accuracy, error counting, IKI, Attempt Aggregates |
| `packages/curriculum/src/layout/**` | Layout, Key, Transition, both finger maps, Unlock Order (R7) |
| `packages/curriculum/src/scales/**` | the eight generators and the Scale Catalogue (R6) |
| `packages/curriculum/src/levels/**` | the level table, the Introduction band, FR-080 |
| `packages/curriculum/src/progress/**` | the progress fold, Mastery Rule, unlock rule, retention rule |
| `packages/curriculum/src/coach/**` | the Next Action priority rules and templates — read by US2 and US3 |
| `apps/web/src/app/**` | router and route registration, shell, six-item navigation, footer, command palette, boot, theme application |
| `apps/web/src/seams/**` | all four seams plus `Random`, real and in-memory adapters |
| `apps/web/src/sw/**` | service worker, shell and Stage 1 precache (FR-074) |
| `apps/web/src/instrument/**` | the latency probe, dead in production |
| `apps/web/src/features/product/**` | P0, the one public product screen |
| `e2e/harness/**`, `e2e/latency.spec.ts` | text-input driver, CDP layout driver, store seeding, the latency gate |

### Story lanes

| Label | Story | Owned paths |
|---|---|---|
| `[US1]` | Typing an exercise | `packages/engine/**`, `apps/web/src/features/exercise/**`, `e2e/exercise.spec.ts` |
| `[US2]` | Result and one next action | `apps/web/src/features/result/**`, `e2e/result.spec.ts` |
| `[US3]` | Path, mastery and persistence | `apps/web/src/features/path/**`, `e2e/path-progress.spec.ts` |
| `[US4]` | The public Formulas page | `apps/web/src/features/formulas/**`, `e2e/formulas.spec.ts` |
| `[US5]` | Settings and accessibility presets | `apps/web/src/features/settings/**`, `e2e/settings.spec.ts` |
| `[US6]` | The guided session | `apps/web/src/features/session/**`, `e2e/session.spec.ts` |

### Disjointness assertion

Every story-lane path above begins with either `packages/engine/`,
`apps/web/src/features/<one directory unique to that story>/`, or `e2e/<one file unique to that
story>`. No two lanes share a prefix, and no lane's prefix is a prefix of another's. No story path
appears in the Foundational table: `apps/web/src/features/product/` is Foundational and is not any
story's directory, and `e2e/harness/` and `e2e/latency.spec.ts` are Foundational files, not specs any
lane owns. **The paths are disjoint.**

### Consequences, stated plainly

- **F1's Foundational phase is the bulk of the feature.** Four packages' logic, the shell, the seams,
  the service worker and CI all merge before any lane opens. This is not a mis-cut; it is what
  "F1 alone — it is the foundation" in `specs/roadmap.md` means in file terms. Parallelism in F1 is
  the six UI lanes afterwards, run two at a time.
- **US1 is the largest lane**, because it owns `packages/engine` as well as the typing screen.
- **Cross-story reads, and why they are not imports.** US2 renders the Key Unlock card from progress
  the Foundational store exposes; the rule that sets it is Foundational. US3's Today screen shows the
  Next Action from Foundational `coach`. Neither lane imports the other, and each is testable against
  a seeded store.
- Lanes tick only the `[X]` lines inside their own story phase in `tasks.md`; the human reconciles
  that file on `main` after each squash merge.

## Verification Tooling

Two instruments, and it matters which is which.

**The gate is Playwright.** CI needs headless, three engines, reproducibility and a red build. Every
acceptance scenario, the axe audit, the visual comparisons with motion off, and the 16 ms latency
project all run there. Nothing is considered verified because it was seen working.

**The inner loop is the `chrome-devtools` MCP server**, which is a CDP client and available in this
session. It is the right tool for four things, and it earns its place because CDP is the only way to
do the fourth: interactive checks while building a screen; `performance_start_trace` plus
`performance_analyze_insight` to read keystroke-to-paint before the CI gate exists, and to diagnose it
once the gate fires; `lighthouse_audit` against ticket 15's ≥95 threshold; and **simulating a physical
ЙЦУКЕН layout**, which research 06 proved needs CDP because Playwright's keyboard API cannot type
Cyrillic at all. That last one is why the single CDP-only scenario in the spec — US1 scenario 8 — is
Chromium-only and tagged.

**Library documentation before code.** `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` runs
before writing against any dependency in [research.md R3](./research.md#r3-toolchain-versions)
(`AGENTS.md`). These are recent majors; a recalled API shape is the likeliest way to waste a lane.

## Definition of Done

Carried from `.specify/memory/constitution.md` principle II and from
[spec.md](./spec.md#definition-of-done-mandatory--restated-from-the-constitution-because-test-tasks-are-emitted-only-when-asked),
so that `/speckit-tasks` emits test tasks — in Spec Kit they are opt-in.

1. Domain logic is Red-Green-Refactor with **property-based tests** beside example tests: the metric
   formulas, error counting, the keystroke state machine, Confidence per key and per Transition, the
   Mastery Rule, and the unlock rules.
2. Every user-visible acceptance scenario in the spec has a Playwright E2E against the **production
   build**, named after its story's Independent Test line in `tasks.md`.
3. The **full** E2E matrix is Chromium, Firefox and WebKit, binding at the pull request and on `main`
   (constitution v2.1.0, [ADR-0009](../../docs/adr/0009-test-gates-bind-per-phase-not-per-task.md));
   a lane may iterate on Chromium. CDP-only tests run in Chromium alone always — US1 scenario 8 is the
   only one in F1 — and **input-path tests run on all three engines from their first commit**, because
   research 06 found the engines genuinely disagree there.
4. Cyrillic is driven through text-input events, never the keyboard API, which cannot type it.
5. Zero axe violations; visual comparisons run with motion off.
6. CI green **at every phase boundary and on every pull request**: typecheck, lint, unit, E2E, build,
   secret scan. A task closes on a green local run (constitution v2.1.0). The dictionary-checksum job
   exists and has nothing to verify in F1.
7. Keystroke-to-paint p95 ≤ 16 ms in its own Chromium project with frame-rate limiting off, measured
   per [research.md R8](./research.md#r8-measuring-keystroke-to-paint). A regression fails the build.
8. The requirements document's own mandatory checks: formulas verified on fixed examples; a corrected
   error still counted; every supported key holding exactly one finger; `і`, `ї`, `є`, `ґ` never
   substituted; unlocked exercises and personal results surviving a reload.

## Gates

Per the constitution's table, for this feature: `/speckit-analyze` with no CRITICAL and no
unaddressed HIGH (G0) → `/speckit-checklist` items ticked (G1) → per lane, all story tasks done and
the Independent Test passing (G2) → `/code-review <merge-base>` with every finding fixed or waived in
the PR body (G3) → CI green plus the E2E re-run against the Vercel preview (G4) → human squash merge
(G5) → `/speckit-converge` reporting converged, once for the feature (G6).

Every F1 PR body carries the story id, the tasks covered, the Independent Test, the `code-review`
summary, the CI run link, and the line `Waived: VII — authentication arrives in F2`.

**Foundational runs on `main`** and not behind a pull request: it owns every hot file by definition,
no other lane is open to race it, and a pull request would have no reviewer and no conflict to
prevent ([ADR-0009](../../docs/adr/0009-test-gates-bind-per-phase-not-per-task.md)). **Branch
protection is enabled before the first story lane opens** — the moment ticket 01 meant when it
recorded protection as due at the first code task. Every phase after Foundational uses a worktree and
a pull request, as principle VIII requires.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Principle VII waived — no authentication in F1 | F1's purpose is the input engine, metrics and Stage 1 curriculum. It deploys to previews only, so there is no anonymous learner to protect | Bringing Supabase auth forward would move the roadmap's F1/F2 boundary and put a server, RLS and an Edge Function inside the feature that exists to prove typing works. The waiver is non-repeatable: F2 removes its condition |
| Four packages plus one app, rather than one app | `metrics` and `curriculum` must be free of browser and Node APIs so F2's Edge Functions import them unchanged (ADR-0007), and `engine` must be testable without a DOM | A folder convention inside one app does not survive a refactor, and the constraint it guards is a hard F2 dependency, not a preference. `ui` is separate so the three themes and the motion flag have exactly one owner |
| A Foundational phase larger than any single story | Anything three or more stories read cannot live in a lane, because a lane may not import another lane's unmerged code (VIII) | Pushing shared logic into the first lane that needs it would make every later lane depend on an unmerged branch, which is the failure VIII exists to prevent |
