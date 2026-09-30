# Handoff — 2026-09-30

Written short on purpose. The process artifacts are frozen; do not start by reading them.

## Start here

```
pnpm install
pnpm dev          # then open the app and look at it
```

`pnpm typecheck`, `pnpm lint`, `pnpm test` are green (461 tests). `pnpm build` is green and enforces
a 150 KB gzip initial-JS budget (currently 112.3 KB) by failing the build.

## What works, verified in a browser

F1 end to end: starting-level choice, Today with one next action, the pre-start layout check
(correctly refuses to start a Ukrainian scale on a US layout), the typing screen, and the result.
The requirements' §8.2 check was confirmed live: a wrong key raises the error count, Backspace does
not lower it, the count stays raised after the correction.

Three themes work. Lighthouse on `/` is 100 accessibility, 100 best practices, 100 SEO.

## What is not done

- `e2e/*.spec.ts` were being written by a subagent when the session ended. **They have never been
  run.** Expect failures; treat each one as a question, not as a defect list.
- F2–F5 exist as schema, two Edge Functions, a `sync` module and compact specs. **No SQL and no Edge
  Function has ever been executed** — Docker Desktop's daemon was down and there was no cloud
  project. Nothing here is proven.
- `specs/00{2,3,4,5}-*/spec.md` carry 25 `[NEEDS DECISION]` markers. Three were answered on
  2026-09-30 and are recorded in the git log, not yet in the specs: Stage 2's gate rises to about
  15 keys, F5 ships its own set of ~20 race texts instead of waiting for F3, and "clear local data"
  splits into a device-cache action and a separate account deletion.

## Two blockers only a person can clear

1. **Start Docker Desktop.** Then `npx supabase start` works and the backend becomes testable.
2. **Create `.env.local`** from `.env.example` with a Supabase URL and anon key.

## One thing worth keeping from the old process

`specs/001-typing-core/contracts/` is the reason four subagents wrote `metrics`, `curriculum`,
`engine` and the seams in parallel and had them compose on first integration. If you delegate
again, give each agent a written surface and its test obligations. Give it the art direction too:
not doing that is why the product tested well and looked unfinished.

## One defect in the history

Commit `c5063f2` has literal `\u00a7` escapes in its subject and body, from a shell-quoting mistake.
Nothing is pushed, so it can be rewritten with `git filter-branch --msg-filter` once the working
tree is clean.
