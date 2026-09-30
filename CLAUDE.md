# Typing-Race

Browser touch-typing trainer for Ukrainian (ЙЦУКЕН) and English (QWERTY), with live races and group
leaderboards. Internal company hackathon entry; the jury demo is 2026-10-06.

The binding requirements are `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md` —
organizer material, gitignored, never committed.

Settled decisions: [`DECISIONS.md`](DECISIONS.md). Vocabulary: [`CONTEXT.md`](CONTEXT.md). Motion
spec: [`docs/design/motion.md`](docs/design/motion.md). Nothing else is required reading.

## Run it

```
pnpm install
pnpm dev          # open the app in a browser — do this before and after every change
pnpm check        # typecheck + lint + unit
pnpm test:e2e     # Playwright, Chromium
pnpm build        # fails past the 150 KB gzip initial-JS budget
```

## How work is organised

Claude Code is the orchestrator and delegates to subagents. This file authorises the Agent tool.

1. A **lane** is one slice of product a person can click through end to end. Not a layer, not a
   package, not a task list. "A learner can sign in and see yesterday's progress" is a lane;
   "add the attempts table" is not.
2. One lane = one subagent = one worktree = one branch. Spawn with `isolation: "worktree"`.
   Three lanes at once, maximum.
3. A lane's brief is a **single prompt**, and it carries four things: what the learner sees and does,
   the art direction for those screens, the exact files the lane owns, and the one end-to-end
   scenario that proves it works. No spec, no plan, no task list, no tickets, no per-task
   bookkeeping. If the brief needs a document, the lane is too big — cut it.
4. **Hot files belong to the orchestrator**: `package.json`, the lockfile, `tsconfig*`, the Vite /
   Vitest / Biome / Playwright configs, `packages/ui/src/tokens.css` and `themes.css`, the root
   router, package barrels (`index.ts`), CI. A lane that needs one of these says so and stops;
   the orchestrator changes it on `main` between merges.
5. **No lane imports another lane's unmerged code.** If one needs to, the lanes were cut wrong —
   re-cut them rather than sequencing them.
6. **Merge gate**, in this order, all of it on the lane's branch:
   `pnpm check` green → the lane's e2e scenario green → `/code-review <merge-base>` clean →
   the orchestrator opens the running app and looks at the screen. Then the orchestrator
   squash-merges to `main`. No pull requests unless the user asks for them.
7. After a merge, tell the user in one line what is newly clickable. That is the progress report —
   not a task count, not a test count.
8. Never `git stash` in a worktree; the stash stack is shared with the main checkout. Rebase a lane
   on `main`, never merge `main` into a lane.

## Tests

Write a test only when it can fail for a reason that would embarrass us at the demo.

- **e2e (Playwright)** for every flow a learner can walk. This is the gate that matters and the one
  a lane must deliver.
- **unit and property (Vitest, fast-check)** only for pure logic in `metrics`, `engine`,
  `curriculum`. A wrong accuracy formula or unlock rule is what loses a demo.
- **No** tests for React components, **no** contract stub tests, **no** "one test per task", **no**
  coverage targets. Deleting a test that only restates the implementation is an improvement.

## Design is a gate, not a polish pass

A green task list is not evidence the product is good. The art direction from `DECISIONS.md` and
`docs/design/motion.md` goes into the lane prompt alongside the behaviour, and a screen is not done
until someone has looked at it running. This is the one mistake this project has already made once.

## Gotchas

- **PowerShell is primary**: no `&&`, use `;` or separate calls. The Bash tool is also available and
  takes POSIX syntax.
- **Playwright cannot type Cyrillic** through the keyboard API in any engine. Drive `beforeinput` /
  `compositionend`. Simulating a physical ЙЦУКЕН layout needs CDP, so those specs are Chromium-only
  and tagged.
- **Firefox ignores `preventDefault()` on `beforeinput`** and delivers non-US characters as IME
  compositions. Anything touching the input path runs on all three engines.
- Before writing code against an unfamiliar library: `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"`.
- No secrets in commits. `.env.example` is tracked, `.env.local` never. Nothing under `tasks/` is
  ever committed.
- The backend is unproven: no SQL migration and no Edge Function in `supabase/` has ever been
  executed. It needs Docker Desktop running and a `.env.local`, both of which only the user can do.

## Language

Chat with the user in **Ukrainian**. Code, comments, commit messages and `DECISIONS.md` are English.
`README.md`, `docs/pedagogy.md`, `docs/data-sources.md` and `docs/ai-use.md` are Ukrainian, because
the jury reads them.

## Stale references in comments

Comments across the code cite `FR-023`, `T011`, `ADR-0007`, `plan.md`, "Constitution III" and
"ticket 15". Those documents were archived on 2026-09-30 into the git tag
`archive/process-harness-2026-09-30`. Read such a citation as "a requirement" or "a decision" and
move on — do not go looking for the file, and do not write new citations like these.
