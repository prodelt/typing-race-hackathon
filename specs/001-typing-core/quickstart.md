# Quickstart: proving Typing Core works

**Feature**: F1 `001-typing-core` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

How to run F1 and how to prove it does what the specification says. This is a validation guide: it
names commands and expected outcomes, not implementation.

## Prerequisites

- **Node 24.19.0** — already present on the development machine.
- **pnpm** — *not installed yet*. The Foundational phase establishes it through Corepack
  (`corepack enable && corepack prepare pnpm@<pinned> --activate`) and pins it in `packageManager`,
  so every later checkout gets the same version without a global install.
- Playwright browsers — `pnpm exec playwright install --with-deps` once.
- **Nothing else.** F1 has no server, no Docker, no Supabase, no account and no environment variable.
  `.env.example` exists and is empty of anything F1 needs; that is deliberate, and it is what makes
  the requirements' "starts from a single documented command" true here.

## Run it

```bash
pnpm install
pnpm dev            # development server
pnpm build          # production build — what every E2E runs against
pnpm preview        # serve the production build locally
```

## The full check, as CI runs it

```bash
pnpm typecheck                  # tsc --noEmit across the workspace
pnpm lint                       # Biome
pnpm test                       # Vitest — unit and property tests
pnpm test:e2e                   # Playwright, Chromium + Firefox + WebKit, production build
pnpm test:e2e --project=cdp     # the one CDP-only scenario: physical ЙЦУКЕН layout simulation
pnpm test:latency               # keystroke-to-paint, Chromium, frame-rate limiting off
pnpm build                      # must succeed
```

Every one of these is a CI job, and a task is not done without a link to a green run.

## Validating each user story

Each row is that story's **Independent Test** from [spec.md](./spec.md), which is also the name its
Playwright spec carries.

| Story | What to do | What must happen |
|---|---|---|
| **US1** Typing an exercise | Open a Stage 1 scale in Ukrainian, type it with one deliberate wrong key and a Backspace correction; then run the same scale as a Test Attempt | The wrong key marks the awaited character **in place** — no character moves, the caret holds, the error counter rises and never falls back. In the Test Attempt the keyboard, next-key hint, finger diagram and live speed/accuracy are **absent from the page**, while time, errors and progress remain |
| **US2** Result and one next action | Finish one attempt from a seeded store | Every metric the requirements list is present; the corrected error still counts; **exactly one** Next Action with a button that starts it. Seed the store at the mastery threshold and the Key Unlock card appears |
| **US3** Path, mastery, persistence | From an empty store: choose a starting level, pass three consecutive Test Attempts on the scale focused on the next locked key, then restart the browser with the network off | Exactly one key unlocks, the unlocked set stays a prefix of the Unlock Order, Path updates — and after the restart the unlocked set, history and Next Action are unchanged and still usable |
| **US4** Formulas page | Open `/formulas` with no stored progress | It renders with no learner state, and states every formula the product uses — including **both** readings of the row-change measure and which one we count |
| **US5** Settings | Change every setting, reload | Each takes effect immediately and survives the reload. With motion off, nothing animates and nothing sounds |
| **US6** Guided session | Start a session from Today and run all three blocks | The expected length is stated before the first block; the between-blocks screen appears twice; real text is **named as arriving with the word curriculum**, not faked with pseudo-words; abandoning mid-block keeps the attempts already recorded |

## Validating the requirements' own mandatory checks

| Check | Where it is proved |
|---|---|
| §8.1 SPM and accuracy on fixed examples | `packages/metrics` unit tests with hand-computed values |
| §8.2 a corrected error still counts | `packages/metrics` and `packages/engine`, plus US1 and US2 E2E |
| §8.4 every key has exactly one finger | `packages/curriculum` table test over both layouts |
| §8.5 `і`, `ї`, `є`, `ґ` never substituted | `packages/engine` property test, plus a US1 scenario |
| §8.9 lessons and results survive a reload | US3 E2E |
| §8.10 basic training works offline after first load | US3 E2E with the network disabled |

## Validating the demo route

The requirements' §9 steps that F1 can already show, end to end, in one pass:

`/` (product page) → starting-level choice → Today → a Stage 1 scale as a **Test Attempt** with no
on-screen hint (§9.2) → result with the deliberate error correctly counted and one recommendation
(§9.5) → the **Key Unlock** card and a scale using the new key (§9.3) → reload, and Today renders from
local state (§9.6) → footer → `/formulas` (part of §9.7) → the check commands above (§9.8).

Steps §9.3's *word selection* and §9.4's Academy bigram exercise are **not** reachable in F1; they
arrive with F3 and F4. Nothing in F1 should pretend otherwise.

## Interactive verification while building

The `chrome-devtools` MCP server is the inner loop, not the gate ([plan.md](./plan.md#verification-tooling)).
Use it to look at a screen as it is built, to read keystroke-to-paint with
`performance_start_trace` before the CI gate exists and to diagnose it once the gate fires, to run
`lighthouse_audit` against ticket 15's ≥95 threshold, and to simulate a physical ЙЦУКЕН layout —
which research 06 proved needs CDP, because Playwright's keyboard API cannot type Cyrillic at all.

Nothing counts as verified because it looked right there. The gate is Playwright.

## Known non-goals, so their absence is not read as a defect

No accounts, no server, no leaderboards, no races. No dictionary words: Stage 1 text is generated from
the finger map. No Academy, no heatmaps, no Diagnostic, no export/import. F1 deploys to Vercel
previews only and never to a public production URL, because principle VII is waived for this feature
alone — see [plan.md](./plan.md#waiver).
