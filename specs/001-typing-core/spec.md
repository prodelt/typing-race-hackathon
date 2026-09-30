# Feature Specification: Typing Core

**Feature ID**: F1 · **Feature Directory**: `specs/001-typing-core`

**Feature Branch**: none at feature level — one branch per user story lane (Constitution VIII)

**Created**: 2026-09-30

**Status**: Draft

**Input**: F1 `001-typing-core` from `specs/roadmap.md` — the first vertical slice of the Typing-Race touch-typing trainer. A learner practises Stage 1 keyboard scales in Ukrainian (ЙЦУКЕН) and English (QWERTY), sees every metric the requirements demand, takes a zero-peek Test Attempt, masters an exercise, unlocks the next key, and finds all of it after a browser restart. No accounts, no word lists, no races. Binding inputs: the organizer requirements document §2, §3.1, §4.1–4.4, §6, §7, §8 (items 1, 2, 4, 5, 9, 10), §9 (steps 2, 3, 5, 6, 8); `CONTEXT.md` vocabulary; wayfinder tickets 10 (pedagogical model), 11 (stack), 15 (testing), 17 (screen map), 20 (key screens and motion); ADR-0003.

## Scope Boundary

**In F1.** The app shell and its six-item navigation; the "Serene Script" light theme plus the dark theme and the low-vision preset; the keyboard model and finger map for both layouts; the keystroke engine and its judging rules; SPM/CPM, WPM, accuracy, error counting, errors by character, inter-keystroke intervals and rhythm consistency; Confidence per key and per Transition; the Stage 1 Scale Catalogue covering all eight mandatory scale types in both languages; Practice Attempts and Zero-Peek Test Attempts; the Mastery Rule; the Unlock Order over Stage 1 keys and the Key Unlock card; the one Next Action; an explicit starting-level choice; the guided three-block session; local progress that survives a browser restart; practice that keeps working with the network away after the first page load; the public Formulas page; Settings.

**Not in F1.** Accounts and any server (F2). The Word Bank, Stage 2 and the dictionary pipeline (F3). The Academy, heatmaps, the Diagnostic and the adaptive generator (F4). Races and leaderboards (F5). Export/import, and the fourth session block — real text — which cannot exist without the word curriculum.

**F1 has no authentication.** There is no sign-in screen and no server; progress lives only in the browser. Constitution principle VII (mandatory sign-in) is waived for F1 alone: `Waived: VII — authentication arrives in F2` is recorded in `plan.md` and in every F1 PR body, and F1 is deployed to previews only, never to a public production URL. F2 replaces the local store with server-derived progress and puts every learning screen behind sign-in.

## Clarifications

### Session 2026-09-30

- Q: What advances a learner between the bands of the level table? → A: The level follows the stage, not the speed — the whole of Stage 1 sits at the Introduction level, whose accuracy floor is 95% and which sets no speed requirement. Leaving Stage 1 is its own rule (every scale complete plus 96% across the last five attempts), so no gain in speed ever raises the accuracy bar.
- Q: How much attempt history does F1 keep locally? → A: Attempt Aggregates for every attempt, kept indefinitely; the full Keystroke Event Log only for the 20 most recent attempts. This is the same rule ticket 21 fixed for the server, so F2 changes nothing about the shape.
- Q: Must F1's local progress survive the move to accounts in F2? → A: The local store carries an explicit version marker and a documented format, but F1 ships no migration code; F2 decides whether to import it. F1 is preview-only, so no learner has progress that could be lost.

## User Scenarios & Testing *(mandatory)*

Six stories over one Foundational phase. The Foundational phase carries every hot file plus the seams three or more stories read — the layout model, the Scale Catalogue, the metric formulas and the progress store — so that no story lane ever imports another lane's unmerged code.

### User Story 1 - Typing an exercise (Priority: P1)

A learner opens a Stage 1 scale, checks that their keyboard layout matches the exercise, and types it. Every character is judged as it is typed: correct characters settle into ink, a wrong key marks the awaited character in place without moving the text, and the caret does not advance until the right key arrives. In a Practice Attempt the on-screen keyboard, the next-key highlight and the finger diagram guide them; in a Test Attempt those guides are gone and only time, error count and progress remain.

**Why this priority**: it is the product. Without a keystroke path that judges Ukrainian and English correctly, nothing else in the feature has an input.

**Independent Test**: open a Stage 1 scale in each language, type it once with a deliberate wrong key and a Backspace correction, then type the same scale as a Test Attempt; the guides are rendered in the first and absent in the second, and both attempts reach completion.

**Acceptance Scenarios**:

