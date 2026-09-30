# Feature Specification: Academy and Analytics

**Feature ID**: F4 · **Feature Directory**: `specs/004-academy-and-analytics`

**Status**: Compact package (ADR-0010) — spec and tasks only, no separate plan

**Input**: F4 `004-academy-and-analytics` from [`specs/roadmap.md`](../roadmap.md). Every requirement
cites its ticket or ADR; nothing is newly decided. A gap is written `[NEEDS DECISION: …]`. Product rules
in `AGENTS.md` § Non-negotiable product rules are inherited.

## Summary

F4 is Stage 3 and the learner's view of their own weaknesses. It adds the **Academy** — fixed-content
modules of n-grams, morphemes, words, phrases, sentences, text and tempo — the **adaptive slow-bigram
generator** and **Review** screen, **heatmaps and rhythm/error charts**, and the skippable
**Diagnostic**. It consumes F3's `buildExercise` and n-gram tables and F2's stored attempt history. The
one-next-action rule engine already exists from F1; F4 **extends** it to Stage 2 and Stage 3 rather than
building it (the roadmap lists it under F4 — see Open decisions).

## Scope Boundary

**In F4.** The Academy module catalogue, its build-time generation and its screens; the completion rule;
the Review screen and the adaptive generator; extension of the Next Action rules beyond Stage 1; the
keyboard heatmap, transition-latency bars, progress line and rhythm/error visualisation on Statistics;
the Diagnostic and its onboarding screen.

## Open decisions

- `[NEEDS DECISION: what opens Stage 3]` [Ticket 10][T10] gives Stage 2's gate (first 8 keys) and Stage
  1's completion (all scales plus 96% over the last five) but no gate for the Academy or its modules.
- `[NEEDS DECISION: Academy module catalogue contents]` [Ticket 12][T12] fixes the order (pairs →
  syllables/morphemes → words → phrases → sentences → text → tempo) and that modules are authored, but
  not how many modules, which n-gram selections each holds, or their names.
- `[NEEDS DECISION: how "module accuracy ≥ 97%" is aggregated]` [Ticket 10][T10] states the floor but not
  whether it is the mean over the module's latest passing attempts, over all attempts, or per exercise.
- `[NEEDS DECISION: Diagnostic scoring]` [Ticket 10][T10] says 90 s of mixed text that keeps a beginner
  at the start or unlocks keys forward and seeds the confidence map; it gives no thresholds mapping
  speed and accuracy to one of the three starting-level options, and no way to seed confidence while
  progress stays a pure fold of attempts (F1 FR-050). The natural fit, left undecided here, is to record
  the Diagnostic as an attempt of its own kind.
- `[NEEDS DECISION: how F2's submit-attempt admits Academy and Diagnostic attempts]` Same gap as F3's
  Stage 2: the function validates against the Scale Catalogue. Tasked as a post-merge step.
- `[NEEDS DECISION: re-injection cadence]` [Ticket 10][T10] left open whether a mastered-but-weak
  element returns every session warm-up or by a scheduled re-test every N lessons; F1's warm-up does the
  former, and this spec keeps it.
- `[NEEDS DECISION: owner of the Statistics nav item]` F2 builds a History page; [ticket 17][T17] has one
  "Statistics & history" screen. This spec puts the visualisations on `/statistics` and links History.

## User Scenarios & Testing *(mandatory)*

Four stories over one Foundational phase, which holds the module catalogue and generators, the
progress-fold extension and the Next Action extension that Stories 1 and 2 both read.

### User Story 1 - The Academy (Priority: P1)

A learner who has left the basics opens the Academy, sees modules ordered from pairs to tempo, opens one,
and works through its fixed exercises. A module completes when every exercise passes the Mastery Rule
and module accuracy is at least 97%; speed is shown as a benchmark and gates nothing.

**Independent Test**: from a seeded store that opens the Academy, open a module, pass each exercise three
times, and confirm the module completes only when the accuracy floor also holds; a slow but accurate
learner still completes it.

**Acceptance Scenarios**:

1. **Given** the Academy opens, **When** it renders, **Then** modules appear in the fixed order with each
   module's state and what opens the next.
2. **Given** a module exercise, **When** started twice, **Then** the content is identical both times
   (modules never mutate to adapt).
3. **Given** every exercise passed three consecutive times but module accuracy under 97%, **When**
   progress is recomputed, **Then** the module is not complete.
4. **Given** very slow but accurate attempts, **When** recomputed, **Then** the module completes and no
   speed message blocks anything.
5. **Given** a paragraph or text exercise, **When** shown, **Then** it is a static three-line block.
6. **Given** a tempo exercise, **When** run, **Then** the metronome paces it and is never a pass mark.

---

### User Story 2 - Review and the adaptive generator (Priority: P1)

Review lists the learner's weakest keys and transitions, worst first. One button builds an exercise
around the slowest transition; it appears in every item, and the session warm-up draws from the same
list. After every attempt the one Next Action now also speaks for Stage 2 and Stage 3.

