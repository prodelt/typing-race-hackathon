# Metric and mastery rules

- Accuracy = correct character keystrokes ÷ all character keystrokes. A wrong keystroke counts forever,
  even after Backspace; Backspace is not in the denominator. This is the requirements' own wording.
- Speed never gates anything; it is shown as the level benchmark. Mastery is three consecutive test
  attempts at or above the level's accuracy floor.
- Zero-peek: a test attempt hides the keyboard guide and next-key highlight; practice shows both.
- One next action after every attempt — never two.
- Keys unlock in finger-map order, not letter frequency. Confidence is tracked per key and per
  transition; transitions weigh more for ЙЦУКЕН (18.6% same-finger transitions vs QWERTY's 5.8%).
- Apostrophe is stored as U+0027, displayed as U+2019, and both fold together on input.
- The formulas are published in the app. `rowChanges` counts adjacent row-changing pairs, which differs
  from the requirements' example, so the page states what we compute.