1. **Given** a Stage 1 scale for the Ukrainian layout on the pre-start screen, **When** the learner starts the attempt and types the first character of the exercise, **Then** the attempt begins on that first printable character and the character is shown as correct.
2. **Given** an attempt in progress, **When** the learner presses a key other than the awaited character, **Then** the awaited character is marked in place with colour, a tint and an underline, the caret stays where it is, the error counter rises by one, and no character of the exercise text changes position.
3. **Given** an attempt whose last keystroke was wrong, **When** the learner presses Backspace and then the correct key, **Then** the mark clears, the caret advances, and the error counter does **not** decrease.
4. **Given** a Practice Attempt in progress, **When** the learner looks at the screen, **Then** the on-screen keyboard, the next-key highlight and the finger diagram are all present, and the awaited key is highlighted in its finger colour.
5. **Given** a Test Attempt in progress, **When** the learner looks at the screen, **Then** none of the four guides of FR-037 — on-screen keyboard, next-key highlight, finger diagram, live speed and accuracy readouts — exists in the page at all, while elapsed time, error count and progress remain visible.
6. **Given** an attempt in progress, **When** the learner presses Alt, an input-method key or a dead key, **Then** the attempt continues, no awaited character is consumed, and no error is counted.
7. **Given** an attempt in progress, **When** the learner presses Escape, **Then** the attempt pauses and the sentence naming the finger for the last error is shown; resuming does not restart the attempt.
8. **Given** the pre-start screen for a Ukrainian exercise while the operating system layout is English, **When** the learner types a probe character, **Then** the screen reports the mismatch and names the layout the exercise needs, and the attempt does not start. *(CDP-only — requires a simulated physical layout)*
9. **Given** any attempt in progress, **When** one keystroke is processed, **Then** nothing outside the typing line changes.
10. **Given** an exercise in either language, **When** the learner types `і`, `ї`, `є` or `ґ`, **Then** the character is judged as itself and is never substituted by another letter.

---

### User Story 2 - The result of an attempt and one next action (Priority: P1)

When the attempt ends the learner sees what happened: speed, accuracy, errors, time, which characters they missed, how even their rhythm was, and how this compares with their previous result on the same exercise. Under it is exactly one thing to do next, with a button that starts it. When the attempt was the one that completed the Mastery Rule, a card announces the newly unlocked key, its finger and its first drill.

**Why this priority**: the requirements score feedback and analytics directly, and an attempt with no verdict teaches nothing. It is the half of the loop User Story 1 does not cover.

**Independent Test**: finish one attempt from a seeded progress store and read the result screen; every metric in the requirements is present, exactly one Next Action is shown, and with a store seeded at the mastery threshold the Key Unlock card appears.

**Acceptance Scenarios**:

1. **Given** a completed attempt, **When** the result screen renders, **Then** it shows SPM/CPM, WPM, accuracy over all character keystrokes, the error count, elapsed time, errors by character, the average delay per key and per Transition, and rhythm consistency.
2. **Given** a completed attempt with a wrong keystroke that the learner corrected with Backspace, **When** the result screen renders, **Then** that keystroke is counted in the error total and in the accuracy denominator, and Backspace itself is not in the denominator.
3. **Given** a completed attempt on an exercise the learner has attempted before, **When** the result screen renders, **Then** it names the previous personal result on that exercise and the difference.
4. **Given** a completed attempt whose accuracy is below the level's floor, **When** the result screen renders, **Then** the single Next Action tells the learner to lower the tempo to a named speed until accuracy reaches the floor, and no other recommendation is shown.
5. **Given** a completed attempt at or above the floor whose worst Transition has enough samples, **When** the result screen renders, **Then** the single Next Action names that Transition and the two fingers that type it.
6. **Given** a completed attempt at or above the floor with even rhythm and no weak Transition, **When** the result screen renders, **Then** the single Next Action offers the next key or scale in the Unlock Order.
7. **Given** any completed attempt, **When** the result screen renders, **Then** exactly one Next Action is shown and it carries a button that starts that exercise.
8. **Given** the third consecutive Test Attempt at or above the floor on an exercise whose Focus Element is a locked key, **When** the result screen renders, **Then** a Key Unlock card shows the new key, the finger that types it and a button to its first drill.
9. **Given** a completed attempt with at least one inter-keystroke interval over 400 ms, **When** the rhythm chart renders, **Then** those intervals are drawn in the error colour and the chart is readable and described without relying on colour.

---

### User Story 3 - The path, mastery and progress that survives a restart (Priority: P1)

The learner sees where they are: which keys are unlocked, which scales are open, which are locked and what opens them. Three consecutive Test Attempts at or above the accuracy floor complete an exercise; when the exercise's Focus Element is the next key in the Unlock Order, that key unlocks. Today greets them with the one Next Action. Closing the browser and coming back leaves all of it exactly as it was.

**Why this priority**: it is the pedagogical spine — progression and persistence are both mandatory requirements and both demo steps.

**Independent Test**: from an empty store, choose a starting level, complete three consecutive passing Test Attempts on the scale focused on the next locked key, watch the key unlock and the Path update, then restart the browser with the network away and confirm the unlocked set, the attempt history and the Next Action are unchanged and still usable.

**Acceptance Scenarios**:

