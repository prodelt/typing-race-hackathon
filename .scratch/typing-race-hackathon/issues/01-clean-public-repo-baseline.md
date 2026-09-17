# 01 Task: Clean, secret-free public repository baseline

Type: task
Status: claimed
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
