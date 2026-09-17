# 05 Pedagogy, Error Handling Modes & Mastery Criteria

Type: grilling
Status: open
Blocked by: none

## Question

How should in-exercise typing errors and mastery progression be governed:

1. **Error Correction Modes**:
   - **Mode 1 (Mandatory Backspace / Stop on Error)**: User cannot proceed past a typo until it is corrected with Backspace. The error is permanently added to the session error counter. (Recommended for pedagogical stages and tests per Hackathon rule 144 & 299).
   - **Mode 2 (Confidence / Free-flow Mode)**: Typist can type ahead without stopping; errors turn terracotta and user can optionally Backspace.
   - **Mode 3 (Configurable per user preference)**: Allow choosing between Mode 1 and Mode 2 for practice, but enforce Mode 1 for official scoring and certification tests.

2. **Mastery & Progression Rule**:
   - **Rule A (3-Streak Rule)**: Hackathon recommended criterion: an exercise requires 3 consecutive passing attempts ($\ge 95\text{--}98\%$ accuracy) before the next key/exercise unlocks.
   - **Rule B (Single High-Score Pass)**: 1 successful attempt with $\ge 97\%$ accuracy unlocks the next step.
   - **Rule C (Streak with Spaced Repetition)**: 2 consecutive passes unlocks next step, but weak keys are re-injected automatically every 5 lessons.

## Options for Human Decision
- Mode 3 (Configurable practice, strict for tests) + Rule C or Rule A (Recommended)
