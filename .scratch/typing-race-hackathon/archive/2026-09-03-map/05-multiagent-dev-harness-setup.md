# 05 Multi-Agent Development Harness Setup

Type: task
Status: open
Blocked by: none

## Question

How should the repository configuration (`AGENTS.md`, `.claude/`, `.gemini/`, Spec Kit, Matt Pocock skills) be established so that multiple autonomous agents can work concurrently without stepping on each other:
1. Canonical Agent contract in `AGENTS.md` and `CLAUDE.md`.
2. Dedicated subagent roles with non-overlapping module scopes:
   - **Architect Agent**: Spec Kit (`speckit-plan`, `speckit-tasks`), domain contracts, ADRs.
   - **Logic & TDD Agent**: Core typing state machine, SPM/WPM formulas, finger mapping, dictionary parsers, Vitest tests.
   - **UI & Stitch Agent**: React components, Serene Script styling, low-latency typing canvas/DOM, animations.
   - **Backend & Supabase Agent**: Database migrations, RLS policies, Realtime lobby channels, Vercel edge routes.
   - **Reviewer / Judge Agent**: Spec verification, ELT judge-proof, license auditing, checklist sign-off.
3. Git branch strategy: task-specific branches with conventional commits (`feat:`, `test:`, `fix:`, `docs:`).
