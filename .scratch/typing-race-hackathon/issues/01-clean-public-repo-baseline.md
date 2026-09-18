# 01 Task: Clean, secret-free public repository baseline

Type: task
Status: resolved
Blocked by: none
Mode: AFK, with one HITL gate (user approves the file list before the first push)

## Question

The public repo `https://github.com/prodelt/typing-race-hackathon.git` is empty. Every artifact of this map is meant to land there, so the baseline must be clean before anything is pushed. What exact tree and history do we publish?

Work to do, in order:

1. Stop tracking vendored third-party skill copies (`.agents/skills/`, `.claude/skills/`) and cloned reference repos (`skills/`, `spec-kit/`). Document the restore commands (`skills-lock.json`, `specify init`) in `AGENTS.md`.
2. Rewrite the root `.gitignore`:
   - un-ignore `.scratch/typing-race-hackathon/`;
   - ignore `tasks/` (the organizer clone, which holds REVIEW_REQUIRED content that must never be committed);
   - ignore `.env*` except `.env.example`;
   - ignore `.claude/settings.local.json`, agent worktree directories and test/coverage outputs.

   Revert the ineffective entries added to `.specify/.gitignore`, which only apply inside `.specify/`.
3. Rebuild local history as a clean initial commit. Nothing has been pushed yet, so rewriting the two local commits is safe. Rename `master` → `main` and add `origin`. Decide the commit author email with the user: use the GitHub noreply address if they don't want a personal email public.
4. Run a secret scan (gitleaks or equivalent) over the full tree. No keys, tokens, `.env` files or personal data. Keys will live only in Vercel and GitHub secrets.
5. Show the user the exact file list and push only after explicit approval.
6. Fold findings from any `research/*` branches into `docs/research/` on the new `main`.
7. Record the branch-protection settings for `main`, without applying them yet. They are applied when the first code task starts.

## Answer

<!-- Record: pushed commit SHA, tracked file count, secret-scan summary, restore commands, protection settings recorded. -->

Resolved 2026-09-17. Pushed commit `2dcaba0` to `https://github.com/prodelt/typing-race-hackathon` as branch `main` (75 files).

**What was done**
- History rebuilt as a single clean initial commit on an orphan branch; `master` and the seven `research/*` branches deleted; all agent worktrees removed.
- The seven research reports were folded into `docs/research/` before the branches went away, so nothing was lost.
- Third-party skill copies (`.agents/skills/`, `.claude/skills/`) and the cloned reference repos are no longer tracked; `README.md` documents how to restore them.
- `tasks/` (the organizer snapshot with REVIEW_REQUIRED licences) is ignored and was never committed.
- The ineffective entries added to `.specify/.gitignore` were reverted; the real rules now live in the root `.gitignore`, which also un-ignores `.scratch/typing-race-hackathon/`.
- Added `README.md` (Ukrainian, jury-facing), `.env.example` with empty values, and `.gitattributes` with `eol=lf` so agents and CI don't fight over line endings.
- Author identity for this repo set to `prodelt <137156646+prodelt@users.noreply.github.com>` so the personal email stays out of public history (user's choice).
- Secret scan: pattern-based (AWS keys, GitHub tokens, OpenAI/Resend keys, Slack tokens, JWTs, private keys, `service_role`) over every staged file — clean. `gitleaks` is not installed locally; research 06 recommends `gitleaks-action@v3` in CI, which ticket 15 will wire up.

**Branch protection for `main`, recorded and to be applied at the first code task**
- Require a pull request before merging.
- Require status checks: the CI jobs defined in ticket 15.
- Block force pushes and deletions; require linear history; squash merge only.
