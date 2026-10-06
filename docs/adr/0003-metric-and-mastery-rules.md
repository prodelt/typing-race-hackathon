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

**Amended 2026-10-06:** a jury-style audit found two holes, and both rules changed.

- **SPM counts text, not keystrokes.** SPM = 60 000 × `min(correct character keystrokes, text
  length)` ÷ elapsed ms, which on a finished attempt is `60 · N / T`. It used to count every
  character keystroke, so each wrong key added speed: 7 errors on a 59-character line read 12 %
  above `60 · N / T`, outside the jury's ±10 % (COMPETITION_RULES §6.1). A wrong key now costs
  accuracy and the time it took, never more. Accuracy is unchanged (correct ÷ all, corrections
  included). This is Monkeytype's split: its WPM counts correct characters, its "raw" all typed.
- **Typing no hand produces counts toward nothing.** One `insertText` with the whole line gave
  «Вправу опановано» at 9 949 SPM, and an automation tool's 4 264 SPM became the personal best. Two
  layers now:
  - the input seam takes an `insertText` of more than one character as `ignored` (reason `burst`),
    like a paste: one key makes one character. An input method commits through `compositionend`,
    which is still judged character by character;
  - `packages/metrics` gives every attempt a verdict, `metrics.implausible`: `burst` when the median
    interval between character keystrokes is under **25 ms**, `tooFast` when SPM is over **1 500**.
    Intervals run from character to character, so a held Shift's or Backspace's repeats do not
    shorten them. The median catches a whole-line composition or an instant event series even when
    a wait before it makes the overall speed look human; the ceiling catches a steady script.
- **Why these numbers.** Generous on purpose, since telling a learner their typing is not theirs
  costs more than one inflated number. Barbara Blackburn's record peak is about 1 060 SPM;
  Klavogonki's top rank starts at 800 and it treats above 1 500 зн/хв as certain cheating
  (docs/research/02-typing-trainers.md); 1 500 is also the race ceiling `finish-race` already used.
  A 25 ms median is a sustained 2 400 SPM; a record typist's median sits near 50 ms, while bursts and
  scripts land at 0–15 ms (the audit's tool: 14 ms).
- **What "counts toward nothing" means.** The attempt is kept, shown on its result screen as «Не
  зараховано: набір не схожий на ручний», and listed in the profile. It is left out of the progress
  fold (history, Confidence, the Mastery Rule — it neither advances nor resets a streak), Academy
  progress, XP and Level, the Streak and daily minutes, the personal best and speed trend, and
  session sizing. `finish-race` reads the same verdict, so a race finish that is not a hand's is not
  validated. `curriculum`'s `typedByHand` is the one predicate; `DERIVED_VERSION` is 2. An attempt
  stored before the rule carries no verdict and counts.
- **No test escape.** The e2e harness types at 45 ms a key (about 1 300 SPM), and the CDP harness
  waits the same by default, rather than the product growing a flag that switches the rule off.
- `submit-attempt` keeps its own older, stricter checks (a quarter of intervals under 40 ms, or
  over 1 000 SPM, rejects the upload); it stores the new verdict with the recomputed metrics.
