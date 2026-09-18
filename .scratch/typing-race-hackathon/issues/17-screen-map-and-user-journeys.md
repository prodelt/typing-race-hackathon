# 17 Prototype: Screen map & user journeys

Type: prototype
Status: resolved
Blocked by: 09, 10, 13, 14

## Question

What screens exist, and how does a learner move through them?

Journey to cover:
1. sign-in;
2. typing language and layout;
3. diagnostic;
4. Stage 1 scales and a zero-peek test attempt;
5. key unlock;
6. Stage 2 words;
7. Academy;
8. results and the next-action recommendation;
9. weak-key review;
10. races, groups and leaderboards;
11. settings, privacy, and sources & licenses.

Every step of the TZ §9 demo script must map to a screen.

Deliverable: a low-fidelity flow and information-architecture canvas made in Claude Design, linked as an asset.

## Answer

## Decisions — prototype review (2026-09-18)

Asset: the low-fidelity canvas in Claude Design, "Typing-Race — Screen Map" (private artifact `https://claude.ai/artifact/APE9brBnpu2ThUVTRWoD9r`). Its source is captured on the throwaway branch `prototype/17-screen-map` under `prototypes/17-screen-map/`. The canvas holds the screen map, the learner journey with the TZ §9 demo mapping, and six low-fi wireframes: Today, Path · Stage 1, Exercise (practice ↔ test toggle), Result with key unlock, and Race room.

**Screen inventory, 32 screens in six groups:**
- **Public, no sign-in:** P0 About the product, P1 Sign-in / sign-up, P2 Password reset, P3 Formulas, P4 Sources & licences, P5 Privacy, P6 About the project (AI declaration, repo, latest green CI run).
- **Onboarding:** O1 Nickname + UI language, O2 Typing language + layout check, O3 Hand position (skippable, reachable later from help), O4 Diagnostic 90 s (skippable), O5 Starting point.
- **Learning:** L1 Today, L2 Path (Stage 1 keyboard with fingers, Stage 2, Academy), L3 Academy, L4 Academy module, L5 Review (weak keys and transitions).
- **Exercise — one engine for every mode:** E1 Pre-start, E2 Typing · practice, E3 Typing · test attempt, E4 Result, E5 Key unlock, E6 Between session blocks.
- **Competition:** R1 Race lobby, R2 Room, R3 Race result, G1 Groups, G2 Leaderboards (group · weekly · global tabs).
- **Me:** S1 Statistics & history, S2 Settings, S3 Profile & data, plus K, a command palette (Ctrl K) available everywhere.

**Decisions:**
1. **Primary navigation, six items:** Today · Path · Review · Races · Leaderboards · Statistics. Settings, Profile & data and Sign out sit in the profile menu. The footer carries Formulas · Sources & licences · Privacy · About the project.
2. **Public pages:** Formulas, Sources & licences, Privacy and About the project are readable without signing in, so the jury reaches §9.7 without an account.
3. **Entry:** a single short product screen (P0) comes before sign-in: what it is, the three stages, races, with "Sign in" and "Create profile". No marketing landing beyond that one screen.
4. **Session:** "Start session" on Today runs the four blocks (warm-up, target skill, consolidation, real text) as a guided sequence with a short between-blocks screen (E6). Any unlocked exercise can still be picked by hand from Path.
5. **Entering a test attempt:** the learner switches between practice and test attempt themselves; once a practice attempt clears the accuracy floor, "Take the test attempt" becomes the primary button.
6. **Key unlock:** a card on the result screen showing the new key, its finger and first words, with a "Words from unlocked keys" button. No separate full-screen moment.
7. **Hand-position screen (O3):** skippable, and reachable later from help.
8. **Demo step §9.8:** the About the project page links to the latest green CI run; locally the checks run with one command.

**TZ §9 demo route:** 1 P0 → P1 → O1 → O2 · 2 L1 → E1 → E3 · 3 E4 → E5 → E2 · 4 L3 → L4 → E2 · 5 E3 → E4 · 6 reload → L1 rendered from the local cache with a sync badge · 7 footer → P4 · 8 P6 → CI.

Resolved 2026-09-18. Key-screen mockups and the motion spec graduate to ticket 20.
