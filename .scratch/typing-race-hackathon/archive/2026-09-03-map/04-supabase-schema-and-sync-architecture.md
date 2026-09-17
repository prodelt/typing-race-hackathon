# 04 Supabase Schema & Sync Architecture

Type: research
Status: open
Blocked by: none

## Question

How should Supabase be structured to support both offline-first guest play and persistent cloud accounts:
1. Local-first progression stored in `localStorage` / `IndexedDB`, seamlessly merged upon Supabase Auth sign-up.
2. Database Schema:
   - `profiles`: user metadata, preferred layout (ЙЦУКЕН / QWERTY), current stage level, average WPM/SPM.
   - `exercise_attempts`: test timestamps, stage, lesson_id, spm, raw_wpm, accuracy, error_count, keystroke_intervals (JSONB), completed_cleanly boolean.
   - `user_curriculum_progress`: unlocked characters, passed lesson ids, weak keys and transitions.
   - `race_rooms`: multiplayer lobbies, code, status (`waiting`, `countdown`, `active`, `finished`), target snippet.
   - `race_participants`: real-time progress %, current WPM, finish time, placement.
3. Realtime multiplayer: Supabase Realtime Channels (Broadcast mode for low-overhead peer progress, Postgres Changes for room state).
4. RLS security: Public read-only for public leaderboards; user-scoped mutations for attempts and progress.
