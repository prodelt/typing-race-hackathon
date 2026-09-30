---

description: "Task list for F4 004-academy-and-analytics (compact package, ADR-0010)"
---

# Tasks: Academy and Analytics (F4)

**Input**: [spec.md](./spec.md). Decisions live in tickets
[09](../../.scratch/typing-race-hackathon/issues/09-requirements-beyond-tz.md),
[10](../../.scratch/typing-race-hackathon/issues/10-pedagogical-model.md),
[11](../../.scratch/typing-race-hackathon/issues/11-stack-and-architecture.md) and
[12](../../.scratch/typing-race-hackathon/issues/12-dictionary-pipeline-and-exercise-generation.md).

**Tests**: required. Test tasks precede their implementation; property tests are mandatory for the
Next Action, module completion and the generator.

**Gates ([ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md))**: everything on `main`; a
task closes on green `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright on Chromium during work, in
full at the end.

## Format: `- [ ] Tnnn [P?] [USn] Description in path (FR-nnn)`

`[P]`: paths do not overlap. Hot files change only in phases 1 and 2. F4 starts after F2 and F3 are on
`main`.

## Ownership

| Phase | Owns |
|---|---|
| 1 + 2 | hot files, `data/catalogue/academy-modules.json`, `data/curriculum/**`, `packages/domain/**`, `packages/dictionary-pipeline/src/academy/**`, `packages/curriculum/src/{progress,coach,review}/**`, `apps/web/src/{seams,sw,app}/**` |
| US1 | `apps/web/src/features/academy/**`, `e2e/academy.spec.ts` |
| US2 | `apps/web/src/features/review/**`, `e2e/review.spec.ts` |
| US3 | `apps/web/src/features/statistics/**`, `e2e/statistics.spec.ts` |
| US4 | `packages/curriculum/src/diagnostic/**`, `apps/web/src/features/diagnostic/**`, `e2e/diagnostic.spec.ts` |

---

## Phase 1: Setup

- [ ] T001 Register message catalogues `academy`, `review`, `statistics`, `diagnostic` in
  `apps/web/project.inlang/settings.json`
- [ ] T002 [P] Enable the Review and Statistics items in the six-item navigation, F1 having left them
  disabled, in `apps/web/src/app/Shell.tsx` (FR-011)
- [ ] T003 Add `/academy`, `/academy/$moduleId`, `/review`, `/statistics`, `/diagnostic` routes in
  `apps/web/src/app/router.tsx`

**Checkpoint**: install, typecheck, lint green; routes render placeholders.

---

## Phase 2: Foundational

### Domain, fold and Next Action

- [ ] T004 Extend `ExerciseKind` with `academy` and `diagnostic`, and `Progress` with per-module state, in
  `packages/domain/src/index.ts` (FR-004, FR-023)
- [ ] T005 Tests first: a module completes only with the three-attempt rule on every exercise **and** module
  accuracy ≥ 97%; slow accurate attempts still complete, in
  `packages/curriculum/src/progress/academy.test.ts` (FR-004, FR-005)
- [ ] T006 Module completion in the fold in `packages/curriculum/src/progress/academy.ts`, bumping
  `DERIVED_VERSION`; resolve the accuracy-aggregation decision first (FR-004)
- [ ] T007 Tests first: exactly one Next Action for any input, rules 3 and 4 name a tempo module or the
  next key or module, in `packages/curriculum/src/coach/next-action.property.test.ts` (FR-017, FR-026)
- [ ] T008 Extend the rule engine and templates for Stage 2 and Stage 3 in
  `packages/curriculum/src/coach/next-action.ts` and `templates.ts` (FR-017, FR-018)

### Academy data

- [ ] T009 Author the module catalogue in `data/catalogue/academy-modules.json`; resolve the contents
  decision first (FR-001, FR-006)
- [ ] T010 [P] n-gram query helpers for same-finger, rolls, alternation and doubled letters over F3's
  tables in `packages/dictionary-pipeline/src/academy/queries.ts` (FR-002)
- [ ] T011 [P] Morpheme weights and examples from the filtered bank in
  `packages/dictionary-pipeline/src/academy/morphemes.ts` (FR-007)
- [ ] T012 [P] Phrase cutter over the authored sentences in
  `packages/dictionary-pipeline/src/academy/phrases.ts` (FR-007)
- [ ] T013 Module generator writing `data/curriculum/{uk,en}/academy/*.json` in
  `packages/dictionary-pipeline/src/academy/generate.ts`, with a build-fails-on-locked-key test (FR-001,
  FR-003)
- [ ] T014 Determinism check extended to `data/curriculum/` in
  `packages/dictionary-pipeline/src/academy/determinism.test.ts` (FR-001)
- [ ] T015 Academy data loader and service-worker caching in `apps/web/src/seams/academy-data.ts` and
  `apps/web/src/sw/worker.ts` (FR-001)

### Review ranking and generation

- [ ] T016 Tests first: ranking weakest first, transitions under five observations unranked, Ukrainian
  Same-Finger weight, in `packages/curriculum/src/review/rank.test.ts` (FR-012, FR-014)
- [ ] T017 Weak-element ranking in `packages/curriculum/src/review/rank.ts` (FR-012, FR-014)
- [ ] T018 Tests first: generated exercise has the focus in every item and no locked character, in
  `packages/curriculum/src/review/generate.property.test.ts` (FR-013, FR-026)
- [ ] T019 Adaptive generator through F3's `buildExercise`, with the weak-key fallback, in
  `packages/curriculum/src/review/generate.ts` (FR-013, FR-015)

**Checkpoint**: `pnpm test` green; `data/curriculum/` committed and deterministic.

---

## Phase 3: User Story 1 - The Academy (P1)

**Independent Test**: seeded store; open a module, pass each exercise three times, completion needs the
97% floor, a slow accurate learner completes.

- [ ] T020 [US1] E2E for scenarios 1–6 in `e2e/academy.spec.ts` (FR-001, FR-004, FR-005, FR-010)
- [ ] T021 [US1] Academy list with states and unlock conditions in
  `apps/web/src/features/academy/AcademyPath.tsx` (FR-011)
- [ ] T022 [US1] Module page in `apps/web/src/features/academy/ModulePage.tsx` (FR-004)
- [ ] T023 [US1] Hook loading a fixed exercise and launching the F1 typing screen with free Backspace in
  `apps/web/src/features/academy/useAcademyExercise.ts` (FR-003, FR-009)
- [ ] T024 [P] [US1] Metronome-paced tempo runner with an optional error-free variant in
  `apps/web/src/features/academy/TempoRunner.tsx` (FR-009, FR-010)
- [ ] T025 [P] [US1] Paragraph exercises as a static three-line block, reusing
  `apps/web/src/features/session/ParagraphBlock.tsx` from F3 (FR-008)
- [ ] T026 [P] [US1] Strings in `apps/web/messages/academy/uk.json` and `en.json` (FR-011)

---

## Phase 4: User Story 2 - Review and the adaptive generator (P1)

**Independent Test**: seeded weakest transition first in Review; generated exercise has it in every item.

- [ ] T027 [US2] E2E for scenarios 1–6 in `e2e/review.spec.ts` (FR-012, FR-013, FR-016, FR-017)
- [ ] T028 [US2] Review screen in `apps/web/src/features/review/ReviewScreen.tsx` (FR-012)
- [ ] T029 [P] [US2] Ranked weak list with not-yet-judged rows in
  `apps/web/src/features/review/WeakList.tsx` (FR-012)
- [ ] T030 [US2] "Practise this" launching the generated exercise in
  `apps/web/src/features/review/StartWeakExercise.tsx` (FR-013, FR-015)
- [ ] T031 [US2] Feed the session warm-up from the same ranking in
  `apps/web/src/features/session/compose.ts` (FR-003)
- [ ] T032 [P] [US2] Strings in `apps/web/messages/review/uk.json` and `en.json` (FR-012)

---

## Phase 5: User Story 3 - Heatmaps and rhythm visualisation (P2)

**Independent Test**: seed 30 attempts; heatmap, bars, line and rhythm chart render with text
alternatives, unchanged after log pruning.

- [ ] T033 [US3] E2E for scenarios 1–4 in `e2e/statistics.spec.ts` (FR-019, FR-021, FR-022)
- [ ] T034 [P] [US3] View models over aggregates with property tests in
  `apps/web/src/features/statistics/model.ts` and `model.test.ts` (FR-022)
- [ ] T035 [P] [US3] Keyboard heatmap SVG in `apps/web/src/features/statistics/KeyboardHeatmap.tsx` (FR-019)
- [ ] T036 [P] [US3] Transition-latency bars in `apps/web/src/features/statistics/TransitionBars.tsx`
  (FR-019)
- [ ] T037 [P] [US3] Progress line in `apps/web/src/features/statistics/ProgressLine.tsx` (FR-019)
- [ ] T038 [P] [US3] Rhythm and error overview in `apps/web/src/features/statistics/RhythmOverview.tsx`
  (FR-020)
- [ ] T039 [US3] Statistics page composing the four, linking F2's History, in
  `apps/web/src/features/statistics/StatisticsPage.tsx` (FR-019)
- [ ] T040 [P] [US3] Strings in `apps/web/messages/statistics/uk.json` and `en.json` (FR-021)

---

## Phase 6: User Story 4 - The Diagnostic (P2)

**Independent Test**: scripted slow and fast runs; boundary only moves forward; skip changes nothing.

- [ ] T041 [US4] E2E for scenarios 1–4 in `e2e/diagnostic.spec.ts` (FR-023, FR-024, FR-025)
- [ ] T042 [US4] Tests first, then scoring that maps a run to a boundary move and seeded confidence, in
  `packages/curriculum/src/diagnostic/score.ts` and `score.test.ts`; resolve the scoring decision first
  (FR-023, FR-024)
- [ ] T043 [US4] 90-second mixed-text run with skip in
  `apps/web/src/features/diagnostic/DiagnosticScreen.tsx` (FR-023)
- [ ] T044 [US4] Onboarding wiring and forward-only save in
  `apps/web/src/features/diagnostic/useDiagnostic.ts` (FR-024, FR-025)
- [ ] T045 [P] [US4] Strings in `apps/web/messages/diagnostic/uk.json` and `en.json` (FR-025)

---

## Phase 7: Polish and integration

- [ ] T046 Once F2 is on `main`, widen `submit-attempt` to admit `academy` and `diagnostic` attempts, in
  `supabase/functions/submit-attempt/index.ts` (FR-001, FR-023)
- [ ] T047 Full Playwright matrix on Chromium, Firefox and WebKit (DoD)
- [ ] T048 [P] axe and Lighthouse on Academy, Review and Statistics
- [ ] T049 [P] Add Academy module, Weak element and Adaptive generator to `CONTEXT.md`
- [ ] T050 Trace FR-001…FR-026 to tasks and tests; list gaps in `specs/004-academy-and-analytics/notes.md`
- [ ] T051 Set F4 `Status` to built in `specs/roadmap.md`

## Notes

- 51 tasks: 3 setup, 16 foundational, 7 US1, 6 US2, 8 US3, 5 US4, 6 polish.
- Suggested fan-out: US1 and US2 together, then US3 and US4.
