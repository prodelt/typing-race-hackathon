# 14 Grilling: Live races & group leaderboards

Type: grilling
Status: open
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
