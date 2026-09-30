# Feature Specification: Words and Curriculum

**Feature ID**: F3 · **Feature Directory**: `specs/003-words-and-curriculum`

**Status**: Compact package (ADR-0010) — spec and tasks only, no separate plan

**Input**: F3 `003-words-and-curriculum` from [`specs/roadmap.md`](../roadmap.md). Every requirement
cites the ticket or ADR it comes from; nothing is newly decided here. A gap is written as
`[NEEDS DECISION: …]`. Product rules in `AGENTS.md` § Non-negotiable product rules are inherited.

## Summary

F1 ships Stage 1 scales and a key unlock ladder but no word lists. F3 adds the **dictionary pipeline**
(its Foundational phase — [ADR-0008][A8]) that turns licensed frequency lists into committed,
checksummed data, and **Stage 2**: exercises of real words built only from keys the learner has
unlocked, with the weakest key or transition in every item. It attaches the Word Bank to **F1's
existing unlock ladder** (a roadmap edit recorded in [ticket 23][T23]); it builds no second ladder.
It also delivers the authored text corpus that completes F1's guided session, which F1 named as
"arriving with the word curriculum".

## Scope Boundary

**In F3.** Vendored sources and their manifest; the pure-Node pipeline and its filters; the Word Bank,
capitalisation bank, n-gram tables and difficulty tiers; the authored content (apostrophe words,
morphemes, sentences, paragraphs, Russian denylist); client delta chunks and their service-worker
caching; `buildExercise` and Stage 2 on Path; the labelled mechanics fallback; Shift, apostrophe and
hyphen drills; the real-text fourth session block; the Sources and licences page.

## Open decisions

- `[NEEDS DECISION: what "Stage 2 opens as soon as the first 8 keys are unlocked" means now]`
  [Ticket 10][T10] set that gate, but F1's FR-084 made the eight home-row anchors available from the
  first exercise and kept them out of the Unlock Order, so the gate is open immediately. Ticket 12
  measured only 39 words for the eight ЙЦУКЕН home keys, so Stage 2 would open nearly empty. This spec
  implements "open once the anchors exist" and leans on the fallback chain (FR-021); a higher gate is a
  one-constant change.
- `[NEEDS DECISION: which Level band holds Stage 2 and real text]` [F1 FR-080] made the level follow
  the stage and left only the Introduction floor (95%) in force; the later floors (96/97/97/98) exist as
  data. No ticket maps Stage 2 to one.
- `[NEEDS DECISION: how Hunspell runs in a pure Node pipeline]` [Ticket 12][T12] requires Hunspell
  membership as the filter and a deterministic Node pipeline, but names no implementation (a JS port
  versus a native binding).
- `[NEEDS DECISION: Difficulty Tier thresholds]` [Ticket 12][T12] says tier comes from "rank band ×
  length" and fixes the 1–5 scale, not the band edges or length cut-offs.
- `[NEEDS DECISION: how F2's submit-attempt admits Stage 2 attempts]` F2's function validates an
  attempt's exercise against the Scale Catalogue. A `words` or `realText` attempt has no scale; it is
  reproducible only from `(chunk dataVersion, n, seed)` ([ticket 12][T12]). The function is F2's tree,
  so F3 cannot widen it while F2 runs in parallel (roadmap). Tasked as a post-merge integration step.
- `[NEEDS DECISION: who reviews the denylist and the authored corpus, and when]` [Ticket 12][T12]
  requires human review of the top 3 000 filtered words and of AI-drafted sentences; under ADR-0010
  the time budget for that is unstated.

## User Scenarios & Testing *(mandatory)*

Five stories over one Foundational phase. The pipeline and the word data are Foundational because
Stories 1–4 all read them; a story never imports another story's code.

### User Story 1 - Stage 2: words from the keys I know (Priority: P1)

A learner opens Stage 2 on Path and types 20–25 real words built only from keys they have unlocked,
each item containing their weakest key or transition. Errors can be corrected with Backspace and still
count. Three consecutive passing Test Attempts complete the exercise and, when its focus is the next
locked key, unlock it.