1. **Given** a learner with no history, **When** they open Path, **Then** the Stage 1 scales for the first keys of the Unlock Order are open, later scales are shown as locked with the condition that opens them, and Stage 2 and the Academy are shown as arriving in a later feature.
2. **Given** an exercise with two consecutive passing Test Attempts recorded, **When** a third passing Test Attempt completes, **Then** the exercise is marked complete and the Mastery Rule is satisfied.
3. **Given** an exercise with two consecutive passing Test Attempts recorded, **When** an attempt below the accuracy floor completes, **Then** the consecutive count resets to zero.
4. **Given** an attempt whose speed is below every level benchmark but whose accuracy is at or above the floor, **When** it completes, **Then** it counts toward the Mastery Rule; speed never blocks progression.
5. **Given** a Practice Attempt at or above the floor, **When** it completes, **Then** it does **not** count toward the Mastery Rule, and "Take the test attempt" becomes the primary action.
6. **Given** the Mastery Rule satisfied on the exercise focused on the next locked key, **When** progress is recomputed, **Then** exactly that key joins the unlocked set, the unlocked set remains a prefix of the Unlock Order, and the scales it opens become available.
7. **Given** a learner with attempts recorded, **When** they close the browser and reopen the app, **Then** the unlocked set, the per-exercise consecutive counts, Confidence per key and per Transition, and the attempt history are all restored, and Today shows the same Next Action.
8. **Given** a learner on Today, **When** the screen renders, **Then** it shows exactly one Next Action with a button that starts it, together with the current stage and the unlocked key count.
9. **Given** every Stage 1 scale complete and accuracy over the last five attempts at or above 96%, **When** progress is recomputed, **Then** Stage 1 is reported complete.
10. **Given** a learner opening the app for the first time, **When** the starting-level choice appears, **Then** three options are offered, and choosing the third opens more keys than choosing the first, while neither closes a key.
11. **Given** a learner who has loaded the app once, **When** the network becomes unavailable and they open the app again, **Then** they can start an unlocked Stage 1 exercise, complete it, and read its result.

---

### User Story 4 - The public Formulas page (Priority: P2)

Anyone — including a juror with no learner state — can open one page and read exactly how every number in the product is computed: the speed and accuracy formulas, what counts as an error, the level table, how Confidence is judged, and the two possible readings of the row-change difficulty measure with a statement of which one this product uses.

**Why this priority**: it is a mandatory demo step and the cheapest way to make the metrics auditable, but nothing else depends on it.

**Independent Test**: open the Formulas route with no stored progress and confirm every formula the product uses is stated there, including the row-change divergence.

**Acceptance Scenarios**:

1. **Given** a visitor with no progress stored, **When** they open the Formulas page, **Then** it renders fully without any learner state.
2. **Given** the Formulas page, **When** a reader looks for the speed metric, **Then** SPM/CPM is stated as a formula, WPM is stated as `SPM / 5`, and WPM is labelled the secondary metric.
3. **Given** the Formulas page, **When** a reader looks for accuracy, **Then** it is stated as correct character keystrokes divided by all character keystrokes, with an explicit note that a corrected error still counts and that Backspace is not in the denominator.
4. **Given** the Formulas page, **When** a reader looks for difficulty, **Then** both readings of the row-change measure are given — adjacent row-changing pairs, and distinct rows touched — with a statement that this product counts adjacent row-changing pairs and why.
5. **Given** the Formulas page, **When** a reader looks for progression, **Then** the level table with its speed benchmarks and accuracy floors, the Mastery Rule and the Stage 1 completion condition are all stated, and it is stated that speed never gates progression.
6. **Given** the Formulas page, **When** a reader looks for rhythm and confidence, **Then** inter-keystroke interval, rhythm consistency and Confidence are each defined.

---

### User Story 5 - Settings and accessibility presets (Priority: P2)

The learner shapes the workspace: which theme, how much motion, whether sound plays, how large the exercise text is, how errors behave, which language and layout they type in, and which language the interface speaks. Every choice takes effect at once and is still in force after a restart.

**Why this priority**: several of these are mandatory accessibility requirements, and the motion flag is what makes visual tests deterministic — but the learning loop works at defaults without any of them.

**Independent Test**: change every setting, confirm each takes effect immediately, reload, and confirm each is still in force.

**Acceptance Scenarios**:

1. **Given** Settings, **When** the learner chooses the theme, **Then** system, light, dark and the low-vision preset are all offered, light is the default, and the choice applies immediately.
2. **Given** Settings, **When** the learner chooses the motion setting, **Then** system, reduced and off are offered; with off, no animation plays anywhere and no sound plays; a system preference for reduced motion seeds the initial value.
3. **Given** default settings, **When** the learner starts an attempt, **Then** no sound plays, because sound is off by default.
4. **Given** Settings, **When** the learner sets the exercise text size, **Then** any value from 24 px to 40 px is selectable and the typing line changes size immediately.
5. **Given** Settings, **When** the learner changes the typing language or the layout, **Then** Path and the Scale Catalogue switch to that language and layout, and the change does not discard progress in the other language.
6. **Given** Settings, **When** the learner changes the interface language between Ukrainian and English, **Then** every interface string switches, and the exercise text is unaffected.
7. **Given** any setting changed, **When** the learner restarts the browser, **Then** the setting is still in force.
8. **Given** any screen in the feature, **When** the learner navigates with the keyboard alone, **Then** every action is reachable, focus is always visible, and no error is signalled by colour alone.

---

### User Story 6 - Running a guided session (Priority: P2)

