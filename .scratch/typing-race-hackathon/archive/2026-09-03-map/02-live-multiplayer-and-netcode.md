# 02 Live Multiplayer & Racing Netcode

Type: grilling
Status: open
Blocked by: none

## Question

How should the live multiplayer racing mode be structured from gameplay and networking standpoints:

1. **Lobby & Matchmaking**:
   - **Option A (Hybrid Private & Matchmaking)**: Quick match queue (auto-places 2–5 players into a room with a 10s countdown) + Custom Private Rooms (shareable 6-character room code / direct invite URL). If matchmaking takes >10s, fill with recorded Ghost Runners of similar WPM.
   - **Option B (Strict Lobbies Only)**: Only host-created rooms with invite links. Host presses "Start Race".
   - **Option C (Asynchronous Ghost Battles)**: No live peer sync; players race against historical runs of friends or top leaderboard ghosts.

2. **Race Visual Representation**:
   - **Option A (Visual Track with Cars / Runners)**: Top horizontal racing lanes with customizable pixel/SVG cars advancing proportionally to word completion, with live WPM badge above each car.
   - **Option B (Minimalist Progress Bars)**: Clean, editorial Monkeytype-style progress bars with player avatars and live delta (+/- X words).
   - **Option C (Dual View)**: Toggleable between visual race track and minimalist progress mode.

3. **Netcode & Transport**:
   - Supabase Realtime Channels (`broadcast` mode for sub-50ms peer progress updates without database write bottleneck, `presence` mode for lobby occupancy, and PostgreSQL table for final verified finish results).

## Options for Human Decision
- A + A + Supabase Broadcast (Recommended)
- Other combinations per user feedback