**Independent Test**: from a seeded store with a known unlocked set, start Stage 2, type one exercise,
and confirm every character is in the unlocked set, the focus element is in every item, a corrected
error still counts, and three passing Test Attempts unlock the next key.

**Acceptance Scenarios**:

1. **Given** an unlocked set of the home row plus two keys, **When** a Stage 2 exercise is built,
   **Then** every character of every word lies in that set.
2. **Given** a weakest key or transition, **When** the exercise is built, **Then** it appears in every
   item and there are at least eight distinct items.
3. **Given** the same chunk, unlocked set, confidence map and seed, **When** built twice, **Then** the
   items are identical, and the seed is stored on the attempt.
4. **Given** a wrong keystroke corrected with Backspace in Stage 2, **When** the attempt ends,
   **Then** it stays in the error count and the accuracy denominator.
5. **Given** a Stage 2 exercise focused on the next locked key, **When** the third consecutive Test
   Attempt passes the floor, **Then** exactly that key unlocks.
6. **Given** the learner unlocks another key, **When** Stage 2 is opened again, **Then** words using the
   new key now appear and the next delta chunk is already cached for offline use.
7. **Given** a Test Attempt in Stage 2, **When** it runs, **Then** the four guides of F1's zero-peek
   rule are absent exactly as in Stage 1.

---

### User Story 2 - When words run out: a labelled mechanics exercise (Priority: P2)

When too few real words exist for the focus and unlocked keys, the exercise widens in a fixed order and
— only as the last resort — becomes an explicitly labelled mechanics exercise of pseudo-words. The
learner is never given pseudo-words disguised as words and never has their focus changed silently.

**Independent Test**: with an unlocked set too small for the focus, build the exercise and confirm the
widening order, the "Механіка — не слова" badge naming the trained bigram, and that completing it does
not unlock a key.

**Acceptance Scenarios**:

1. **Given** too few words at the current tier, **When** built, **Then** it widens to neighbouring
   tiers, then to the capitalisation bank and authored words, before any pseudo-word appears.
2. **Given** no real words can carry the focus, **When** built, **Then** a mechanics exercise is shown
   with a visible badge naming the bigram, and it never mixes pseudo-words with real words.
3. **Given** a completed mechanics exercise with three passing Test Attempts, **When** progress is
   recomputed, **Then** no key unlocks from it, while Stage 1 scale Test Attempts still unlock.
4. **Given** the focus cannot be typed with unlocked keys at all, **When** built, **Then** the
   next-weakest element becomes the focus and the screen says so in words.

---

### User Story 3 - Shift, apostrophe and hyphen drills (Priority: P2)

The learner practises capitalised words from the separate capitalisation bank with the opposite-hand
Shift rule enforced, apostrophe words from our authored list, and hyphenated words.

**Independent Test**: start each of the three drills and confirm the bank each draws from, that Shift on
the wrong hand is flagged, and that an apostrophe typed as U+0027 or U+2019 is judged correct.

**Acceptance Scenarios**:

1. **Given** a Shift drill, **When** the learner capitalises a letter with the same-hand Shift, **Then**
   it is flagged without ending the attempt and without consuming a character.
2. **Given** the capitalisation bank, **When** drawn, **Then** every word is flagged `proper` and was
   capitalised by the pipeline, not copied from a dictionary.
3. **Given** an apostrophe drill, **When** words appear, **Then** they come from the authored list, are
   stored with U+0027 and shown with U+2019, and both fold on input.
4. **Given** a hyphen drill, **When** words appear, **Then** each is a real hyphenated word from the
   filtered bank and the hyphen key's finger is named.

---

### User Story 4 - Real text: the fourth block of a session (Priority: P2)

The guided session gains its fourth block, 3–5 minutes of authored sentences and paragraphs that
cover apostrophe, `ґ`, hyphen, quotes and numbers, replacing the notice F1 showed.

**Independent Test**: run a full session from a seeded store and confirm a fourth block of real text
is reached, its text is authored and Hunspell-validated, and the between-blocks screen names it.

**Acceptance Scenarios**:

1. **Given** a session at its last block, **When** it starts, **Then** real text from the authored
   corpus appears for roughly 3–5 minutes and F1's "arriving later" notice is gone.
2. **Given** real text longer than one line, **When** shown, **Then** it is a static three-line block
   rather than a scrolling line.
3. **Given** a real-text attempt, **When** it ends, **Then** it is recorded with its corpus `dataVersion`
   and produces one Next Action like any other.
4. **Given** the corpus, **When** inspected, **Then** every item is flagged `authored` and no public
   text, classic or third-party sentence set is in it.

---

### User Story 5 - Sources and licences are readable (Priority: P2)

Anyone, signed in or not, can open a page that states where every word came from, under which licence,
which filters ran and how many words each removed — and the Formulas page states how difficulty tiers
are assigned.

**Independent Test**: open the licences route signed out; it lists each vendored source with its
licence, the filter counts from the committed manifest, and the tier rules; Formulas states the tiers.

**Acceptance Scenarios**:

1. **Given** the licences page, **When** read, **Then** every vendored source and its licence are
   listed, including the stricter CC-BY-SA-4.0 claim on FrequencyWords-derived tables.
2. **Given** the page, **When** read, **Then** it states hunspell-uk is a build-time filter only and
   that none of its word material is shipped.
3. **Given** the page, **When** read, **Then** before/after counts per filter match
   `derived-manifest.json`.
4. **Given** Formulas, **When** read, **Then** difficulty tiers, `sameFingerTransitions` and `rowChanges`
   (adjacent row-changing pairs) are stated.

---

### Edge Cases

- Ukrainian frequency lists contain no apostrophes at all, so no apostrophe word can be derived; they
  come only from the authored list ([ticket 08][T08]).
- Residual Russian such as `мне` and `его` survives the Hunspell filter; the denylist and a marker-word
  test remove it ([ticket 12][T12]).
- A unique word that is also a proper noun: only the double-query decides, and the lowercase list is
  never shipped as a proper noun.
- A word whose `unlockIndex` is beyond the learner's boundary is never served, even as a distractor.
- The learner changes the starting level forward: new chunks load; no chunk already cached is invalid.

## Requirements *(mandatory)*

### Functional Requirements

**Sources and licensing**

- **FR-001**: Only the sources the pipeline reads MUST be vendored into `dictionaries/` — the `uk_50k`
  and `en_50k` lists, hunspell-uk, hunspell-en, dwyl, LDNOOBW V2 (uk, en) — with our own `manifest.yml`
  and `CHECKSUMS.sha256`; the `*_full` lists are recorded as deliberately excluded. [T12]
- **FR-002**: Organizer `REVIEW_REQUIRED` material MUST NOT be committed or used until written
  permission exists. [T18][T12]
- **FR-003**: `data/LICENSES.md` MUST record per-file licences; derived FrequencyWords tables follow
  CC-BY-SA-4.0; hunspell-uk is a build-time filter only and its word material is never emitted. [T08]
- **FR-004**: Code is MIT and data carries its own licence. [T08]

**Normalisation and filters**

- **FR-005**: Text MUST be NFC-normalised; NFKC is used only as a build-time mojibake detector; case is
  never folded; `і`, `ї`, `є`, `ґ` are never touched. [T08]
- **FR-006**: The apostrophe MUST be stored as U+0027, displayed as U+2019 and folded on both sides of
  every comparison. [T08]
- **FR-007**: Hunspell membership MUST be the word filter, since a strict alphabet filter leaves
  Russian intact. [T08][T12]
- **FR-008**: An authored `denylist-uk`, built by reviewing the top 3 000 filtered words, MUST remove
  residual Russian, and a test MUST assert marker words are absent from the bank. [T12]
- **FR-009**: Proper nouns (double Hunspell query) MUST move to a separate capitalisation bank flagged
  `proper`, capitalised by the pipeline; Hunspell answers only the case question. [T12]
- **FR-010**: Profanity MUST be dropped via LDNOOBW V2 for both languages, with no exceptions. [T12]

**Data shape**