**Independent Test**: seed a store with a known weakest transition; open Review, see it first, start the
generated exercise and confirm the transition is in every item and no locked key appears.

**Acceptance Scenarios**:

1. **Given** confidence per key and per transition, **When** Review opens, **Then** elements are ranked
   weakest first and transitions with too few samples are marked not yet judged, not ranked.
2. **Given** the weakest transition, **When** the exercise is generated, **Then** it is in every item and
   only unlocked characters appear.
3. **Given** Ukrainian, **When** ranking, **Then** Same-Finger Transitions carry the extra weight F1
   defined.
4. **Given** sparse transition data, **When** generating, **Then** it falls back to the weak-key picker
   and says so.
5. **Given** any completed attempt in any stage, **When** the result renders, **Then** exactly one Next
   Action is shown, chosen by the four priorities, and "next key or module" names the right one.
6. **Given** a Test Attempt in progress, **When** the screen renders, **Then** no confidence indicator is
   present.

---

### User Story 3 - Heatmaps and rhythm visualisation (Priority: P2)

Statistics shows a keyboard heatmap (misses and delay per key), transition-latency bars, a progress line
and the rhythm and error picture across attempts — all hand-written SVG, all readable without colour.

**Independent Test**: seed 30 attempts, open Statistics and confirm the heatmap, bars, line and rhythm
chart render from aggregates with text alternatives, and still render once logs are pruned.

**Acceptance Scenarios**:

1. **Given** stored attempts, **When** Statistics opens, **Then** the heatmap shades each key by miss rate
   or delay and names the worst three keys in text.
2. **Given** the transition bars, **When** read by a screen reader, **Then** each bar's transition,
   fingers and mean delay are available as text.
3. **Given** logs pruned beyond the 20 most recent, **When** Statistics opens, **Then** nothing changes.
4. **Given** colour-blind viewing, **When** any chart is read, **Then** nothing is carried by colour alone.

---

### User Story 4 - The Diagnostic (Priority: P2)

A new or returning learner can take a 90-second mixed-text check, or skip it. It either leaves a beginner
at the start of Stage 1 or opens keys ahead for someone who already touch-types, and it seeds their
initial confidence. It never closes a key.

**Independent Test**: take the Diagnostic twice with a scripted slow and a scripted fast input; the slow
run leaves the boundary, the fast run opens more keys, and skipping changes nothing.

**Acceptance Scenarios**:

1. **Given** onboarding, **When** the Diagnostic screen shows, **Then** a skip action is present and
   skipping leaves progress untouched.
2. **Given** a completed Diagnostic, **When** scored, **Then** the unlocked boundary only moves forward.
3. **Given** a completed Diagnostic, **When** finished, **Then** per-key and per-transition confidence
   is seeded from it.
4. **Given** a learner who already chose a starting level, **When** the Diagnostic opens more keys,
   **Then** the larger boundary wins and no key closes.

---

### Edge Cases

- The Academy's first module needs an unlocked set the learner lacks: it is shown locked with the
  condition, never started empty.
- A module's exercise uses a key not yet unlocked: the build fails, not the learner.
- A weakest transition cannot be typed with unlocked keys: the next-weakest becomes the focus, stated
  in words (as in F3).
- Fewer than five observations of every transition: Review says nothing is judged yet and offers the
  weak-key picker.
- A learner takes the Diagnostic after attempts exist: attempts are untouched; only the boundary may move.

## Requirements *(mandatory)*

### Functional Requirements

**Academy**

- **FR-001**: Academy modules MUST be fixed content generated at build time from an authored module
  catalogue into `data/curriculum/`, ordered pairs → syllables/morphemes → words → phrases →
  sentences → text → tempo. [T12]
- **FR-002**: Academy selections (same-finger, rolls, alternation, doubled letters) MUST be queries over
  F3's n-gram tables, not separate tables. [T12]
- **FR-003**: A module MUST NEVER be mutated to adapt; adaptation comes only from the session warm-up
  injecting weak elements, because the three-attempt rule needs comparable attempts. [T12]
- **FR-004**: A module MUST complete when every exercise passes the three-attempt rule and module
  accuracy is at least 97%. [T10]
- **FR-005**: Speed MUST NEVER gate progression; it appears as the level benchmark only. [T10][A4]
- **FR-006**: Exercise sizes MUST be catalogue parameters: n-gram exercise about 150 characters,
  sentence or paragraph up to about 400, tempo series 30–60 seconds. [T12]
- **FR-007**: Phrases MUST be cut from the authored sentence corpus and reviewed; no cross-word
  frequency is claimed. Morpheme weights and examples MUST be computed from the filtered bank. [T12]
- **FR-008**: Paragraph-length text MUST be a static three-line block. [T20]
- **FR-009**: Academy error policy MUST be free Backspace with corrected errors still counted; tempo
  series MAY offer an error-free variant ending at the Nth error. [T10]
- **FR-010**: A tempo exercise MUST pace with a metronome and never treat it as a pass mark. [T10]
- **FR-011**: What opens Stage 3 and each module MUST be shown on Path with its condition. [T17]
  (gate: see Open decisions)

