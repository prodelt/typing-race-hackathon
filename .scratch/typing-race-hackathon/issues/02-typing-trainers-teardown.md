# 02 Research: Leading typing trainers — mechanics, algorithms, UI/UX, code licenses

Type: research
Status: resolved
Blocked by: none

## Question

What do the leading typing trainers and typing-race sites actually do, down to the mechanics, and which of those practices should Typing-Race adopt to score maximally on the TZ criteria (pedagogy 30, reliability 20, dictionaries/algorithm 15, UX 15, analytics 10, quality 10) and bonuses?

- **Open source (read the code):** Monkeytype, keybr.com.
- **Closed (study behavior, docs, public talks):** TypeRacer, Nitro Type, Klavogonki, TypingClub, Ratatype, typing.com, 10FastFingers, plus trainers that support Ukrainian ЙЦУКЕН.

For each product, cover:
- key unlock and adaptation algorithm;
- lesson/exercise generation;
- error modes;
- metric formulas;
- feedback and next-step recommendations;
- analytics (per-key, per-bigram, rhythm);
- race and lobby mechanics, ranks, anti-abuse;
- onboarding;
- UI/UX patterns and motion;
- accessibility;
- the code license, and what that allows us to study versus copy.

Output also:
- a "best-of" list mapped to the TZ criteria;
- a list of candidate functional requirements beyond the TZ.

## Deliverable

`docs/research/02-typing-trainers.md` on `main` (folded from its research branch in `2dcaba0`).

## Answer

Resolved 2026-09-17 by a research subagent. Findings: `docs/research/02-typing-trainers.md` on `main` (folded from its research branch in `2dcaba0`) (542 lines, all 9 sections).

**The gap we can own:** the two open-source leaders split our product between them. keybr is the adaptive *learning engine*; Monkeytype is the *input loop and test*. Neither has a staged finger curriculum, an n-gram Academy, or a "next step" recommendation — which is exactly what the TZ scores 30 points for. Ukrainian ЙЦУКЕН support exists but is shallow everywhere (keybr, Monkeytype, Ratatype 19 lessons, TypingStudy 15, KTouch): nobody combines curriculum + Academy + analytics + races.

**Mechanics worth adopting**
- **keybr's confidence model:** confidence = time-at-target-speed (default 175 CPM) ÷ EMA(time-to-type, α=0.1). A new letter unlocks only when every included key reaches confidence ≥ 1, and the weakest key is "focused" so it appears in every generated word.
- **Monkeytype's architecture:** every metric is a pure function over an append-only keystroke event log. This is the single most valuable structural idea for our Vitest/Playwright gates, and it makes "corrected errors still count" (TZ §8.2) provable.
- **Races:** keybr is server-authoritative (rooms of 5, 3 s wait + 3-2-1 countdown, clients send characters, the server computes speed). Klavogonki stops the car on a typo. TypeRacer scores words × WPS.
- **Anti-cheat is friction, not proof:** image-text tests above thresholds (TypeRacer 100 WPM, 10FastFingers 130 WPM). Monkeytype's real heuristics are a private module; the public repo ships a stub.

**Decisions this forces**
- **Accuracy denominator differs per product:** Monkeytype counts every keystroke (which matches the TZ wording), keybr counts target characters, 10FastFingers counts corrections. Ours must be chosen and locked by tests (ticket 10).
- **Nobody adapts on bigrams/transitions, only per key.** The TZ bonus "adaptive generator by slow bigrams" is unclaimed, so it is a real differentiator (tickets 09, 10).

**Proposed recommendation** (input for tickets 09, 10, 14)
Clean-room build: TZ curriculum on top; keybr-style confidence underneath but applied to *transitions*; unlock ordered by the finger map and gated on accuracy (three consecutive passing attempts); Monkeytype's input/event-log architecture; stop-on-letter in Stage 1; races broadcast for display with server-validated results.

**Licenses:** keybr AGPL-3.0, Monkeytype GPL-3.0, KTouch GPL-2.0+. Study and re-implement; copy no code or data. A clean-room build keeps our own license free.

**Open questions:** project license (MIT clean-room vs AGPL reuse); accuracy per keystroke vs per character; race result authority on Supabase Free; accuracy-weighted races or classic fastest-wins.