- **FR-011**: A word record MUST carry the requirements' word fields plus `rank`, `trigrams`,
  `unlockIndex`, `difficulty.handAlternations`, `difficulty.tier` (1–5) and `flags` ⊂ {`proper`,
  `apostrophe`, `hyphen`, `authored`, `pseudo`}, as JSON Lines, one word per line. [T12]
- **FR-012**: Language MUST fix layout (`uk` ⇔ ЙЦУКЕН, `en` ⇔ QWERTY), so every difficulty metric is
  single-valued per word. [T12]
- **FR-013**: `unlockIndex` MUST be the highest Unlock Order position among a word's characters, taken
  from F1's existing ladder; Stage 2 filtering is `unlockIndex ≤ n`. [T12][T23]
- **FR-014**: Difficulty MUST be transparent tier rules (rank band × length) with
  `sameFingerTransitions` and `rowChanges` only ordering words within a tier; no weighted composite
  score; `rowChanges` counts adjacent row-changing pairs; the rules are published. [T12][T10][A4]
- **FR-015**: n-gram tables MUST be in-word bigrams and trigrams over the filtered bank, weight = sum
  of frequencies of words containing it, once per word; each row carries n-gram, weight, rank, fingers,
  transition class and `rowChanges`; top 500 bigrams and 1 000 trigrams are published. [T12][T08]
- **FR-016**: Authored content (apostrophe words ~80–120, morphemes ~60 uk and ~40 en, sentences ~300
  and paragraphs ~60 per language) MUST be flagged `authored`, written in modern orthography, cover
  apostrophe, `ґ`, hyphen, quotes and numbers, and be Hunspell-validated at build time; no public-domain
  classics and no Tatoeba. [T12]

**Determinism**

- **FR-017**: The pipeline MUST be pure Node with stable sorting, canonical JSON, no timestamps and a
  pinned Node version. [T12]
- **FR-018**: `data/derived/` MUST be committed with `derived-manifest.json` (input sha256, algorithm
  version, before/after counts per filter, output sha256); CI MUST run the pipeline twice and diff both
  runs against the committed output. [T12][T15]
- **FR-019**: The directory layout MUST be `dictionaries/`, `data/authored/{uk,en}/`, `data/catalogue/`,
  `data/derived/{uk,en}/`, `data/curriculum/{uk,en}/`, `data/LICENSES.md`. [T12]

**Stage 2 and exercise building**

- **FR-020**: `buildExercise(bankChunk, n, confidenceMap, seed) → items` MUST be a pure function with a
  seeded PRNG, never `Math.random`, and the seed MUST be stored on the attempt. [T12]
- **FR-021**: Selection MUST require the focus element in every item and at least eight distinct
  items, widening in this order: current tier, frequency-weighted; neighbouring tiers; the
  capitalisation bank and authored words; a labelled mechanics exercise; else the next-weakest element
  becomes the focus. A focus change MUST never be silent. [T12]
- **FR-022**: An exercise MUST NEVER contain a character outside the unlocked set. [T15][T12]
- **FR-023**: Pseudo-words MUST be flagged `pseudo`, typed `mechanics`, shown with a visible
  "Механіка — не слова" badge naming the bigram, never mixed with real words, and MUST NOT count toward
  a key unlock; Stage 1 scale Test Attempts still do. [T12]
- **FR-024**: Stage 2 MUST open without Stage 1 being finished, once the keys named in the Stage 2
  gate exist (see Open decisions). [T10]
- **FR-025**: Stage 2 MUST use free Backspace with corrected errors still counted; the exercise
  declares its error policy. [T10][A4]
- **FR-026**: The Mastery Rule MUST apply to real-word Test Attempts; exercise sizes are catalogue
  parameters (Stage 2: 20–25 words, about 150 characters). [T10][T12]
- **FR-027**: The Word Bank MUST serve as the weak-key picker fallback while transition data is sparse.
  [T09]
- **FR-028**: Shift drills MUST enforce the opposite-hand Shift rule. [T09]
- **FR-029**: The guided session MUST gain a fourth block of authored real text, about 3–5 minutes,
  replacing F1's pending notice; a paragraph is a static three-line block. [T10][T20][F1 FR-076]