**Review and generation**

- **FR-012**: Review MUST rank weakest keys and transitions by Confidence, per key and per transition,
  and MUST NOT rank a transition with fewer than five observations. [T10][T09][F1 FR-035]
- **FR-013**: The adaptive generator MUST make the weakest element the focus, put it in every item,
  build through F3's `buildExercise`, and use only unlocked characters. [T10][T12]
- **FR-014**: Same-Finger Transitions MUST carry extra weight for Ukrainian. [T10][F1 FR-033]
- **FR-015**: While transition data is sparse, generation MUST fall back to the weak-key picker. [T09]
- **FR-016**: A confidence indicator MUST NOT be rendered during a Test Attempt. [T09][F1 FR-037]

**Next Action**

- **FR-017**: After every attempt the system MUST show exactly one Next Action, by strict priority: (1)
  accuracy below the floor, (2) the worst sampled transition, (3) uneven rhythm with good accuracy,
  (4) everything healthy. F4 MUST extend rules 3 and 4 to Stage 2 and Stage 3 (a tempo module; the next
  key or module) and MUST NOT rebuild the engine. [T10][F1 FR-031, FR-032]
- **FR-018**: Every recommendation MUST remain a template with substituted values. [T10][F1 FR-034]

**Visualisation**

- **FR-019**: Statistics MUST provide a keyboard heatmap, transition-latency bars and a progress line as
  hand-written SVG, with no chart library. [T11]
- **FR-020**: A rhythm and error visualisation MUST cover inter-keystroke intervals and errors by
  character across attempts. [Roadmap][F1 FR-026]
- **FR-021**: Every chart MUST have a text alternative and MUST NOT carry meaning by colour alone. [F1
  FR-066]
- **FR-022**: Visualisations MUST read Attempt Aggregates and so keep working when logs are pruned.
  [A5][F2 FR-018]

**Diagnostic**

- **FR-023**: The Diagnostic MUST be 90 seconds of mixed text, skippable, and MUST either leave a
  beginner at the start of Stage 1 or open keys forward; it MUST seed the initial confidence map. [T10]
- **FR-024**: It MUST only move the unlocked boundary forward and MUST never close a key. [T10][F1
  FR-073]
- **FR-025**: The Diagnostic MUST appear in onboarding as a skippable step. [T17][T09]

**Tests**

- **FR-026**: Tests MUST include: the Next Action is exactly one for any input (property); module
  completion needs both the three-attempt rule and the 97% floor; the generator never emits a locked
  character and always includes the focus; charts have text alternatives. [T15]

## Success Criteria *(mandatory)*

- **SC-001**: A module's exercise content is byte-identical on every start.
- **SC-002**: No sequence of fast but inaccurate attempts completes a module.
- **SC-003**: Generated exercises contain the focus in 100% of items and no locked character.
- **SC-004**: Exactly one Next Action is shown after every attempt of every stage.
- **SC-005**: Statistics renders identically before and after log pruning.
- **SC-006**: No Diagnostic outcome closes a key or discards an attempt.
- **SC-007**: Every F4 screen reports zero accessibility violations and is keyboard operable.

## Definition of Done *(restated from the constitution — test tasks are emitted only when asked)*

Constitution principle II applies to every story: domain logic test-first with property tests; an
end-to-end test per user-visible acceptance scenario on the production build; zero axe violations.
Working gates per [ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md): `pnpm typecheck`,
`pnpm lint`, `pnpm test`; Playwright on Chromium during work, in full at the end.

## Out of scope

Pace caret, forecast, daily goal, level-band ranks, error-free race variant ([T09]) · custom course
editor · new layouts · the dictionary pipeline (F3) · stored history and accounts (F2) · races (F5) ·
replay anti-cheat for training attempts.

## Dependencies

F2 (stored attempts and aggregates; `submit-attempt`), F3 (`buildExercise`, n-gram tables, authored
corpus, Word Bank), F1 (Confidence, Next Action engine, session, tempo scales).

[A4]: ../../docs/adr/0004-accuracy-first-metrics-and-gating.md
[A5]: ../../docs/adr/0005-append-only-attempts-as-source-of-truth.md
[Roadmap]: ../roadmap.md
[T09]: ../../.scratch/typing-race-hackathon/issues/09-requirements-beyond-tz.md
[T10]: ../../.scratch/typing-race-hackathon/issues/10-pedagogical-model.md
[T11]: ../../.scratch/typing-race-hackathon/issues/11-stack-and-architecture.md
[T12]: ../../.scratch/typing-race-hackathon/issues/12-dictionary-pipeline-and-exercise-generation.md
[T15]: ../../.scratch/typing-race-hackathon/issues/15-testing-strategy-and-cicd.md
[T17]: ../../.scratch/typing-race-hackathon/issues/17-screen-map-and-user-journeys.md
[T20]: ../../.scratch/typing-race-hackathon/issues/20-key-screen-mockups-and-motion-spec.md
[F1 FR-031]: ../001-typing-core/spec.md
[F2 FR-018]: ../002-accounts-and-progress/spec.md
