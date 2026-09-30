# 23 Task: Spec Kit package for 001-typing-core

Type: task
Status: resolved
Blocked by: 20, 22
Mode: AFK per command, HITL at each gate

## Question

Nothing to decide — this is the map's destination made concrete for the first feature. Run the canonical chain from the main checkout for F1 `001-typing-core` as [the roadmap](../../../specs/roadmap.md) scopes it, and stop when the package is approved.

1. `/speckit-specify` — restate the Definition of Done from `.specify/memory/constitution.md` in the request; Spec Kit emits test tasks only when asked.
2. `/speckit-clarify` — repeat until no `NEEDS CLARIFICATION` marker remains.
3. `/speckit-plan` — must produce, beyond the standard artifacts, the **agreed test seams** and the **file-ownership table** grouped by `[US]` label with the paths asserted disjoint.
4. `/speckit-checklist` — requirement quality.
5. `/speckit-tasks` — again stating the Definition of Done.
6. `/speckit-analyze` — fix findings at the source and re-run until no CRITICAL and no unaddressed HIGH.

Inputs already decided and not to be re-litigated: the pedagogical model ([10](10-pedagogical-model.md)), stack and architecture ([11](11-stack-and-architecture.md)), system design and data model ([21](21-system-design-and-data-model.md)), testing and CI ([15](15-testing-strategy-and-cicd.md)), screen map ([17](17-screen-map-and-user-journeys.md)) and the hi-fi mockups and motion spec from [20](20-key-screen-mockups-and-motion-spec.md).

Scope boundary for F1: no word lists beyond seed drill content, no accounts, no races. Those are F2 and F3.

Features F2–F5 get their own chains during implementation, not on this map.

## Answer

## Resolution — 2026-09-30

The Spec Kit package for F1 `001-typing-core` is complete and passes `/speckit-analyze` with no
CRITICAL and no unaddressed HIGH. Artifacts: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/{engine,metrics,curriculum,seams}.md`, `quickstart.md`, `tasks.md`,
`checklists/requirements.md` (16/16) and `checklists/core.md` (62 reviewer-owned items).

**Scope decisions taken at the gates, which changed the roadmap:**

- **F1 has no authentication.** Constitution principle VII is waived for this feature alone, recorded
  in `plan.md` with the governance rule's obligations met, and F1 deploys to previews only. The
  waiver is non-repeatable: F2 removes its condition.
- **F1 owns the key unlock ladder.** The Unlock Order and the Mastery Rule are built here over Stage 1
  scales, so the TZ §9.3 demo step works from the first feature. `specs/roadmap.md` was edited first,
  as principle I requires; F3 now attaches the Word Bank to this ladder instead of building a second.
- **Three clarify answers**: the level follows the stage, so F1's accuracy floor is a single value,
  95%, and no gain in speed raises it; Attempt Aggregates are kept forever while Keystroke Event Logs
  are kept only for the 20 most recent attempts; the local store carries a version marker and a
  documented format, with no migration code in F1 — F2 decides whether to import.
- **Three scope additions** the requirements forced: an explicit three-option starting-level choice
  (TZ §4.1 wants a diagnostic *or* a level choice, and the diagnostic is F4); the service worker moved
  into the Foundational phase so practice runs offline after the first load (TZ §8.10); and the guided
  session as User Story 6, three blocks with the fourth named as arriving with the word curriculum
  rather than faked with pseudo-words.

**Ticket 11's three residuals, settled in `research.md`:** TanStack Router with **code-based routes**,
because a generated route tree would conflict across the seven worktrees F1 uses; Tailwind 4 confirmed
with the tokens as CSS custom properties, because the low-vision preset is a third theme and not a
scale factor; TypeScript 7.0.2, accepted because nothing in this stack needs the compiler's
programmatic API, with the drop to 6.x recorded as the fallback. Every version verified against the
registry on 2026-09-30. **pnpm is not installed on this machine** — Corepack is task T002.

**Five functions the spec depended on and nobody had defined**, now in `research.md`: Confidence as an
exponentially-weighted accuracy factor times speed factor, `undefined` below five observations rather
than zero, and gating nothing; Rhythm Consistency as `100 × max(0, 1 − cv)` over eligible intervals,
because the coefficient of variation is the only reading of "normalised" comparable across the level
table; the eight Stage 1 scale generators, one per mandatory type, so coverage is checkable by
inspection; the Unlock Order as a derived rule over the finger map, starting from the eight home-row
anchors plus space because the first scale needs all eight at once; and keystroke-to-paint measured by
in-page instrumentation that is a deliberate **upper bound**, so the 16 ms gate can never flatter us.

**Structure:** one Foundational phase and six story lanes, 149 tasks. The file-ownership table's lane
prefixes were verified pairwise disjoint programmatically. The Foundational phase is the bulk of F1 —
anything three or more stories read cannot live in a lane, because a lane may not import another
lane's unmerged code — which is what "F1 alone, it is the foundation" means in file terms.

**`/speckit-analyze` found two real coverage gaps**, both fixed at the source: FR-038 (no claim of
gaze verification, no camera or biometric requirement) had no task at all, which under TZ §11 is a
rejection risk, and is now T148; FR-010 (the learner can read each scale's one stated goal) had a data
field but nothing that showed it. All 85 requirements are now traceable to at least one task.

**`chrome-devtools` MCP** is recorded in `plan.md` as the inner development loop — interactive checks,
`performance_start_trace` for latency before the CI gate exists, `lighthouse_audit`, and the physical
ЙЦУКЕН simulation that research 06 proved needs CDP. It does not replace Playwright, which remains the
gate.

Resolved 2026-09-30. Graduates to [ticket 24](24-implementation-handoff-and-throughput.md): how the
first lanes actually start, and which process gates stay strict now that throughput is the concern.
Features F2–F5 get their own chains during implementation, not on this map.
