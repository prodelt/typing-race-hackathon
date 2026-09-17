# 10 Grilling: Pedagogical model

Type: grilling
Status: resolved
Blocked by: 02

## Question

How does a learner move from the home row to fast text?

Decide:
- **Error modes:** practice vs zero-peek test attempt, stop-on-error, Backspace.
- **Mastery rule:** the TZ recommends three successful attempts in a row. Also the configurable thresholds per level (TZ §4.3 table).
- **Key unlock order** for ЙЦУКЕН and QWERTY.
- **Initial diagnostic** or level choice.
- **Stage gates:** Stage 1 → 2 → 3, and Academy module completion criteria.
- **15–25 minute session structure:** warm-up, one target skill, consolidation, real text.
- **Weak keys and transitions:** the review model.
- **The single next-action recommendation:** its rules.

Inputs:
- the trainers teardown;
- `archive/2026-09-03-map/05-pedagogy-error-mode-and-scoring.md`.

Resolves into:
- the outline of `docs/pedagogy.md`;
- glossary terms in `CONTEXT.md`.

Inputs from research 02:
- keybr's confidence model: confidence = time-at-target-speed ÷ EMA(time-to-type); a key unlocks at confidence ≥ 1 and the weakest key is forced into every generated word. Proposal: apply the same idea to *transitions*, which no competitor does.
- The accuracy denominator must be chosen and locked by tests: every keystroke (Monkeytype, and what the TZ wording implies) vs target characters (keybr) vs corrections (10FastFingers).
- Metrics should be pure functions over an append-only keystroke event log, which is what makes "corrected errors still count" provable.

Inputs from research 08:
- **ЙЦУКЕН has 18.58% same-finger transitions vs QWERTY 5.80%**, which strengthens the case for transition-based adaptation and for scales that drill same-finger moves.
- We must assign fingers to `ґ`, `-` and `'` ourselves: the TZ omits them in §2.1/§2.2 but §8.4 demands exactly one finger per supported key.
- We must define `rowChanges` ourselves: the TZ §5.3 example does not reproduce (adjacent pairs give 5, distinct rows touched gives 3).
- Apostrophe drills cannot come from frequency data (the uk lists have none), so the pedagogy must say where those words come from.

## Decisions — grilling round 1 (2026-09-17)

- **Accuracy:** correct character keystrokes ÷ all character keystrokes. Every wrong press counts permanently, even after Backspace; Backspace itself is not in the denominator. This is the literal TZ §4.3 reading and is locked by the §8.1–8.2 tests.
- **Error-mode ladder:**
  - Stage 1 scales: stop-on-letter — the caret does not advance, the error is shown and counted.
  - Stages 2–3: free Backspace, corrected errors still counted.
  - Tempo series and races: optional error-free variant that ends at the Nth error.
  - Test attempts: no next-key hint and no on-screen keyboard, but **errors stay visible** and colour is not their only carrier. Monkeytype's "blind mode" hides errors, which is *not* what the TZ means by zero-peek.
  - Per-exercise policy is configurable: free Backspace / stop-on-letter / no Backspace.
- **Mastery:** three consecutive attempts at or above the level's accuracy floor. Speed is advisory at the beginner level, never a gate.
- **Unlock order:** the TZ finger map (home row, then scales), not letter frequency.
- **Confidence model:** EMA of time plus miss rate per key **and per transition**; the weakest element becomes the focus and appears in every generated item. Transition-level adaptation is the differentiator no studied product has.

Still open in this ticket: finger assignment for `ґ`, `-`, `'`; the `rowChanges` definition; the source of apostrophe drill words; diagnostic and session structure; stage gates and Academy completion criteria; the recommendation engine's rules.

## Answer

## Decisions — grilling round 2 (2026-09-17)

- **Finger map completion** (TZ §2 omits these keys, §8.4 demands exactly one finger each). Defined **per layout**, stored in data rather than code, covered by the §8.4 test:
  - apostrophe — the key left of "1", where both Windows "Ukrainian (Enhanced)" and Linux xkb type U+0027: left pinky;
  - `ґ` — the backslash key: right pinky;
  - hyphen — top row right: right pinky;
  - digits — classic assignment, left pinky on "1" through right pinky on "0";
  - macOS positions for `ґ` and the apostrophe are verified before release and fixed in the data.
- **Apostrophe drill words:** an authored list of ~80–120 words and phrases, ours, under our licence, labelled as authored content in the data, each validated against Hunspell at build time. Frequency data cannot supply them: the uk lists contain no apostrophes at all.
- **Difficulty metrics:** `rowChanges` = the number of adjacent character pairs that change row, because that measures actual finger work. The TZ §5.3 example matches the other reading (distinct rows touched); our definition and the divergence are published on the Formulas page, as is `sameFingerTransitions`.
- **Diagnostic:** 90 seconds of mixed text, skippable. It either keeps a beginner at the start of Stage 1 or unlocks keys ahead for someone who already touch-types, and seeds the initial confidence map.
- **Session, 15–25 min:** 3 min warm-up on the previous session's weak transitions, 8–12 min on the target skill, 4 min consolidation, 3–5 min of real text.
- **Gates:**
  - a key unlocks after three consecutive passing attempts on an exercise where it is the focus;
  - Stage 1 is complete when all scales pass and accuracy over the last 5 attempts is at least 96%;
  - Stage 2 opens as soon as the first 8 keys are unlocked, without finishing Stage 1;
  - an Academy module is complete when every exercise passes the three-attempt rule and module accuracy is at least 97%;
  - speed never gates progression; it is shown as the level benchmark only.
- **Recommendation engine — one next action**, strict priority, first match wins:
  1. accuracy below the level floor: "lower the tempo to X SPM until accuracy reaches Y%";
  2. a transition with enough samples and the worst timing deviation: "repeat this transition with these fingers";
  3. uneven rhythm with good accuracy: a metronome tempo series;
  4. everything healthy: the next key or module.

  Same-finger transitions carry extra weight for Ukrainian, which has 18.58% of them versus QWERTY's 5.80%. Advice texts are templates with substitution so they can be unit-tested.

Resolved 2026-09-17. Residual detail for `speckit-clarify`: the re-injection cadence for weak elements — every session's warm-up versus a scheduled re-test every N lessons.
