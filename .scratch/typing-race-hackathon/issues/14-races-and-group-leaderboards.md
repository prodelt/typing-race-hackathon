# 14 Grilling: Live races & group leaderboards

Type: grilling
Status: resolved
Blocked by: 02, 05, 11

## Question

How do live races and group ratings work, honestly server-backed?

TZ §11 disqualifies a "global rating" that is really a local list.

**Races**
- Lobby types: private code/invite, quick match, ghosts.
- The race lifecycle state machine.
- Race text selection: language, difficulty, license-clean.
- Netcode: Broadcast/Presence, update rate, authority, reconnect, late join.
- Result verification and basic plausibility checks.
- Race visuals.
- Spectators.

**Groups and leaderboards**
- Group model: class/team join codes, roles.
- Leaderboard scopes: group, weekly, global.

Input: `archive/2026-09-03-map/02-live-multiplayer-and-netcode.md` and `archive/2026-09-03-map/03-leaderboard-and-anti-cheat.md`. Server-side replay anti-cheat is out of scope.

Inputs from research 02:
- keybr races are server-authoritative: rooms of 5, a 3 s wait plus a 3-2-1 countdown, clients send characters and the server computes speed.
- Klavogonki stops the car on a typo; TypeRacer scores words × WPS.
- Anti-cheat in this market is friction, not proof (image-text tests above a WPM threshold).
- Open: race result authority on Supabase Free, and accuracy-weighted vs classic fastest-wins scoring.

## Answer

## Decisions — grilling round (2026-09-17)

- **Rooms:** quick match into an automatic room of up to 5; private rooms by 6-character code plus an invite link. Latecomers join as spectators and watch live. A racer idle for 30 s becomes a spectator so the room isn't held hostage. Five racers fit the Free-tier ceiling: 100 msg/s allows roughly 10–20 concurrent rooms (research 05).
- **Race text:** the same text for every racer, otherwise comparison is meaningless. Sourced from our licensed corpora (Academy paragraphs and authored texts) — nothing from the organizer's materials without permission. Fixed length of ~300 characters rather than a fixed time, so everyone runs the same distance; room filters are language and difficulty.
- **Netcode and authority.** Supabase Realtime Broadcast is a relay with no server-side logic, so it cannot arbitrate:
  - during the race each client broadcasts its own progress twice a second, **for display only**;
  - the start is anchored to a server timestamp — 3 s to gather, then 3-2-1 from it;
  - the finish is validated by an Edge Function that replays the submitted keystroke log against the known race text and runs the ticket-09 plausibility checks before the result reaches any leaderboard;
  - the room channel is private, access enforced by RLS.

  This gives the honestly server-backed ranking TZ §11 demands without running our own server.
- **Scoring:** the winner is decided by an accuracy-weighted score, not raw speed; finish order is also shown. A result needs at least 90% accuracy to be ranked.
- **Groups and leaderboards:** a teacher or captain creates a group with a join code; roles are owner and member. Three boards — group, weekly, global — all computed from summary tables updated on each validated result, with the weekly board reset by a scheduled job. Ranks named after the TZ level bands stay in the "later" bucket from ticket 09.

Resolved 2026-09-17.