Instead of picking exercises one at a time, the learner presses one button and is walked through a session: a warm-up on the Transitions that were weakest last time, then the target skill, then consolidation. Between blocks a short screen says what was just done and what comes next. The session states its expected length before it starts, and the block of real text is named as the thing that arrives with the word curriculum rather than faked with pseudo-words.

**Why this priority**: P2 orders the lane, not the obligation — the session is a mandatory requirement and ships inside F1. It is second because the whole learning loop already works one exercise at a time, so nothing else waits on it.

**Independent Test**: start a session from Today, run it to the end through all three blocks, and confirm the between-blocks screen appears twice, the expected length was stated up front, and abandoning mid-block keeps the attempts already recorded.

**Acceptance Scenarios**:

1. **Given** a learner on Today, **When** they start a session, **Then** the expected length is stated before the first block begins, and it falls between 15 and 25 minutes at their current speed.
2. **Given** a session with a previous session recorded, **When** the warm-up block begins, **Then** its exercises are built around the weakest Transitions of that previous session.
3. **Given** a learner with no previous session, **When** the warm-up block begins, **Then** it falls back to the current target skill rather than failing or being skipped silently.
4. **Given** a block just completed, **When** the between-blocks screen renders, **Then** it names the block just finished and the block coming next.
5. **Given** a session in progress, **When** the learner leaves it after completing one attempt, **Then** that attempt is kept with everything it implies for progress, and the session can be resumed or abandoned deliberately.
6. **Given** a session reaching the point where real text would come, **When** the screen renders, **Then** it names real text as arriving with the word curriculum, and offers no pseudo-word substitute.
7. **Given** a learner on Path, **When** they pick any unlocked exercise, **Then** it starts on its own, outside any session.

---

### Edge Cases

- A wrong key pressed on the very first character of an exercise: the attempt has already begun, the error counts, and accuracy is computed over a denominator of one.
- Backspace at the start of the exercise, with nothing to delete: ignored, and not counted in any denominator.
- Backspace held down across a whole exercise: each deletion is recorded in the Keystroke Event Log, none enters the accuracy denominator, and the engine never walks behind the first character.
- A key that produces two characters, or a composition event that replaces several characters at once: the engine judges the resulting characters in order, never silently skipping one.
- A dead key followed by a base letter, producing one composed character: one character is judged, not two.
- An apostrophe typed as U+2019 where the exercise stores U+0027, or the reverse: both fold together and the character is judged correct.
- The learner switches the operating system layout mid-attempt: the next keystroke fails the exercise's character set, and the attempt pauses with a layout warning rather than accumulating errors.
- The browser tab loses focus mid-attempt: the timer is not credited for the time away, and the attempt is resumable.
- An attempt abandoned without finishing: it produces no Attempt, no metrics and no effect on the Mastery Rule.
- Local data cannot be kept — storage full, disabled, or cleared between visits: the learner is told plainly that progress cannot be kept, and the learning loop still runs for the current visit.
- Two tabs of the app open at once: progress written in one is not silently overwritten by the other with stale state.
- An exercise whose Focus Element is a key the learner has already unlocked: the Mastery Rule still applies, but nothing new unlocks.
- A Transition with too few samples to judge: it is never named as the Next Action, and the recommendation falls through to the next priority.
- A window narrower than 1024 px: the learner is told the target platform is a computer with a physical keyboard rather than shown a broken typing line.
- Clock or time-zone changes between sessions: the ordering of attempts remains stable.
- A session started and abandoned repeatedly without finishing a block: no session state accumulates that blocks starting a fresh one.
- The learner changes the starting level after recording attempts: no recorded attempt is discarded, and no already-unlocked key closes.
- The network returns mid-attempt while the app is running from cache: nothing about the attempt changes, because F1 has no server to reach.
- The twenty-first attempt completes: the oldest Keystroke Event Log is discarded, while that attempt's Aggregates, its place in the history and every derived number stay untouched.
- The learner opens an exercise whose Keystroke Event Log has already been discarded: the attempt's metrics are still shown from its Aggregates, and the parts that need the raw log say plainly that the detail is no longer kept.

## Requirements *(mandatory)*

### Functional Requirements

**Keyboard model and finger map**

- **FR-001**: The system MUST model both keyboard layouts — Ukrainian ЙЦУКЕН and English QWERTY — with their home rows (`ФІВА ОЛДЖ` and `ASDF JKL;`) and the tactile reference pair.
- **FR-002**: Every supported key in each layout MUST have exactly one finger assignment, and this MUST hold for letters, the space bar, Shift, the digits, the apostrophe, the hyphen, the `ґ` key and the punctuation the Scale Catalogue uses.
- **FR-003**: The finger map MUST be verifiable as a complete table on its own, independently of typing behaviour, and correctable without changing how typing is judged.
- **FR-004**: The space bar MUST be assigned to the thumbs, and Shift MUST be assigned to the pinky of the hand opposite the target character, which the system MUST be able to check for any shifted character.
- **FR-005**: The system MUST classify each Transition by the fingers and rows involved, and MUST identify Same-Finger Transitions.
- **FR-006**: The system MUST never substitute the Ukrainian characters `і`, `ї`, `є` or `ґ` with any other character, in exercise text, in judging or in any metric.
- **FR-007**: The apostrophe MUST be stored as U+0027, displayed as U+2019, and both MUST fold together when judging input.

