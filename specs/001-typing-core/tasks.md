---

description: "Task list for F1 001-typing-core"
---

# Tasks: Typing Core (F1)

**Input**: Design documents from `/specs/001-typing-core/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Required, not optional.** Constitution principle II makes TDD with property-based tests
and a Playwright end-to-end test per acceptance scenario part of the Definition of Done. Test tasks
below are therefore first-class and precede their implementation.

**Gate boundaries (constitution v2.1.0, [ADR-0009](../../docs/adr/0009-test-gates-bind-per-phase-not-per-task.md))**:
a task closes on a green **local** `pnpm test`; a **phase** and a pull request close on a linked green
CI run. A lane may iterate on Chromium; the full three-engine matrix binds at the pull request and on
`main`, except input-path specs, which run on all three from their first commit.

**Organization**: grouped by user story so each is implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: may run in parallel — different files, no dependency on an incomplete task. `[P]` is a
  batching hint **inside one lane** and MUST NOT be split across lanes (Constitution VIII).
- **[Story]**: `[US1]`…`[US6]`. Setup, Foundational and Polish carry no story label.
- A task is **one Conventional Commit and one `[X]` here**.

## Lane mapping — read before starting anything

**Phases 1 and 2 together are the constitution's single Foundational phase.** Both merge to `main`
before any story lane opens; the split is only for reading order. Phases 3–8 are the six lanes, run
two at a time, three at most.

Every path below falls inside the phase's entry in
[plan.md's file-ownership table](./plan.md#file-ownership). A task that seems to need a path outside
it means the table is wrong — report it, do not work around it.

| Phase | Lane | Owned paths |
|---|---|---|
| 1 + 2 | Foundational | hot files, `packages/{ui,metrics}/**`, `packages/curriculum/src/{layout,scales,levels,progress,coach}/**`, `apps/web/src/{app,seams,sw,instrument}/**`, `apps/web/src/features/product/**`, `e2e/harness/**`, `e2e/latency.spec.ts` |
| 3 | `[US1]` | `packages/engine/**`, `apps/web/src/features/exercise/**`, `e2e/exercise.spec.ts` |
| 4 | `[US2]` | `apps/web/src/features/result/**`, `e2e/result.spec.ts` |
| 5 | `[US3]` | `apps/web/src/features/path/**`, `e2e/path-progress.spec.ts` |
| 6 | `[US4]` | `apps/web/src/features/formulas/**`, `e2e/formulas.spec.ts` |
| 7 | `[US5]` | `apps/web/src/features/settings/**`, `e2e/settings.spec.ts` |
| 8 | `[US6]` | `apps/web/src/features/session/**`, `e2e/session.spec.ts` |

---

## Phase 1: Setup (toolchain and hot files)

**Purpose**: everything that must exist before a line of product code, and everything Constitution
VIII calls a hot file. None of it may be touched again in a story lane.

- [X] T001 Fetch current API documentation for the majors before writing against them — `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` for Vite 8, React 19, TanStack Router 1, Tailwind 4, Zustand 5, Vitest 5, Playwright 1.63, Biome 2, Paraglide 2 — and record anything that contradicts [research.md R3](./research.md#r3-toolchain-versions) in that file. **Done 2026-09-30 — findings in [research R9](./research.md#r9-what-t001-found-in-the-live-documentation-2026-09-30): Tailwind 4 has no JS config and needs the separate `@tailwindcss/vite` package; Paraglide 2 generates output that must be gitignored and its single-file message catalogue is an ownership problem with a recorded fallback; TanStack Router's code-based form confirmed. `ctx7` was not installed — run it through `npx ctx7@0.5.12`**
- [X] T002 Establish pnpm and pin the exact version in root `package.json` `packageManager`. **Done 2026-09-30 — pnpm 12.8.1. Corepack was the planned route and does not work here: `corepack enable` needs administrator rights to write shims into `C:\Program Files
odejs` (EPERM). `corepack pnpm` works as a passthrough, but prefixing every script with it would break the requirements' §7 "single documented command". Installed at user scope instead — `npm i -g pnpm@12.8.1` into the already-user-writable global prefix, reversible with `npm rm -g pnpm` — and `packageManager` still pins the version so drift is caught**
- [X] T003 Create the workspace: root `package.json` with the scripts `quickstart.md` documents, and `pnpm-workspace.yaml` covering `packages/*` and `apps/*` — the single documented start command of FR-071. **Done 2026-09-30. `test:e2e` defaults to Chromium and `test:e2e:all` runs the full matrix, per ADR-0009. Two install findings: Vite 8 bundles with Rolldown rather than esbuild, and TypeScript 7 installs as the native `@typescript/typescript-<platform>` binary — so `onlyBuiltDependencies` needs neither**
- [X] T004 Add `tsconfig.base.json` with strict settings, plus a `tsconfig.json` per package; assert in the base config that `packages/metrics` and `packages/curriculum` see neither DOM nor Node type libraries. **Done 2026-09-30 — the base config is *pure by default*: `lib: ["ES2024"]` and `types: []`, so the four pure packages inherit the assertion and browser access is an explicit opt-in that appears only in `packages/ui`, `apps/web` and the root config. Verified by probe: `document`, `process` **and `performance`** are all unresolvable in `packages/metrics`, while `document` resolves in `apps/web`. Project references were rejected — composite projects must emit, and a single root program would union every `lib`, which is exactly what the assertion forbids; `pnpm typecheck` therefore runs one `tsc` per package**
- [X] T005 [P] Configure Biome in `biome.json` for lint and format across the workspace. **Done 2026-09-30 — recommended preset plus `noUnusedImports`, `noUnusedVariables`, `noParameterAssign`, shorthand array types and `noConsole` (warn/error allowed, off in tests and `e2e/`). Format: 2 spaces, 100 columns, LF, single quotes, no semicolons, trailing commas — the style the contracts are already written in. Two findings: `.specify/`, `.claude/` and `skills-lock.json` had to be excluded, because Biome wanted to rewrite Spec Kit's own CRLF JSON state files that the tool regenerates; and `tsconfig*.json` needs a `json.parser.allowComments` override, since the purity assertion lives in comments there**
- [X] T006 Configure Vite in `vite.config.ts` with the workspace aliases, the React plugin, `@tailwindcss/vite`, `paraglideVitePlugin`, and the 150 KB initial-JS budget from ticket 15. **Done 2026-09-30. The config stays at the repository root as the ownership table says, with `root: 'apps/web'` and `envDir` at the root — so `pnpm dev/build/preview` run it directly instead of `--filter`, which silently built with *no* config at all. No aliases were needed: pnpm's workspace links plus each package's `exports` pointing at `src/index.ts` already resolve `@typing-race/*`. The budget is a real gate, not a warning — an inline plugin walks the entry chunk's static-import graph, gzips it and calls `this.error()` past 150 KB, so a lazily imported chunk is deliberately not counted. First measurement: **66.3 KB gzip** for React 19 plus the Paraglide runtime. Two findings: inlang `modules` paths resolve relative to the directory *containing* `project.inlang`, not to the settings file; and the compiler must write into a gitignored `apps/web/src/paraglide/`**
- [ ] T007 [P] Configure Vitest in `vitest.config.ts` as a workspace, one project per package, with fast-check wired in
- [ ] T008 Configure Playwright in `playwright.config.ts`: projects `chromium`, `firefox`, `webkit` against the production build, plus `cdp` (Chromium only, for tagged tests) and `latency` (Chromium, frame-rate limiting and GPU vsync off). Default the local run to `chromium`; the full matrix is what CI runs on a pull request and on `main`, with input-path specs opted into all three engines by tag (constitution v2.1.0, [ADR-0009](../../docs/adr/0009-test-gates-bind-per-phase-not-per-task.md))
- [ ] T009 [P] Add `.env.example` stating plainly that F1 needs no environment variable, and extend `.gitignore` for build and test output (FR-072)
- [ ] T010 Add `.github/workflows/ci.yml` with the jobs typecheck · lint · unit · e2e (three engines) · e2e-cdp · latency · axe · build · secret-scan · dictionary-checksum (present, nothing to verify in F1)
- [ ] T011 Add a Biome lint rule forbidding IndexedDB, the Cache API, `performance.now()`, `Math.random()` and DOM input events anywhere outside `apps/web/src/seams/` — this is what keeps Constitution III true past day one, per [plan.md](./plan.md#agreed-test-seams)
- [ ] T012 [P] Add the five terms `data-model.md` flags as missing to `CONTEXT.md`: Layout, Key, Scale, Level, Settings

**Checkpoint**: `pnpm install`, `pnpm typecheck`, `pnpm lint` and `pnpm build` all succeed on an empty app.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the seams and the pure logic that three or more stories read. A lane may not import
another lane's unmerged code, so none of this can live in a lane.

**⚠️ No story lane opens until Phase 2 is merged.**

### Seams — before anything that uses them

- [ ] T013 Define the seam interfaces in `apps/web/src/seams/index.ts` exactly as [contracts/seams.md](./contracts/seams.md) states them
- [ ] T014 [P] Implement `Clock`: `systemClock` and `manualClock` in `apps/web/src/seams/clock.ts`, with unit tests for the manual clock's advance
- [ ] T015 [P] Implement `Random`: `seededRandom` in `apps/web/src/seams/random.ts`, with a test that the same seed always yields the same sequence
- [ ] T016 Implement `InputSource`: `domInputSource` reading `beforeinput` and `compositionend` for characters and `keydown` only for timing and modifiers, in `apps/web/src/seams/input.ts`; emit `ignored` events rather than swallowing them
- [ ] T017 Implement `scriptedInput` in `apps/web/src/seams/input.ts` so the engine is testable with no DOM
- [ ] T018 Implement `probeLayout` on `InputSource` for the pre-start layout check (FR-021)
- [ ] T019 Implement `ProgressStore`: `indexedDbStore` in `apps/web/src/seams/store.ts` with the version-marked envelope of [data-model.md](./data-model.md#the-stored-envelope) (FR-082, and no migration code in F1), idempotent `appendAttempts`, and the four `load` outcomes
- [ ] T020 [P] Implement `memoryStore(seed)` in `apps/web/src/seams/store.ts` — the adapter US2, US3 and US6 seed to stay independent of each other
- [ ] T021 Implement the 20-log retention rule inside the store, with a test that pruning changes no metric, no confidence value and no unlocked key (FR-081, SC-019)
- [ ] T022 Implement the concurrent-tab resolution using the envelope's `writtenAt`, with a test that stale state cannot silently overwrite newer state
- [ ] T023 [P] Implement `AssetCache`: `serviceWorkerCache` and `noAssetCache` in `apps/web/src/seams/cache.ts`
- [ ] T024 Contract suite in `apps/web/src/seams/store.contract.test.ts` running the same assertions against both `ProgressStore` adapters — this is the suite F2 reuses when it adds the Supabase adapter

### `packages/ui` — tokens, themes, primitives

- [ ] T025 Serene Script tokens as CSS custom properties in `packages/ui/src/tokens.css`: the five core colours, the finger-colour group (ink / tint / line per finger) from ticket 20
- [ ] T026 [P] The dark theme and the low-vision preset as full theme blocks under `[data-theme="dark"]` and `[data-theme="low-vision"]` in `packages/ui/src/themes.css`; low-vision is a third theme, never a scale factor (FR-062)
- [ ] T027 [P] Self-host and subset Source Serif 4, Source Sans 3 and JetBrains Mono under `packages/ui/src/fonts/` — FR-085; a hosted font would break FR-053 and FR-074 at once
- [ ] T028 Motion tokens plus `resolveMotion` in `packages/ui/src/motion.ts`, per [docs/design/motion.md](../../docs/design/motion.md); the off state drives every duration to `0.01ms`, skips the confetti import and disables sound
- [ ] T029 [P] Primitives in `packages/ui/src/components/`: button, keycap with its 2 px inset bevel, chip, field, card — all three themes, focus always visible
- [ ] T030 [P] The icon set and the mark at three sizes in `packages/ui/src/icons/`, from ticket 20's `Identity` board

### `packages/curriculum/src/layout` — the keyboard model

- [ ] T031 Layout, Key and Transition types in `packages/curriculum/src/layout/types.ts` (FR-001, FR-005)
- [ ] T032 The ЙЦУКЕН finger map as data in `packages/curriculum/src/layout/yq.ts`, including the ticket-10 extensions: apostrophe on the left pinky, `ґ` on the backslash key, hyphen and digits (FR-001, FR-003, FR-006)
- [ ] T033 [P] The QWERTY finger map as data in `packages/curriculum/src/layout/qwerty.ts` (FR-001, FR-003)
- [ ] T034 Table test in `packages/curriculum/src/layout/layout.test.ts` asserting every supported key in both layouts resolves to **exactly one** finger — none unassigned, none twice; the space bar on the thumbs and Shift on the opposite-hand pinky (FR-002, FR-003, FR-004, SC-004, requirements §8.4)
- [ ] T035 `fingerOf` and `transitionOf` in `packages/curriculum/src/layout/query.ts`, with `sameFinger` detection and property tests (FR-005)
- [ ] T036 Derive the Unlock Order per [research.md R7](./research.md#r7-unlock-order) in `packages/curriculum/src/layout/unlock-order.ts`, with the initial anchor set (FR-084) and tests that it covers every unlockable key exactly once and excludes space
- [ ] T037 Verify the macOS positions of `ґ` and the apostrophe against a real machine and correct `yq.ts` — the data, never the code; `data-model.md` records this as an unvalidated assumption

### `packages/curriculum/src/scales` — the eight generators

- [ ] T038 Scale and Scale Catalogue types in `packages/curriculum/src/scales/types.ts`
- [ ] T039 Generators `run`, `mirror` and `alternate` in `packages/curriculum/src/scales/generators/`, per [research.md R6](./research.md#r6-generating-the-eight-stage-1-scale-types-from-a-finger-map) (FR-008, FR-009)
- [ ] T040 Generators `fingerIsolation` and `fingerSpan` — kept distinct, because they are two separate bullets of the requirements' Stage 1 list and `fingerSpan` is the only place the index fingers' six-key spans are drilled (FR-008, FR-009)
- [ ] T041 Generators `vertical`, `modifiers` (space · Shift with the opposite-hand pinky · digits · punctuation) and `tempo` (one motif against a stepping metronome target) — FR-008, FR-009
- [ ] T042 `generateText` in `packages/curriculum/src/scales/generate.ts` returning `'requirements-unmet'` rather than degrading when the unlocked set cannot serve the generator
- [ ] T043 Property tests in `packages/curriculum/src/scales/generate.test.ts`: generated text never contains a locked character (FR-012); the Focus Element appears in every item (FR-046); identical `(scale, unlocked, seed)` gives identical text
- [ ] T044 The Scale Catalogue for both layouts in `packages/curriculum/src/scales/catalogue.ts` with the authored metadata of FR-011 and a `goal` message key per scale (FR-010, FR-013), plus a coverage test that all eight generator types are present for each and that every scale has a goal string in both interface languages (FR-008, SC-003)

### `packages/curriculum` — levels, progress, coach

- [ ] T045 [P] The level table as data in `packages/curriculum/src/levels/table.ts`, plus `levelFor` taking the **stage** not the speed (FR-030, FR-080) and `passes`
- [ ] T046 `deriveProgress` in `packages/curriculum/src/progress/derive.ts` — the fold over Attempt Aggregates in completion order (FR-050)
- [ ] T047 The Mastery Rule inside the fold: three consecutive **Test** Attempts at or above the floor, a failing attempt resets, a Practice Attempt never counts (FR-039)
- [ ] T048 The unlock rule inside the fold (FR-041), with a property test that the unlocked set is always a prefix of the Unlock Order (FR-042) and that no sequence of attempts, however fast, unlocks a key without three consecutive passes (SC-009, FR-040)
- [ ] T049 The starting-level choice's forward-only effect on the unlocked boundary (FR-073), and Stage 1 completion at every scale done plus 96% over the last five attempts (FR-044)
- [ ] T050 `nextAction` in `packages/curriculum/src/coach/next-action.ts` — strict priority, first match wins, returning **exactly one** value by type rather than by check (FR-031, FR-032, SC-010)
- [ ] T051 Recommendation templates plus substitution in `packages/curriculum/src/coach/templates.ts`, so the exact sentence for given inputs is unit-testable (FR-034); Same-Finger Transitions weighted up for Ukrainian (FR-033); a Transition with fewer than five observations never named (FR-035)

### `packages/metrics`

- [ ] T052 `computeMetrics` in `packages/metrics/src/compute.ts`: SPM/CPM, `WPM = SPM / 5`, error count, errors by character, elapsed time (FR-023, FR-025)
- [ ] T053 Accuracy in `packages/metrics/src/accuracy.ts` — correct character keystrokes over all character keystrokes, a corrected error still counted, Backspace not in the denominator (FR-024)
- [ ] T054 Fixed worked examples with hand-computed values in `packages/metrics/src/accuracy.test.ts` and `compute.test.ts` — the requirements' §8.1 and §8.2 checks, including examples with corrected errors
- [ ] T055 `computeAggregates` in `packages/metrics/src/aggregates.ts` — per-key and per-transition count, misses, sum and sum of squares of intervals — the only input to progress and confidence (FR-026, FR-028)
- [ ] T056 Rhythm consistency in `packages/metrics/src/rhythm.ts` per [research.md R5](./research.md#r5-rhythm-consistency): `100 × max(0, 1 − cv)`, eligible intervals only, `breaksExcluded` reported (FR-026)
- [ ] T057 `foldConfidence` and `confidenceOf` in `packages/metrics/src/confidence.ts` per [research.md R4](./research.md#r4-confidence-per-key-and-per-transition): exponential half-life of 10, timing from correct keystrokes only, `undefined` below five observations (FR-029)
- [ ] T058 Property tests in `packages/metrics/src/*.test.ts` for every obligation in [contracts/metrics.md](./contracts/metrics.md): `accuracy ∈ [0,1]`; `wpm × 5 === spm`; `rhythmConsistency ∈ [0,100]`; confidence `undefined` or in `[0,1]`; a hit never lowers it, a miss never raises it, a shorter interval never lowers it; recomputation is identical

### `apps/web` shell, service worker, instrumentation

- [ ] T059 TanStack Router with **code-based routes** registering every route FR-054 requires in `apps/web/src/app/router.tsx` — no generated route tree, per [research.md R1](./research.md#r1-router--tanstack-router-with-code-based-routes)
- [ ] T060 The app shell in `apps/web/src/app/Shell.tsx`: the six-item primary navigation with out-of-F1 items present and disabled (FR-055), the footer, and the dimmed-during-attempt state with its mono note (FR-057)
- [ ] T061 [P] Theme and motion application at boot in `apps/web/src/app/theme.ts`, seeded by `prefers-reduced-motion` (FR-064)
- [X] T062 [P] Paraglide set up in `apps/web/project.inlang/settings.json` with uk and en catalogues under `apps/web/messages/`, `modules` pointing at local node_modules paths so the build never fetches, and the generated `apps/web/src/paraglide/` gitignored; interface language independent of typing language (FR-068). **Done 2026-09-30 with T006, and the open question is settled: `pathPattern` in the installed `@inlang/plugin-message-format` 4.4.4 is a `Union([String, Array(String)])` — the array form works, the documentation simply does not show it. So R9's fallback is not needed. Eight catalogues per locale, one per area (`app`, `exercise`, `result`, `path`, `formulas`, `settings`, `session`, `races`), which removes the shared-file ownership problem outright. Verified end to end: the compiler emits `messages/app_name.js` from `messages/app/uk.json`. Language switching left to T130; the strategy chain is `localStorage` then `preferredLanguage` then `baseLocale`**
- [ ] T063 The Ctrl+K command palette in `apps/web/src/app/CommandPalette.tsx`, reachable from every screen (FR-056)
- [ ] T064 Zustand store with hand-written typed reducers in `apps/web/src/app/state/`, wired to the `ProgressStore` seam; the four `load` outcomes each get a learner-facing path (FR-052, FR-083)
- [ ] T065 [P] The product page P0 in `apps/web/src/features/product/ProductPage.tsx` — what the app is, the three stages, and the entry into practice
- [ ] T066 The service worker in `apps/web/src/sw/` precaching the shell, the fonts and the Stage 1 data, so practice runs with the network away after the first load (FR-074); include a stale-shell invalidation on deploy
- [ ] T067 The latency probe in `apps/web/src/instrument/latency.ts` per [research.md R8](./research.md#r8-measuring-keystroke-to-paint) — `t0` at `beforeinput`, `t1` in the task after the next animation frame — dead in production builds

### End-to-end harness

- [ ] T068 The text-input driver in `e2e/harness/type.ts` driving `beforeinput` and `compositionend`, because the keyboard API cannot type Cyrillic at all
- [ ] T069 [P] The CDP physical-layout driver in `e2e/harness/cdp-layout.ts` for simulating ЙЦУКЕН — Chromium only, used by exactly one scenario in F1
- [ ] T070 [P] Store seeding and motion-off fixtures in `e2e/harness/fixtures.ts`, plus an axe helper asserting zero violations
- [ ] T071 `e2e/latency.spec.ts` — 200 keystrokes, p95 ≤ 16 ms, in the `latency` project; a regression fails the build (FR-070, SC-002)

**Checkpoint**: every package has green unit and property tests; the shell renders; CI is green;
the latency gate runs. **Six lanes may now open, two at a time.**

---

## Phase 3: User Story 1 — Typing an exercise (Priority: P1) 🎯 MVP

**Goal**: a learner opens a Stage 1 scale, checks their layout, and types it with every keystroke
judged in place — guided in a Practice Attempt, unguided in a Test Attempt.

**Independent Test**: open a Stage 1 scale in each language, type it once with a deliberate wrong key
and a Backspace correction, then type the same scale as a Test Attempt; the guides are rendered in
the first and absent in the second, and both attempts reach completion.

### Tests for User Story 1

- [ ] T072 [P] [US1] Engine property tests in `packages/engine/src/engine.test.ts` for every obligation in [contracts/engine.md](./contracts/engine.md): `errorCount` monotonically non-decreasing; `cursor` within bounds; typing the text exactly gives zero errors and `completed`; inserting `ignored` events changes only the log length; under stop-on-letter `cursor` never advances while marked
- [ ] T073 [P] [US1] Engine example tests covering each spec edge case: wrong key on the first character; Backspace at position zero; Backspace held across the exercise; a composition replacing several characters; a dead key plus base letter giving one character; apostrophe folding U+0027 against U+2019 (FR-007)
- [ ] T074 [P] [US1] Test in `packages/engine/src/unicode.test.ts` that `і`, `ї`, `є` and `ґ` are judged as themselves and never substituted — FR-006 and the requirements' §8.5 check
- [ ] T075 [US1] `e2e/exercise.spec.ts` named after the Independent Test above, covering acceptance scenarios 1–7, 9 and 10 — tagged as an **input-path spec, so all three engines from the first commit**, per ADR-0009, including that nothing outside the typing line changes between keystrokes (FR-069)
- [ ] T076 [US1] Acceptance scenario 8 in `e2e/exercise.spec.ts`, tagged CDP-only and Chromium-only: a Ukrainian exercise opened while the system layout is English reports the mismatch and does not start
- [ ] T077 [US1] Axe audit and a motion-off visual comparison for the typing screen in both modes

### Implementation for User Story 1

- [ ] T078 [US1] The `Engine` surface, judging typed against awaited and distinguishing typed, awaited and upcoming text (FR-014, FR-015), in `packages/engine/src/index.ts` exactly as [contracts/engine.md](./contracts/engine.md) states it — it computes no metric, because metrics must also run server-side in F2
- [ ] T079 [US1] The cursor and mark state machine in `packages/engine/src/machine.ts`: `idle → running → (paused ⇄ running) → completed`, plus `abandoned` producing no Attempt at all
- [ ] T080 [US1] Stop-on-letter and free-Backspace error modes in `packages/engine/src/machine.ts`; Backspace never lowers `errorCount` and never walks behind index zero (FR-017, FR-018)
- [ ] T081 [US1] `ignored`-event handling in `packages/engine/src/machine.ts` for modifiers, input-method events and dead keys — recorded in the log, consuming nothing, counting nothing (FR-020)
- [ ] T082 [US1] Focus-loss and pause time accounting in `packages/engine/src/clock-accounting.ts`, so `elapsedMs` excludes time away
- [ ] T083 [US1] Keystroke Event Log encoding into parallel arrays in `packages/engine/src/log.ts`, with `formatVersion` — append-only, and the sole source every metric is derived from (FR-019)
- [ ] T084 [US1] The pre-start screen E1 in `apps/web/src/features/exercise/PreStart.tsx` — the layout and character check with the required layout named (FR-021), and **the one goal this scale serves shown to the learner** (FR-010); repeating any unlocked exercise starts here (FR-045)
- [ ] T085 [US1] The typing screen in `apps/web/src/features/exercise/TypingScreen.tsx`: the 276 px left rail plus a single scrolling line at the configured size, the line vertically centred with edge fades and the same vertical position in every exercise type (FR-058)
- [ ] T086 [US1] The typing line in `apps/web/src/features/exercise/TypingLine.tsx`: in-place error mark — colour, tint, 3 px underline on the awaited character, caret held, nothing moving; CSS-only animation of caret and judged character; shake and nudge forbidden (FR-015, FR-016, FR-065)
- [ ] T087 [US1] The rail in `apps/web/src/features/exercise/Rail.tsx`: session blocks, the one next action, and the 2×2 live-metric grid **frozen for the duration of an attempt**, showing the last completed exercise (FR-059) — including what it shows when there is no previous exercise
- [ ] T088 [US1] The on-screen keyboard guide in `apps/web/src/features/exercise/KeyboardGuide.tsx`: the full layout in finger colours, fading across confidence tiers, the letter staying full-contrast ink in every tier, and colour never the sole carrier of a finger's identity (FR-060, FR-061)
- [ ] T089 [US1] The next-key card and the finger diagram in `apps/web/src/features/exercise/NextKey.tsx` — the only element that names the finger without naming a key
- [ ] T090 [US1] Zero-peek in `apps/web/src/features/exercise/TypingScreen.tsx`: in a Test Attempt the four guides of FR-037 are **not rendered at all**, while time, error count and progress remain
- [ ] T091 [US1] The Escape pause in `apps/web/src/features/exercise/PauseOverlay.tsx`, naming the finger for the last error — never shown inline while the attempt runs (FR-022)
- [ ] T092 [US1] Mode switching in `apps/web/src/features/exercise/ModeToggle.tsx`: the Test Attempt becomes the primary action once a Practice Attempt clears the floor (FR-036)

**Checkpoint**: a learner can type a Stage 1 scale in both languages, in both modes, and the CDP
layout check passes. This alone is a demonstrable MVP.

---

## Phase 4: User Story 2 — The result of an attempt and one next action (Priority: P1)

**Goal**: every number the requirements demand, plus exactly one thing to do next, plus the Key
Unlock card when the attempt earned it.

**Independent Test**: finish one attempt from a seeded progress store and read the result screen;
every metric in the requirements is present, exactly one Next Action is shown, and with a store
seeded at the mastery threshold the Key Unlock card appears.

### Tests for User Story 2

- [ ] T093 [P] [US2] `e2e/result.spec.ts` named after the Independent Test above, covering acceptance scenarios 1–3 and 7 against a seeded store
- [ ] T094 [P] [US2] Scenarios 4–6 in `e2e/result.spec.ts`: each of the first three Next Action rules fires for its own seeded state, and no second recommendation appears
- [ ] T095 [P] [US2] Scenario 8 in `e2e/result.spec.ts`: a store seeded at two consecutive passes shows the Key Unlock card on the third
- [ ] T096 [P] [US2] Scenario 9 plus an axe audit in `e2e/result.spec.ts`: intervals over 400 ms drawn in the error colour, and the chart readable without relying on colour
- [ ] T097 [US2] A motion-off visual comparison of the result screen

### Implementation for User Story 2

- [ ] T098 [US2] The result screen E4 in `apps/web/src/features/result/ResultScreen.tsx` with the four metric tiles
- [ ] T099 [US2] The full metric readout in `apps/web/src/features/result/Metrics.tsx`: SPM/CPM, WPM, accuracy, errors, time, errors by character, average delay per key and per Transition, rhythm consistency
- [ ] T100 [US2] Comparison with the learner's previous best on the same exercise in `apps/web/src/features/result/Comparison.tsx`, including the case where there is no previous result (FR-027)
- [ ] T101 [US2] The rhythm chart as hand-written SVG in `apps/web/src/features/result/RhythmChart.tsx` — no chart library; intervals over 400 ms in terracotta; accessible without colour
- [ ] T102 [US2] The named error list with per-error weight in `apps/web/src/features/result/ErrorList.tsx`
- [ ] T103 [US2] The single Next Action in `apps/web/src/features/result/NextActionCard.tsx`, rendered from `coach` with a button that starts it (FR-031)
- [ ] T104 [US2] The Key Unlock card E5 (FR-043) in `apps/web/src/features/result/UnlockCard.tsx` — a deep sage card in the right column with the new key on a cream keycap, its finger and one button to its first drill; rendered from **store data**, so this lane does not depend on US3's rule
- [ ] T105 [US2] The pruned-log path in `apps/web/src/features/result/ResultScreen.tsx`: metrics still shown from aggregates, with the keystroke-level detail stated as no longer kept

---

## Phase 5: User Story 3 — The path, mastery and progress that survives a restart (Priority: P1)

**Goal**: the learner sees where they are, keys unlock by the Mastery Rule, and nothing is lost when
the browser closes.

**Independent Test**: from an empty store, choose a starting level, complete three consecutive
passing Test Attempts on the scale focused on the next locked key, watch the key unlock and the Path
update, then restart the browser with the network away and confirm the unlocked set, the attempt
history and the Next Action are unchanged and still usable.

### Tests for User Story 3

- [ ] T106 [P] [US3] `e2e/path-progress.spec.ts` named after the Independent Test above, covering acceptance scenarios 1–6 and 8–9
- [ ] T107 [P] [US3] Scenario 7 in `e2e/path-progress.spec.ts` — the requirements' §8.9 check: after a browser restart the unlocked set, consecutive counts, confidence data, history and Next Action are all unchanged
- [ ] T108 [P] [US3] Scenario 11 in `e2e/path-progress.spec.ts` — the requirements' §8.10 check: with the network disabled after one successful load, an unlocked Stage 1 exercise starts, completes and shows its result
- [ ] T109 [P] [US3] Scenario 10 in `e2e/path-progress.spec.ts`: three starting-level options, the third opening more keys than the first, neither closing a key
- [ ] T110 [US3] Axe audit and a motion-off visual comparison for Path and Today

### Implementation for User Story 3

- [ ] T111 [US3] The Path screen L2 in `apps/web/src/features/path/PathScreen.tsx`: the Stage 1 keyboard with finger colours, open and locked scales with the condition that opens each, and Stage 2 and the Academy shown as arriving later
- [ ] T112 [US3] Today L1 in `apps/web/src/features/path/TodayScreen.tsx`: exactly one Next Action with its button, the current stage, and the unlocked key count
- [ ] T113 [US3] The starting-level choice in `apps/web/src/features/path/StartingLevel.tsx` — three options, forward-only effect on the unlocked boundary, changeable later without losing attempts (FR-048, FR-073)
- [ ] T114 [US3] Wire the attempt-completion flow in `apps/web/src/features/path/progress-flow.ts` so a completed attempt is appended and progress re-derived through the Foundational fold
- [ ] T115 [US3] The restore path in `apps/web/src/features/path/restore.ts`, including the unavailable-storage and unrecognised-version outcomes with their learner-facing screens (FR-052, FR-083)
- [ ] T116 [US3] The weak keys and Transitions review entry in `apps/web/src/features/path/Review.tsx` (FR-047)

---

## Phase 6: User Story 4 — The public Formulas page (Priority: P2)

**Goal**: one page from which a reader can reproduce any number the product shows.

**Independent Test**: open the Formulas route with no stored progress and confirm every formula the
product uses is stated there, including the row-change divergence.

- [ ] T117 [P] [US4] `e2e/formulas.spec.ts` named after the Independent Test above, covering all six acceptance scenarios with no learner state, plus an axe audit
- [ ] T118 [US4] The Formulas page P3 in `apps/web/src/features/formulas/FormulasPage.tsx`, reachable without any stored progress
- [ ] T119 [US4] The speed and accuracy section in `apps/web/src/features/formulas/Speed.tsx`: SPM/CPM as a formula, `WPM = SPM / 5` labelled secondary, and accuracy with the explicit note that a corrected error still counts and Backspace is not in the denominator
- [ ] T120 [US4] The difficulty section in `apps/web/src/features/formulas/Difficulty.tsx` giving **both** readings of the row-change measure — adjacent row-changing pairs, and distinct rows touched — and stating that we count adjacent pairs and why the requirements' own example reads the other way
- [ ] T121 [US4] The progression section in `apps/web/src/features/formulas/Progression.tsx`: the level table with benchmarks and floors, the Mastery Rule, Stage 1 completion, and that speed never gates progression
- [ ] T122 [US4] The rhythm and confidence section in `apps/web/src/features/formulas/Rhythm.tsx` defining inter-keystroke interval, rhythm consistency and Confidence — including the sentence that Confidence gates nothing

---

## Phase 7: User Story 5 — Settings and accessibility presets (Priority: P2)

**Goal**: the learner shapes the workspace, and it stays shaped.

**Independent Test**: change every setting, confirm each takes effect immediately, reload, and
confirm each is still in force.

- [ ] T123 [P] [US5] `e2e/settings.spec.ts` named after the Independent Test above, covering all eight acceptance scenarios
- [ ] T124 [P] [US5] A keyboard-only traversal test plus an axe audit across every F1 screen in `e2e/settings.spec.ts` (FR-066, SC-011)
- [ ] T125 [US5] The Settings screen S2 in `apps/web/src/features/settings/SettingsScreen.tsx`
- [ ] T126 [US5] Theme control in `apps/web/src/features/settings/Theme.tsx` — system, light, dark, low-vision, light the default, applied immediately
- [ ] T127 [US5] Motion and sound control in `apps/web/src/features/settings/Motion.tsx` — system, reduced, off; sound off by default; the off state kills every animation and every sound
- [ ] T128 [US5] Exercise text size 24–40 px in `apps/web/src/features/settings/TextSize.tsx`, applied to the typing line immediately (FR-063)
- [ ] T129 [US5] Error-mode control in `apps/web/src/features/settings/ErrorMode.tsx` — stop-on-letter the Stage 1 default
- [ ] T130 [US5] Typing language and layout control in `apps/web/src/features/settings/Language.tsx`, switching Path and the Catalogue without discarding progress in the other language (FR-051)
- [ ] T131 [US5] Interface language control in `apps/web/src/features/settings/Interface.tsx`, independent of the typing language
- [ ] T132 [US5] Persist every setting through the store seam and restore it on boot (FR-049)

---

## Phase 8: User Story 6 — Running a guided session (Priority: P2)

**Goal**: one button walks the learner through warm-up, target skill and consolidation.

**Note on priority**: P2 orders the lane, not the obligation — the session is a mandatory requirement
and ships inside F1.

**Independent Test**: start a session from Today, run it to the end through all three blocks, and
confirm the between-blocks screen appears twice, the expected length was stated up front, and
abandoning mid-block keeps the attempts already recorded.

- [ ] T133 [P] [US6] `e2e/session.spec.ts` named after the Independent Test above, covering all seven acceptance scenarios, plus an axe audit
- [ ] T134 [P] [US6] A test that a session interrupted by a browser restart resumes or ends deliberately, never leaving the learner stuck (FR-078)
- [ ] T135 [US6] The session state machine implementing the three blocks of FR-075, in `apps/web/src/features/session/machine.ts` — three blocks, resumable, abandonable, attempts already recorded always kept
- [ ] T136 [US6] Block composition in `apps/web/src/features/session/compose.ts`: warm-up on the previous session's weakest Transitions, with a defined fallback to the current target skill when there is no previous session
- [ ] T137 [US6] Session sizing in `apps/web/src/features/session/sizing.ts` so a full run lands between 15 and 25 minutes at the learner's current speed, with the expected length stated before the first block (FR-077)
- [ ] T138 [US6] The between-blocks screen E6 in `apps/web/src/features/session/BetweenBlocks.tsx`, naming the block just finished and the one coming next
- [ ] T139 [US6] The real-text placeholder in `apps/web/src/features/session/RealTextPending.tsx` — naming real text as arriving with the word curriculum, and offering no pseudo-word substitute (FR-076)
- [ ] T140 [US6] The session entry point on Today in `apps/web/src/features/session/StartSession.tsx`; any unlocked exercise still starts on its own from Path (FR-079)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T141 Re-run `/speckit-analyze` and close anything it reports at the source
- [ ] T142 [P] Confirm the 150 KB initial-JS budget holds on the production build, and that the latency gate still passes with every feature merged
- [ ] T143 [P] Confirm the requirements' §8 checks each have a named passing test, and record the mapping in `quickstart.md`
- [ ] T144 [P] Walk the §9 demo route end to end on the production build and fix anything that breaks the sequence
- [ ] T145 [P] Confirm the 1024 px minimum width and the message shown below it (FR-067)
- [ ] T146 [P] Confirm every F1 PR body carried `Waived: VII — authentication arrives in F2`
- [ ] T147 Tick the reviewer-owned items in `checklists/core.md` that the merged work has satisfied, and open a ticket for anything still unresolved
- [ ] T148 Audit every learner-facing and juror-facing string in the product — product page, Path, the typing screen, Formulas — for any claim that the program verifies the learner did not look at the keyboard, and confirm nothing requests camera, microphone or biometric access (FR-038). The requirements forbid claiming technically guaranteed gaze control, and §11 makes a misrepresented capability grounds for rejection
- [ ] T149 Run `/speckit-converge` once for F1 and append anything it finds

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 → Phase 2**: the toolchain exists before any source file.
- **Phase 2 → Phases 3–8**: absolute. Every lane imports the seams, `ui`, `metrics` and
  `curriculum`; none may open before Phase 2 is squash-merged to `main`.
- **Phases 3–8**: mutually independent by construction — the file-ownership table makes their trees
  disjoint, and each is testable against a seeded store.
- **Phase 9**: after every lane merges.

### Within Phase 2, the order that matters

Seams (T013–T024) precede everything that uses them. `layout` (T031–T037) precedes `scales`
(T038–T044), because generators read the finger map. `metrics` confidence (T057) precedes `coach`
(T050–T051), which ranks by it. The harness (T068–T070) precedes the latency spec (T071).

### Story dependencies

None between lanes. Two soft reads, neither an import: US2 renders the Key Unlock card from store
data whose rule is Foundational; US3's Today shows the Next Action from Foundational `coach`.

### Parallel opportunities

- Phase 1: T005, T007, T009, T012 in parallel after T003.
- Phase 2: the three package groups — `ui` (T025–T030), `curriculum` (T031–T051), `metrics`
  (T052–T058) — are independent of each other once the seams exist, and `[P]` marks the rest.
- Phases 3–8: **two lanes concurrently is the working default, three the ceiling** (Constitution IX).

## Implementation Strategy

### MVP first

Phase 1 + Phase 2 + Phase 3. That alone types a Stage 1 scale in both languages and both modes, with
the layout check passing — demonstrable, and the thing everything else hangs from.

### Incremental delivery

Then US2 and US3 as the first concurrent pair, which together complete the learning loop and make the
requirements' §9 demo steps 2, 3, 5 and 6 reachable. Then US4 with US5, then US6. Each lane is one
worktree, one branch, one PR, squash-merged by a human.

### Suggested pairing

| Round | Lanes |
|---|---|
| 1 | Foundational (single lane, no concurrency) |
| 2 | `[US1]` alone — it is the largest and everything reads its output |
| 3 | `[US2]` + `[US3]` |
| 4 | `[US4]` + `[US5]` |
| 5 | `[US6]` |

## Notes

- 149 tasks: 12 setup, 59 foundational, 21 US1, 13 US2, 11 US3, 6 US4, 10 US5, 8 US6, 9 polish. `/speckit-analyze` added T149 after finding FR-038 uncovered.
- **The Foundational phase is the bulk of F1 and that is not a mis-cut.** Anything three or more
  stories read cannot live in a lane, because a lane may not import another lane's unmerged code.
  `specs/roadmap.md` already says "F1 alone — it is the foundation"; this is what that means in files.
- Every path here falls inside its phase's entry in
  [plan.md's file-ownership table](./plan.md#file-ownership). Report a mismatch rather than widening a path.
- Lanes tick only the `[X]` lines inside their own phase; the human reconciles this file on `main`
  after each squash merge, keeping both sides on conflict.
- Every PR body carries: story id, tasks covered, the Independent Test, the `code-review` summary, the
  CI run link, and `Waived: VII — authentication arrives in F2`.
