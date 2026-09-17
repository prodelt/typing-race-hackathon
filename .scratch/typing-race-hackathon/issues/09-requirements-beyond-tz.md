# 09 Grilling: Functional requirements beyond the TZ

Type: grilling
Status: resolved
Blocked by: 02, 05

## Question

Which functional requirements beyond TZ §3–§10 enter the release, and which are explicitly ruled out?

Draw the candidates from the best-of list in the trainers teardown and weigh them against what the free tiers can carry. Examples:
- onboarding and diagnostic flow;
- streaks and achievements;
- stats history and personal bests;
- settings: font size ≥24px, theme, sound, motion;
- keyboard shortcuts / command palette;
- uk/en interface switch;
- result sharing;
- notifications.

Every accepted requirement gets a priority and acceptance criteria.

## Decisions — grilling round 1 (2026-09-17)

**In the release**
- Keystroke event log as the single source of truth, with attempt replay.
- Result plausibility checks: minimum duration, 40 ms–12 s interval window, CPM cap, rate limiting.
- AFK detection: pauses over N seconds excluded from speed and flagged on the attempt.
- Race progress computed by an authority from keystrokes, never from client-reported speed.
- Accuracy-weighted race and leaderboard score, with a minimum accuracy to be ranked.
- Per-key and per-transition confidence indicator on the lesson map, hidden during test attempts.
- Opposite-hand Shift enforcement in Shift drills.
- Weak-key word picker fallback while bigram data is sparse.
- Low-vision preset (large text, high contrast, motion and sound off).
- Built-in keystroke-to-paint latency probe.
- Public "Formulas" page beside "Sources and licences".

**Later, only once the mandatory set is green**
- Pace caret / ghost of personal best.
- "≈ N sessions to target" forecast, shown only when the regression fit is good.
- Daily practice goal.
- Ranks named after the TZ level bands.
- Error-free race variant.

**Out**
- Image/canvas verification challenge for suspicious records: it costs accessibility and this is an internal hackathon.

Still open in this ticket: onboarding, stats history, the settings set, command palette, result sharing, UI language switch.

## Answer

## Decisions — grilling round 2 (2026-09-17)

**In:** a 3-screen onboarding leading into the diagnostic; a results-history page with a per-day chart; a keyboard-first command palette; a uk/en interface switch; settings for theme (system / light / dark), motion (system / reduced / off), sound (off by default), exercise text size 24–40 px, and error mode.

**Out:** sharing results to social networks — the hackathon is internal.

Resolved 2026-09-17. Together with the round-1 buckets above, this settles the beyond-TZ scope.