**Stage 1 content**

- **FR-008**: The Scale Catalogue MUST cover all eight mandatory Stage 1 scale types in both languages: left-to-right and right-to-left runs along the home row; mirror pairs from the edges to the centre and back; alternating hands; isolation of the same-named finger on both hands; vertical home-to-top and home-to-bottom row transitions; one finger across the keys assigned to it; the space bar, Shift, digits and punctuation as separate movements; and an even-rhythm drill with a changing tempo.
- **FR-009**: Each scale's text MUST be generated from the layout's finger map rather than hand-written, so that the same scale type produces the correct text in both layouts.
- **FR-010**: Each scale MUST declare, and the learner MUST be able to read, the one goal it serves — the key, the finger, the Transition or the tempo it trains.
- **FR-011**: Every scale MUST carry authored metadata: its type, the fingers it exercises, its size and its target tempo.
- **FR-012**: Scale text MUST contain only characters in the learner's unlocked set plus the characters the scale itself introduces as its Focus Element.
- **FR-013**: F1 MUST NOT draw exercise text from any dictionary or word list; Stage 1 content is authored and generated only.

**The keystroke path and judging**

- **FR-014**: An attempt MUST begin on the first printable character the learner types, or on an explicit start action.
- **FR-015**: The system MUST judge each typed character against the awaited character and MUST distinguish, visibly, the already-typed text, the awaited character and the upcoming text.
- **FR-016**: A wrong keystroke MUST never silently become the correct character; it MUST be marked, and the mark MUST appear on the awaited character in place, changing no character's position.
- **FR-017**: With the stop-on-letter error mode, the caret MUST NOT advance past a wrong keystroke until the awaited character is typed.
- **FR-018**: The system MUST support Backspace and MUST support the stop-on-letter error mode, and the error mode MUST be a setting.
- **FR-019**: Every keystroke MUST be recorded in an append-only Keystroke Event Log with a timestamp precise enough to measure inter-keystroke intervals, and every metric MUST be derived from that log rather than accumulated as the learner types.
- **FR-020**: Accidental modifier presses, input-method events and dead keys MUST NOT end the attempt, consume an awaited character or count as an error.
- **FR-021**: Before an attempt starts, the system MUST verify that the active keyboard layout can produce the exercise's characters, and MUST name the required layout when it cannot.
- **FR-022**: The system MUST expose a pause that names the finger responsible for the last error, and MUST NOT show that sentence inline while the attempt runs.

**Metrics**

- **FR-023**: After every attempt the system MUST report SPM/CPM as the primary speed metric, and WPM as a secondary metric computed as `SPM / 5` with the formula stated.
- **FR-024**: A **character keystroke** is a keystroke that offers a character against the awaited position — correct or not. Backspace is not one; neither is a modifier press, an input-method event or a dead key. Accuracy MUST be correct character keystrokes divided by all character keystrokes. A wrong keystroke MUST remain in both the error total and the denominator even after the learner corrects it with Backspace, and Backspace itself MUST NOT enter the denominator.
- **FR-025**: The system MUST report the error count, the elapsed time and the errors broken down by character.
- **FR-026**: The system MUST report the average delay per key and per Transition, and the unevenness of rhythm.
- **FR-027**: The system MUST compare the attempt with the learner's previous best result on the same exercise.
- **FR-028**: The system MUST compute, for every attempt, Attempt Aggregates per key and per Transition — counts, misses and timing — and MUST derive progress and Confidence only from those aggregates.
- **FR-029**: Confidence MUST be tracked per key **and** per Transition, from recent timing and miss rate.
- **FR-080**: The level a learner is held to MUST follow the stage rather than their speed: every Stage 1 exercise MUST be judged against the Introduction level's accuracy floor of 95%, which sets no speed requirement, and no gain in speed may raise the accuracy floor.
- **FR-030**: The level table — its speed benchmarks and accuracy floors — MUST be changeable without changing any behaviour that reads it, and the values in force MUST be the ones the Formulas page publishes.

**Feedback**

- **FR-031**: After every attempt the system MUST present exactly one Next Action, with a button that starts it.
- **FR-032**: The Next Action MUST be chosen by strict priority, first match wins: accuracy below the level floor, then the Transition with enough samples and the worst timing deviation, then uneven rhythm with acceptable accuracy, then the next key or scale.
- **FR-033**: Same-Finger Transitions MUST carry extra weight for Ukrainian relative to English, because the Ukrainian layout produces far more of them.
- **FR-034**: Every recommendation MUST be a template with substituted values, so that the exact sentence for given inputs is verifiable.
- **FR-035**: A Transition with fewer than **five** recorded observations MUST NOT be named as the Next Action, and the recommendation MUST fall through to the next priority instead.

**Test attempts, mastery and unlocking**