**Client data**

- **FR-030**: Client data MUST be delta chunks — chunk *k* holds only words with `unlockIndex = k`;
  the client loads 0…n and merges. The service worker caches the unlocked chunks plus the next. [T21]
- **FR-031**: Files MUST carry hashed names with immutable caching, and every file a `dataVersion`,
  stored on the attempt beside the exercise `content_hash`. [T21]

**Pages and tests**

- **FR-032**: A public Sources and licences page MUST list sources, licences, filters and counts. [T17]
- **FR-033**: The Formulas page MUST state the tier rules. [T12]
- **FR-034**: Tests MUST include: `buildExercise` never emits a locked character (property and E2E),
  NFC idempotence, pipeline determinism, a committed-checksum check, and 100% line and branch coverage
  for `dictionary-pipeline`. [T15]

## Success Criteria *(mandatory)*

- **SC-001**: In 100% of built exercises, every character is in the learner's unlocked set.
- **SC-002**: The focus element is in every item of 100% of built exercises.
- **SC-003**: The same inputs and seed always rebuild the identical exercise.
- **SC-004**: Two pipeline runs, on two machines, produce byte-identical `data/derived/`.
- **SC-005**: No marker Russian word and no profane word is present in any shipped bank.
- **SC-006**: `і`, `ї`, `є`, `ґ` survive the pipeline, the chunks and the exercises unsubstituted.
- **SC-007**: No pseudo-word appears outside a labelled mechanics exercise, and none unlocks a key.
- **SC-008**: A learner completes a Stage 2 exercise offline after one load that cached its chunks.
- **SC-009**: The Sources page counts match the committed manifest.
- **SC-010**: Every F3 screen reports zero accessibility violations and is keyboard operable.

## Definition of Done *(restated from the constitution — test tasks are emitted only when asked)*

Constitution principle II applies to every story: domain logic test-first with property tests; an
end-to-end test per user-visible acceptance scenario on the production build; zero axe violations.
Working gates per [ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md): `pnpm typecheck`,
`pnpm lint`, `pnpm test`; Playwright on Chromium during work, in full at the end.

## Out of scope

Academy n-gram and morpheme modules, tempo series, phrases as a module type (F4) · adaptive slow-bigram
generator, heatmaps, Diagnostic (F4) · accounts and server storage (F2) · races and race texts as a
product feature (F5) · organizer training materials · a second unlock ladder · `*_full` lists · a
weighted composite difficulty score · additional layouts.

## Dependencies

F1 (Unlock Order, Mastery Rule, engine, session, `seeded-random`, finger map). F2 only for the
post-merge `submit-attempt` widening. External: the vendored source snapshots, which today sit in the
organizer's gitignored folder and are copied in under their own licences.

[A4]: ../../docs/adr/0004-accuracy-first-metrics-and-gating.md
[A8]: ../../docs/adr/0008-canonical-agent-workflow.md
[T08]: ../../.scratch/typing-race-hackathon/issues/08-dictionaries-licensing-research.md
[T09]: ../../.scratch/typing-race-hackathon/issues/09-requirements-beyond-tz.md
[T10]: ../../.scratch/typing-race-hackathon/issues/10-pedagogical-model.md
[T12]: ../../.scratch/typing-race-hackathon/issues/12-dictionary-pipeline-and-exercise-generation.md
[T15]: ../../.scratch/typing-race-hackathon/issues/15-testing-strategy-and-cicd.md
[T17]: ../../.scratch/typing-race-hackathon/issues/17-screen-map-and-user-journeys.md
[T18]: ../../.scratch/typing-race-hackathon/issues/18-organizer-permission-for-training-materials.md
[T20]: ../../.scratch/typing-race-hackathon/issues/20-key-screen-mockups-and-motion-spec.md
[T21]: ../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md
[T23]: ../../.scratch/typing-race-hackathon/issues/23-spec-kit-package-for-typing-core.md
[F1 FR-076]: ../001-typing-core/spec.md
[F1 FR-080]: ../001-typing-core/spec.md
