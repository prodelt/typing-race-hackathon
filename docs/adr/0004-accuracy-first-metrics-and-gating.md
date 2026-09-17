---
status: accepted
---

# Accuracy-first metrics and gating

Accuracy is correct character keystrokes divided by all character keystrokes: every wrong press counts permanently even after Backspace, and Backspace itself is not in the denominator. Progression is gated on three consecutive attempts at or above the level's accuracy floor, and speed never gates anything — it is shown as the level benchmark only. Decided 2026-09-17.

## Considered options

keybr counts accuracy per target character and unlocks on speed; 10FastFingers counts corrections. Both were rejected: the TZ §4.3 wording is "точність за всіма натисканнями, включно з виправленими помилками", and §11 disqualifies any design where speed can pass an exercise without accuracy.

## Consequences

- The metric is provable only because every attempt is an append-only keystroke event log and all metrics are pure functions over it. The TZ §8.1 and §8.2 checks are locked by fixtures over that log.
- Corrected errors stay in the error count everywhere, including races and the Academy.
- Unlocking follows the TZ finger map rather than letter frequency, so curriculum order is pedagogical, not statistical.
- Confidence is tracked per key and per transition; the weakest element becomes the exercise focus and appears in every generated item. Ukrainian ЙЦУКЕН has 18.58% same-finger transitions against QWERTY's 5.80%, so transitions carry extra weight there.
- `rowChanges` counts adjacent row-changing pairs, which does not reproduce the TZ §5.3 example (that matches "distinct rows touched"). Our definitions are published on an in-app Formulas page.