- **FR-036**: The learner MUST choose between a Practice Attempt and a Test Attempt, and once a Practice Attempt clears the accuracy floor, the Test Attempt MUST become the primary action.
- **FR-037**: In a Test Attempt **four** things MUST NOT be rendered at all — not merely hidden from view: (1) the on-screen keyboard, (2) the next-key highlight, (3) the finger diagram, (4) the live speed and accuracy readouts. Elapsed time, error count and progress MUST remain visible, because errors are feedback and not a secret.
- **FR-038**: The system MUST NOT claim to verify that the learner did not look at the keyboard, and MUST NOT require a camera, microphone or any biometric input.
- **FR-039**: The Mastery Rule MUST be three consecutive Test Attempts at or above the level's accuracy floor; a failing attempt resets the count; a Practice Attempt never counts.
- **FR-040**: Speed MUST NEVER gate progression. No exercise, key or stage may be withheld because the learner is slow.
- **FR-041**: A key MUST unlock when the Mastery Rule is satisfied on an exercise whose Focus Element is that key, following the Unlock Order for the active layout.
- **FR-042**: The unlocked set MUST always be a prefix of the Unlock Order.
- **FR-084**: The eight home-row anchors and the space bar MUST be available from the first exercise and MUST NOT appear in the Unlock Order, because the first mandatory scale type is the home-row run and it needs all eight at once. Unlocking therefore begins at the ninth key.
- **FR-043**: The Key Unlock MUST be announced on the result screen as a card naming the new key, its finger and its first drill — not as a separate full-screen moment.
- **FR-044**: Stage 1 MUST be reported complete when every scale is complete and accuracy across the last five attempts is at or above 96%.
- **FR-045**: The learner MUST be able to repeat any unlocked exercise at any time.
- **FR-046**: Each exercise MUST be built around a Focus Element — the weakest key or Transition it targets — and that element MUST appear in every item of the exercise.
- **FR-047**: The system MUST offer a way to practise the learner's weak keys and Transitions specifically.
- **FR-048**: On first run a new learner MUST be offered an explicit starting-level choice of three options — never having typed without looking, knowing the home row, already touch-typing and wanting accuracy — and no diagnostic run is required in F1.
- **FR-073**: The starting-level choice MUST only move the boundary of the unlocked set forward, never backward, and the learner MUST be able to change it later without losing recorded attempts.

**Progress and persistence**

- **FR-049**: Progress MUST be kept locally and MUST survive a page reload and a browser restart: the unlocked set, per-exercise consecutive counts, Confidence per key and per Transition, settings and the attempt history.
- **FR-050**: Progress MUST be derived by folding the learner's Attempt Aggregates in completion order, so that the same history always yields the same progress.
- **FR-051**: Progress MUST be kept separately per typing language, so that work in one language is not lost by switching to the other.
- **FR-052**: When the browser cannot keep local data — storage disabled, full, or cleared — the system MUST say so plainly and MUST still allow the current visit's practice to run.
- **FR-053**: The system MUST NOT collect personal data, MUST NOT send learner data anywhere, and MUST NOT load any third-party analytics.
- **FR-081**: Attempt Aggregates MUST be kept for every attempt indefinitely. The full Keystroke Event Log MUST be kept only for the 20 most recent attempts; discarding an older log MUST NOT change progress, Confidence, the attempt history or any metric already reported.
- **FR-082**: The local store MUST carry an explicit version marker and MUST have a documented format, so that a later feature can decide whether to import it. F1 itself MUST NOT contain migration code.
- **FR-083**: A stored version marker the running application does not recognise MUST NOT be read as if it were current; the learner MUST be told and offered a deliberate fresh start.
- **FR-074**: After one successful page load, the learner MUST be able to open the app, run any unlocked Stage 1 exercise, record the attempt and read its result with the network unavailable, and the documentation MUST state anything that still needs the network.

**Screens and shell**

- **FR-054**: The feature MUST provide these reachable screens: a product page, the Formulas page, Today, Path for Stage 1, exercise pre-start, the typing screen in practice and test modes, the result with its Key Unlock card, and Settings.
- **FR-055**: The primary navigation MUST carry all six destinations, with those outside F1 visibly present and disabled rather than removed.
- **FR-056**: A keyboard-first command palette MUST be reachable from every screen.
- **FR-057**: During an attempt the navigation MUST remain present but dimmed, and MUST say that it is muted until the attempt ends.
- **FR-058**: The typing surface for a scale MUST be one line that scrolls, and the typing line MUST keep the same vertical position across exercise types.
- **FR-059**: Live metrics MUST sit beside the typing line, never above or below it, and MUST hold the values of the last completed exercise for the duration of an attempt rather than updating live.
- **FR-060**: The on-screen keyboard guide MUST fade as Confidence grows, across tiers, and the letter on each key MUST stay full-contrast ink in every tier, so that the tier is never the only carrier of legibility.
- **FR-061**: Finger colours MUST be used consistently on the keyboard guide and the finger diagram, and colour MUST never be the only carrier of a finger's identity.
- **FR-075**: The learner MUST be able to run a session as a guided sequence of three blocks — a warm-up on the weak Transitions of the previous session, the target skill, and consolidation — with a short screen between blocks that says what was just done and what comes next.
- **FR-076**: The session MUST name its fourth block, real text, as arriving with the word curriculum, and MUST NOT put a pseudo-word substitute in its place.
- **FR-077**: A session's blocks MUST be sized so that a full run takes between 15 and 25 minutes at the learner's current speed, and the expected length MUST be stated before the session starts.
- **FR-078**: A session MUST be resumable and abandonable: leaving mid-block MUST NOT invalidate attempts already recorded, and MUST NOT leave the learner without a way back into the sequence.
- **FR-079**: Any unlocked exercise MUST remain startable on its own from Path, outside any session.

