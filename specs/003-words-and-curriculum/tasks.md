---

description: "Task list for F3 003-words-and-curriculum (compact package, ADR-0010)"
---

# Tasks: Words and Curriculum (F3)

**Input**: [spec.md](./spec.md). Decisions live in tickets
[08](../../.scratch/typing-race-hackathon/issues/08-dictionaries-licensing-research.md),
[10](../../.scratch/typing-race-hackathon/issues/10-pedagogical-model.md),
[12](../../.scratch/typing-race-hackathon/issues/12-dictionary-pipeline-and-exercise-generation.md) and
[21](../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md).

**Tests**: required. Test tasks precede their implementation; property tests are mandatory for
normalisation, determinism and `buildExercise`.

**Gates ([ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md))**: everything on `main`; a
task closes on green `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright on Chromium during work, in
full at the end.

## Format: `- [ ] Tnnn [P?] [USn] Description in path (FR-nnn)`

`[P]`: paths do not overlap. Hot files change only in phases 1 and 2.

## Ownership

| Phase | Owns |
|---|---|
| 1 + 2 | hot files, `dictionaries/**`, `data/**`, `packages/dictionary-pipeline/**`, `packages/domain/**`, `packages/curriculum/src/{words/{types,select,build-exercise},progress}/**`, `apps/web/src/{seams,sw,app}/**`, `apps/web/src/features/exercise/plan.ts`, `tools/**` |
| US1 | `apps/web/src/features/stage2/{Stage2*,use*}`, `e2e/stage2.spec.ts` |
| US2 | `packages/curriculum/src/words/{widen,mechanics}*`, `apps/web/src/features/stage2/{Mechanics*,FocusChange*}` |
| US3 | `packages/curriculum/src/words/drills*`, `apps/web/src/features/drills/**`, `e2e/drills.spec.ts` |
| US4 | `apps/web/src/features/session/**`, `e2e/realtext.spec.ts` |
| US5 | `apps/web/src/features/public/**`, `apps/web/src/features/formulas/Tiers.tsx`, `e2e/sources.spec.ts` |

---

## Phase 1: Setup

- [ ] T001 Fetch current docs with `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` for the chosen
  Hunspell implementation and the Vite plugin API; record the Hunspell decision in
  `specs/003-words-and-curriculum/notes.md` (FR-007)
- [ ] T002 Create `packages/dictionary-pipeline/` (`package.json`, `tsconfig.json` with Node types
  allowed, Vitest `node` project in `vitest.config.ts`) and pin Node in `.node-version` (FR-017)
- [ ] T003 [P] Vendoring script and `dictionaries/manifest.yml`, `dictionaries/CHECKSUMS.sha256` for the
  seven vendored inputs only, `*_full` recorded as excluded, in
  `packages/dictionary-pipeline/scripts/vendor.ts` (FR-001, FR-002)
- [ ] T004 [P] Per-file licences in `data/LICENSES.md` (FR-003, FR-004)
- [ ] T005 Vite plugin emitting hashed delta chunks and one-file-per-kind tables with immutable caching,
  registered in `vite.config.ts`, in `tools/vite-plugin-data-chunks.ts` (FR-030, FR-031)
- [ ] T006 Make `dictionary-checksum` real and add the run-twice-and-diff job in
  `.github/workflows/ci.yml` (FR-018)
- [ ] T007 [P] Register message catalogues `words`, `drills`, `sources` in
  `apps/web/project.inlang/settings.json`

**Checkpoint**: install, typecheck, lint green; the vendoring script verifies its own checksums.

---

## Phase 2: Foundational (the dictionary pipeline and the seams)

### Domain and progress

- [ ] T008 Extend `Attempt` additively with `exerciseKind` (`scale`, `words`, `mechanics`, `realText`),
  an `ExerciseRef` and `dataVersion` in `packages/domain/src/index.ts` (FR-023, FR-031)
- [ ] T009 Extend `InputEvent` char events with an optional Shift side in
  `packages/domain/src/index.ts`, and fill it from `event.code` in `apps/web/src/seams/input.ts` (FR-028)
- [ ] T010 Tests first: a `words` Test Attempt counts toward the Mastery Rule, a `mechanics` one never does,
  in `packages/curriculum/src/progress/stage2.test.ts` (FR-023, FR-026)
- [ ] T011 Make the fold honour `exerciseKind` in `packages/curriculum/src/progress/derive.ts`, bumping
  `DERIVED_VERSION` (FR-023, FR-026)

### Pipeline — tests first

- [ ] T012 [P] Property and example tests: NFC idempotent, apostrophe fold, `і ї є ґ` untouched, case never
  folded, in `packages/dictionary-pipeline/src/normalise.test.ts` (FR-005, FR-006, FR-034)
- [ ] T013 [P] Determinism test: two runs byte-identical, in
  `packages/dictionary-pipeline/src/determinism.test.ts` (FR-017, FR-018)
- [ ] T014 [P] Marker-word test: residual Russian and profane words absent from every shipped bank, in
  `packages/dictionary-pipeline/src/banks.test.ts` (FR-008, FR-010)

### Pipeline — implementation

- [ ] T015 Normaliser in `packages/dictionary-pipeline/src/normalise.ts` (FR-005, FR-006)
- [ ] T016 Checksummed source reader in `packages/dictionary-pipeline/src/sources.ts` (FR-001)
- [ ] T017 [P] Hunspell membership filter in `packages/dictionary-pipeline/src/filter/hunspell.ts`
  (FR-007)
- [ ] T018 [P] Authored denylist filter in `packages/dictionary-pipeline/src/filter/denylist.ts` (FR-008)
- [ ] T019 [P] LDNOOBW profanity filter in `packages/dictionary-pipeline/src/filter/profanity.ts` (FR-010)
- [ ] T020 [P] Double-query proper-noun split and capitalisation in
  `packages/dictionary-pipeline/src/filter/proper.ts` (FR-009)
- [ ] T021 Difficulty and tier rules with property tests in
  `packages/dictionary-pipeline/src/difficulty.ts` and `difficulty.test.ts`; uses `rowChanges` =
  adjacent row-changing pairs (FR-014)
- [ ] T022 `unlockIndex` from F1's Unlock Order in `packages/dictionary-pipeline/src/unlock-index.ts`
  (FR-013)
- [ ] T023 Word records as JSON Lines in `packages/dictionary-pipeline/src/words.ts` (FR-011, FR-012)
- [ ] T024 Bigram and trigram tables, once per word, in `packages/dictionary-pipeline/src/ngrams.ts`
  (FR-015)
- [ ] T025 Canonical JSON writer and `derived-manifest.json` with before/after counts per filter in
  `packages/dictionary-pipeline/src/manifest.ts` (FR-018)
- [ ] T026 Delta chunker in `packages/dictionary-pipeline/src/chunks.ts` (FR-030)
- [ ] T027 CLI entry in `packages/dictionary-pipeline/src/cli.ts`; run it and commit `data/derived/**`
  (FR-019)

### Authored content

- [ ] T028 [P] Write `data/authored/uk/` and `data/authored/en/`: apostrophe words, morphemes, sentences,
  paragraphs, and `denylist-uk.txt` built from the top 3 000 filtered words; flag `authored`; **human
  review required** (FR-008, FR-016)
- [ ] T029 Build-time Hunspell validation of all authored content in
  `packages/dictionary-pipeline/src/authored.ts` (FR-016)
- [ ] T030 Authored catalogue parameters (exercise sizes) in `data/catalogue/exercise-sizes.json` (FR-026)

### Exercise building and client data

- [ ] T031 Types for `Exercise`, `Item`, `BankChunk` in `packages/curriculum/src/words/types.ts` (FR-020)
- [ ] T032 Tests first: never a locked character, focus in every item, at least 8 distinct items, same
  seed same items, in `packages/curriculum/src/words/build-exercise.property.test.ts` (FR-020, FR-021, FR-022)
- [ ] T033 Candidate selection at the current tier, frequency-weighted, with a `WideningStrategy` hook US2
  fills, in `packages/curriculum/src/words/select.ts` (FR-021)
- [ ] T034 `buildExercise(bankChunk, n, confidenceMap, seed)` in
  `packages/curriculum/src/words/build-exercise.ts` using the existing seeded PRNG (FR-020)
- [ ] T035 Chunk loader merging chunks 0…n, carrying `dataVersion`, in `apps/web/src/seams/chunks.ts`
  (FR-030, FR-031)
- [ ] T036 Cache unlocked chunks plus the next in `apps/web/src/sw/worker.ts` (FR-030)
- [ ] T037 Generalise the exercise plan to accept an `ExerciseRef` of any kind in
  `apps/web/src/features/exercise/plan.ts` (FR-024, FR-025)
- [ ] T038 Add Stage 2, Drills and Sources routes in `apps/web/src/app/router.tsx` (FR-024, FR-032)

**Checkpoint**: `pnpm test` green, the determinism diff passes, `data/derived/` committed.

---

## Phase 3: User Story 1 - Stage 2 words (P1)

**Independent Test**: seeded store; every character unlocked, focus in every item, corrected error
counted, three passes unlock the next key.

- [ ] T039 [US1] E2E for scenarios 1–7 in `e2e/stage2.spec.ts` (FR-022, FR-025, FR-026)
- [ ] T040 [US1] Stage 2 section on Path with the open gate in
  `apps/web/src/features/stage2/Stage2Path.tsx` (FR-024)
- [ ] T041 [US1] Hook loading chunks, building the exercise and storing the seed in
  `apps/web/src/features/stage2/useStage2Exercise.ts` (FR-020, FR-030)
- [ ] T042 [US1] Stage 2 screen reusing the F1 typing screen with free Backspace in
  `apps/web/src/features/stage2/Stage2Screen.tsx` (FR-025)
- [ ] T043 [P] [US1] Strings in `apps/web/messages/words/uk.json` and `en.json` (FR-024)

---

## Phase 4: User Story 2 - Labelled mechanics fallback (P2)

**Independent Test**: too-small unlocked set; widening order, badge, no key unlock.

- [ ] T044 [US2] Tests first for the widening order and the silent-focus-change ban in
  `packages/curriculum/src/words/widen.test.ts` (FR-021)
- [ ] T045 [US2] Widening strategy in `packages/curriculum/src/words/widen.ts` (FR-021)
- [ ] T046 [US2] Pseudo-word generator from the focus bigram and unlocked letters in
  `packages/curriculum/src/words/mechanics.ts` (FR-023)
- [ ] T047 [P] [US2] "Механіка — не слова" badge in
  `apps/web/src/features/stage2/MechanicsBadge.tsx` (FR-023)
- [ ] T048 [P] [US2] Spoken focus-change notice in `apps/web/src/features/stage2/FocusChangeNotice.tsx`
  (FR-021)

---

## Phase 5: User Story 3 - Shift, apostrophe, hyphen drills (P2)

**Independent Test**: each drill's bank, same-hand Shift flagged, U+0027 and U+2019 both correct.

- [ ] T049 [US3] E2E for scenarios 1–4 in `e2e/drills.spec.ts` (FR-028, FR-006)
- [ ] T050 [US3] Drill selection from the three banks in `packages/curriculum/src/words/drills.ts` (FR-009,
  FR-016)
- [ ] T051 [US3] Opposite-hand Shift check against the event's Shift side in
  `packages/curriculum/src/words/shift-rule.ts` with a property test (FR-028)
- [ ] T052 [P] [US3] Drill picker and screen in `apps/web/src/features/drills/DrillsScreen.tsx`
  (FR-028)
- [ ] T053 [P] [US3] Non-blocking Shift flag in `apps/web/src/features/drills/ShiftFlag.tsx` (FR-028)
- [ ] T054 [P] [US3] Strings in `apps/web/messages/drills/uk.json` and `en.json`

---

## Phase 6: User Story 4 - Real text fourth block (P2)

**Independent Test**: a full session reaches a real-text block from authored content.

- [ ] T055 [US4] E2E in `e2e/realtext.spec.ts` (FR-029)
- [ ] T056 [US4] Build a real-text item from the authored corpus in
  `apps/web/src/features/session/realText.ts` (FR-029)
- [ ] T057 [US4] Replace `RealTextPending` with a fourth block and size it to 3–5 minutes in
  `apps/web/src/features/session/compose.ts` and `sizing.ts` (FR-029)
- [ ] T058 [US4] Static three-line paragraph display in
  `apps/web/src/features/session/ParagraphBlock.tsx` (FR-029)

---

## Phase 7: User Story 5 - Sources and licences page (P2)

**Independent Test**: licences route signed out; counts match the manifest; Formulas states tiers.

- [ ] T059 [US5] E2E in `e2e/sources.spec.ts` (FR-032, FR-033)
- [ ] T060 [US5] Sources and licences page reading `derived-manifest.json` in
  `apps/web/src/features/public/Sources.tsx` (FR-032)
- [ ] T061 [P] [US5] Tier rules section on Formulas in
  `apps/web/src/features/formulas/Tiers.tsx` (FR-033)

---

## Phase 8: Polish and integration

- [ ] T062 Once F2 is on `main`, widen `submit-attempt`'s exercise validation to admit `words`,
  `mechanics` and `realText` attempts reproducible from `(dataVersion, seed)`, in
  `supabase/functions/submit-attempt/index.ts` (FR-031)
- [ ] T063 Coverage to 100% lines and branches for `dictionary-pipeline` (FR-034)
- [ ] T064 Full Playwright matrix on Chromium, Firefox and WebKit (DoD)
- [ ] T065 [P] axe and Lighthouse on Stage 2 and the Sources route
- [ ] T066 [P] Add Delta chunk and Authored corpus to `CONTEXT.md`
- [ ] T067 Trace FR-001…FR-034 to tasks and tests; list gaps in `specs/003-words-and-curriculum/notes.md`
- [ ] T068 Set F3 `Status` to built in `specs/roadmap.md`

## Notes

- 68 tasks: 7 setup, 31 foundational, 5 US1, 5 US2, 6 US3, 4 US4, 3 US5, 7 polish.
- The pipeline is the bulk of F3 by design ([ADR-0008](../../docs/adr/0008-canonical-agent-workflow.md)):
  every story reads the data, so none of it can live in a story tree.
- Suggested fan-out after Foundational: US1 and US3 together, then US2, US4, US5.
