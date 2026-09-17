# Wayfinder Map: Typing-Race Hackathon & Release Platform

## Destination

A release-ready, production-grade Touch Typing & Speed Racing Web Application meeting 100% of Hackathon requirements (100/100 points) and delivering a commercial-grade product:
- 3-stage pedagogical touch-typing methodology (Scales -> Words with unlocked keys -> Academy with frequency n-grams/morphemes/tempo).
- Strict finger-to-key binding (QWERTY & ЙЦУКЕН) with zero-peek blind test enforcement.
- Ultra-low keystroke latency (<16ms) inspired by Monkeytype's event loop architecture.
- Soft-light "Serene Script" aesthetic (#FAF9F5 paper canvas, #2D312E slate typography, #4A7C59 sage green, #D95D39 terracotta).
- Live multiplayer racing lobbies with real-time peer synchronization and spectator/ghost capabilities.
- Multi-tier verified leaderboards (Global, Weekly, Group/Classroom) with anti-cheat keystroke verification.
- Formal touch-typing certification system with verifiable digital diplomas (PDF/SVG + public verification URL).
- Supabase backend: Auth, RLS-secured progress sync, Realtime Channels.
- Vercel frontend deployment with CI/CD, offline PWA capability, and 100% automated test coverage.

## Notes

- **Domain**: Touch-typing motor skills, ergonomic finger mechanics, frequency linguistics, real-time multiplayer racing, tamper-proof certification.
- **Skills to consult**: `spec-kit` (`speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-implement`), `mattock-skills` (`wayfinder`, `grilling`, `domain-modeling`, `codebase-design`, `tdd`, `code-review`), `StitchMCP`.
- **Standing Preferences**:
  - Palette: Soft light paper & ink theme (#FAF9F5, #4A7C59, #D95D39, #2D312E, #94A3B8).
  - Database: Supabase (PostgreSQL, Row-Level Security, Supabase Realtime Channels).
  - Deployment: Vercel.
  - Multi-agent development harness configured in `AGENTS.md` and `.agents/`.

## Open Decision Frontier (Grilling Round 1)

- [01-frontend-framework-choice](file:///.scratch/typing-race-hackathon/issues/01-frontend-framework-choice.md): Vite + React 19 + Zustand vs Svelte 5 vs Next.js.
- [02-live-multiplayer-and-netcode](file:///.scratch/typing-race-hackathon/issues/02-live-multiplayer-and-netcode.md): Private rooms vs quick match queue, visual race tracks vs minimalist bars, ghost runners.
- [03-leaderboard-and-anti-cheat](file:///.scratch/typing-race-hackathon/issues/03-leaderboard-and-anti-cheat.md): Global/Weekly/Classroom leaderboards, IKI entropy analysis for cheat detection.
- [04-certification-system-and-verification](file:///.scratch/typing-race-hackathon/issues/04-certification-system-and-verification.md): Official timed certification exam, tier thresholds (Junior to Master), verifiable PDF/SVG and public verify URL.
- [05-pedagogy-error-mode-and-scoring](file:///.scratch/typing-race-hackathon/issues/05-pedagogy-error-mode-and-scoring.md): Stop-on-error vs free flow, 3-streak passing rule vs spaced repetition re-injection.
- [06-dictionary-pipeline-and-licensing](file:///.scratch/typing-race-hackathon/issues/06-dictionary-pipeline-and-licensing.md): Deterministic corpus parsing, SHA-256 validation, license transparency.

## Decisions so far

- [Design System & UI Tokens](file:///.scratch/typing-race-hackathon/issues/02-stitch-design-system-and-screens.md): Established "Serene Script" soft-light design tokens in Stitch project `16341605640151885435` with initial screens for Words Mode (`7db552de3e5a4f4eb606d6c2dd3b4f25`) and Academy Dashboard (`42d924cb31ab4af2bdc0f00fac728a00`).

## Not yet specified

- Audio synthesis engine: Web Audio API mechanical switch sound profiles (Cherry MX Blue, Brown, Red, typewriter) vs mute by default.
- Custom user dictionary and educator assignment creator.
- Multi-region latency optimization for Supabase Realtime across global players.

## Out of scope

- Camera-based biometric or gaze tracking (strictly prohibited by Hackathon rule 2 & 103).
- Commercial subscription paywalls (all core functionality and certification must remain free for demonstration).
- Mobile virtual keyboard typing (desktop physical keyboard is the target platform).