**Presentation, accessibility and performance**

- **FR-062**: The light theme MUST be the default; a dark theme and a low-vision preset MUST also be available, the low-vision preset being a full theme rather than a scaling of the light one.
- **FR-063**: The exercise text size MUST be adjustable to at least 40 px and no less than 24 px.
- **FR-064**: A single application-level setting MUST turn off every animation and every sound, and MUST be seeded by the operating system's reduced-motion preference.
- **FR-065**: Motion MUST follow the rule "expressive frame, calm text": inside the typing line only the caret and the judged character may animate, and shake or nudge of the text is forbidden.
- **FR-066**: Every action MUST be operable from the keyboard alone, focus MUST always be visible, and no error MUST be signalled by colour alone.
- **FR-067**: The interface MUST work correctly from 1024 px wide, and MUST state that the target platform is a computer with a physical keyboard.
- **FR-068**: The interface MUST be available in Ukrainian and in English, switchable by the learner and independent of the typing language.
- **FR-069**: Between two consecutive keystrokes, nothing outside the typing line may change — not a number, not a highlight, not a position.
- **FR-070**: The time from a keystroke to the paint that shows it MUST be at most 16 ms at the 95th percentile, measured over at least 200 consecutive keystrokes driven through the normal input path, on a browser with frame-rate limiting disabled, by an instrument that cannot report a value lower than the true one.
- **FR-071**: The application MUST run after a page reload without losing local progress, and MUST start from a single documented command.
- **FR-085**: Every font, icon and asset the interface needs MUST be served from the application's own origin. No third-party origin may be contacted at runtime, which follows from FR-053 and FR-074 together: a hosted font is both a third party and a network dependency.
- **FR-072**: The repository MUST contain no secret of any kind, and MUST ship an example environment file if environment variables are needed.

### Key Entities

- **Layout**: a keyboard layout — its keys, rows, home row, and the finger assigned to each key. Two instances in F1: ЙЦУКЕН and QWERTY.
- **Key**: one physical key in a Layout, with its row, its hand, its finger and the characters it produces unshifted and shifted.
- **Transition**: the movement from one Key to the next, carrying the two fingers, the two rows and whether it is a Same-Finger Transition.
- **Scale**: one Stage 1 exercise — its type, its Focus Element, the fingers it exercises, its size, its target tempo, its generated text and the stated goal it serves.
- **Scale Catalogue**: the authored set of Scales for a Layout, ordered against the Unlock Order.
- **Unlock Order**: the fixed per-Layout sequence in which Keys unlock. A learner's unlocked set is always a prefix of it.
- **Attempt**: one run of one Scale — its mode (Practice or Test), its Keystroke Event Log, its metrics, its Attempt Aggregates and when it completed.
- **Keystroke Event Log**: the append-only timestamped record of every keystroke of an Attempt, including wrong keystrokes and Backspaces; every metric derives from it.
- **Attempt Aggregates**: the per-Key and per-Transition summary of one Attempt — counts, misses and timing — kept as the only input to progress and Confidence.
- **Confidence**: how reliably the learner types a given Key or Transition, from recent timing and miss rate.
- **Progress**: the fold of a learner's Attempt Aggregates in completion order — the unlocked set, per-Scale consecutive passing counts, Confidence maps, stage state and the attempt history. Aggregates are kept indefinitely; Keystroke Event Logs are kept only for the 20 most recent attempts. The stored form carries a version marker.
- **Level**: a band of the level table — its speed benchmark, its accuracy floor and its main goal. Configurable data.
- **Next Action**: the single recommendation shown on Today and on every result, as a template plus the values substituted into it.
- **Settings**: the learner's theme, motion, sound, text size, error mode, typing language, layout and interface language.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can go from opening the app to a completed Stage 1 attempt with a result and a next action in under two minutes, without instruction.
- **SC-002**: For 95% of keystrokes, the character appears on screen within 16 ms of the key being pressed.
- **SC-003**: Every one of the eight mandatory Stage 1 scale types is available in both Ukrainian and English, and each names the single goal it serves.
- **SC-004**: Every supported key in both layouts resolves to exactly one finger, verified as a complete table with no key unassigned and no key assigned twice.
- **SC-005**: The speed and accuracy formulas produce the documented values on a fixed set of worked examples, including examples with corrected errors.
- **SC-006**: A wrong keystroke corrected with Backspace still appears in the error total and in the accuracy denominator in 100% of cases.
- **SC-007**: In a Test Attempt, none of the four guides enumerated in FR-037 exists anywhere in the page.
- **SC-008**: After a browser restart, 100% of the learner's unlocked keys, consecutive counts, confidence data, attempt history and settings are unchanged.
- **SC-009**: Three consecutive passing Test Attempts unlock exactly one key, and no sequence of attempts, however fast, unlocks a key without them.
- **SC-010**: Exactly one Next Action is shown after every attempt — never zero, never two.
- **SC-011**: Every screen in the feature reports zero accessibility violations in an automated audit, and every action is reachable with the keyboard alone.
- **SC-012**: Between two consecutive keystrokes, zero elements outside the typing line change in any way.
- **SC-013**: The Formulas page states every formula the product uses, and a reader can reproduce any displayed metric from it by hand.
- **SC-014**: With motion turned off, repeated visual captures of the same screen are identical.
- **SC-015**: Ukrainian `і`, `ї`, `є` and `ґ` survive every path — exercise text, judging, metrics and stored progress — with no substitution, in 100% of cases.
- **SC-016**: A new learner reaches their first exercise within three interactions of opening the app, having chosen their starting level explicitly.
- **SC-017**: With the network disconnected after one successful load, a learner completes an unlocked Stage 1 exercise and reads its result in 100% of attempts.
- **SC-018**: A full guided session of three blocks completes within 15 to 25 minutes at the learner's measured speed.
- **SC-019**: Discarding keystroke logs beyond the 20 most recent changes no reported metric, no confidence value and no unlocked key — zero differences.

