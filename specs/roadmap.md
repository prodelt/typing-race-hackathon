# Typing-Race Roadmap

The product is built as five Spec Kit features. Each is a **vertical slice that can be demonstrated on its own** — that is the cut rule, and it is why the dictionary pipeline lives inside the feature that first consumes it rather than standing alone. Decided in [ADR-0008](../docs/adr/0008-canonical-agent-workflow.md) and [ticket 16](../.scratch/typing-race-hackathon/issues/16-multi-agent-workflow-and-constitution.md).

Feature IDs are immutable once referenced. When scope shifts, this file is edited **first**, then the affected feature's artifacts.

| ID | Feature directory | Intent | Scope boundary | Depends on | Status |
|---|---|---|---|---|---|
| F1 | `001-typing-core` | App shell and routing, "Serene Script" tokens, keyboard model (ЙЦУКЕН/QWERTY) with the finger map, keystroke engine on `beforeinput`, SPM/CPM/WPM, accuracy and error counting, key and transition confidence, Stage 1 scales, zero-peek test attempts, local progress, the Formulas page | Seed drill content only — no word lists; no accounts; no races | — | not started |
| F2 | `002-accounts-and-progress` | Supabase auth (email + password, Google/GitHub OAuth, PKCE), RLS, append-only attempts, the `submit-attempt` Edge Function, server-derived progress, IndexedDB cache and outbox, history, export/import, account deletion | No leaderboards (F5); no new drill types | F1 | not started |
| F3 | `003-words-and-curriculum` | Dictionary pipeline as the Foundational phase (vendored licensed sources, filters, checksummed `data/derived/`), Stage 2 words built only from unlocked keys, the key unlock ladder, the authored apostrophe list | No Academy n-grams or morphemes (F4) | F1 | not started |
| F4 | `004-academy-and-analytics` | Stage 3 Academy (frequency n-grams, morphemes, tempo), the adaptive slow-bigram generator, heatmaps, rhythm and error visualisation, the one-next-action rule engine, the diagnostic | Consumes F3's generator and F2's stored history | F2, F3 | not started |
| F5 | `005-races-and-leaderboards` | Quick match and private-code rooms, Realtime broadcast, race state machine, the `finish-race` replay function, accuracy-weighted ranking, group, weekly and global leaderboards | Requires accounts from F2 | F2 | not started |

## Order

F1 alone — it is the foundation. Then **F2 and F3 in parallel**, two worktrees over disjoint trees. Then **F4 and F5 in parallel**. Two concurrent lanes is the working default, three the ceiling.

Within a feature: the Foundational phase merges first, then one user story per lane. Hot files change only in a Foundational phase.

## Per-feature chain

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze`, all from the main checkout, then implementation per story in worktrees, then `/speckit-converge` once. The Definition of Done in `.specify/memory/constitution.md` must be restated in every `specify` and `tasks` request, because Spec Kit generates test tasks only when asked.