## Definition of Done *(mandatory — restated from the constitution, because test tasks are emitted only when asked)*

Every user story in this specification is subject to all of the following, from `.specify/memory/constitution.md` principle II.

1. **Domain logic is developed test-first** — Red-Green-Refactor — and carries property-based tests alongside example tests. This covers the metric formulas, error counting, the keystroke state machine, Confidence per key and per Transition, the Mastery Rule and the unlock rules.
2. **Every user-visible acceptance scenario above is covered by an end-to-end test** run against the production build, named after the story's Independent Test line in `tasks.md`.
3. **The end-to-end matrix is Chromium, Firefox and WebKit**, except scenarios tagged CDP-only, which simulate a physical keyboard layout through the Chrome DevTools Protocol and therefore run in Chromium alone. Scenario 8 of User Story 1 is the only CDP-only scenario in this specification.
4. **Cyrillic input is driven through the browser's text-input events, not the keyboard API**, because the keyboard API cannot type Cyrillic.
5. **Accessibility audits report zero violations**, and visual comparisons run with motion turned off.
6. **Continuous integration is green**: type checking, linting, unit tests, end-to-end tests, the production build and a secret scan. F1 ships no dictionary data, so the checksum verification job is present but has nothing to verify.
7. **Keystroke-to-paint latency is enforced in continuous integration** by its own end-to-end project with frame-rate limiting disabled; a regression fails the build.
8. Additionally, these checks from the requirements document are mandatory and testable: the speed and accuracy formulas verified on fixed examples; a corrected error still counted in the error statistics; every supported key holding exactly one finger assignment; `і`, `ї`, `є` and `ґ` never substituted; and unlocked exercises and personal results surviving a reload.

## Assumptions

- **Story structure.** Six user stories over one Foundational phase. The Foundational phase owns every hot file and, in addition, the seams that three or more stories read: the Layout model and finger map, the Scale Catalogue, the metric formulas and Attempt Aggregates, and the progress store with an in-memory adapter. Without that, story lanes would have to import each other's unmerged code, which Constitution VIII forbids. This refines the six-story shape proposed at the gate: Practice Attempt and Test Attempt were merged into User Story 1, because zero-peek is a rendering condition of one screen rather than a second screen, and persistence was merged into User Story 3, because the unlocked set and the thing that restores it are the same state. The guided session became User Story 6 at the clarification gate; the service worker that makes offline practice work belongs to the Foundational phase, because it caches the shell every story renders.
- **Cross-story independence.** User Story 2 renders the Key Unlock card from progress data the Foundational store exposes; the rule that sets it belongs to User Story 3. Each is independently testable against a seeded store, so neither lane imports the other.
- **F1 is preview-only.** Because principle VII is waived, F1 is never deployed to a public production URL. The publicly reachable demo arrives with F2.
- **Level floors.** The accuracy floors are taken from the requirements level table (95% / 96% / 97% / 97% / 98%), and the level is configurable data. In F1 only the Introduction band is ever in force, because the level follows the stage (FR-080), so the Mastery Rule's threshold in F1 is a single value: 95%. The later bands exist in the data and on the Formulas page so that F3 and F4 inherit them rather than invent them.
- **Weak-element re-injection.** The Focus Element appears in every item of an exercise. How often a mastered-but-weak element is re-injected — every session's warm-up versus a scheduled re-test — is left to the plan, as ticket 10 recorded.
- **Two tabs.** Concurrent tabs are a recognised edge case; the plan chooses the resolution rule, and the requirement is only that stale state must not silently win.
- **Confidence tiers.** The tier thresholds for the fading keyboard guide come from ticket 20; they are presentation data, and the plan may keep them in the token layer.
- **Organizer material.** The requirements document lives outside the repository and is never committed. This specification paraphrases its obligations; it quotes nothing.

## Dependencies

- Nothing. F1 is the first feature and depends on no other. F2, F3, F4 and F5 all depend on it.
- External: none at runtime. There is no server, no account and no third-party service in F1.
