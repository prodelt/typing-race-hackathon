# 03 Leaderboard Hierarchy & Anti-Cheat Verification

Type: grilling
Status: open
Blocked by: none

## Question

How should leaderboards and result validation be designed:

1. **Leaderboard Scopes**:
   - **Option A (3-Tier Ranking)**:
     - *Global All-Time*: Verified top typists globally.
     - *Weekly Sprint*: Rolling 7-day leaderboard to give active learners a chance to podium.
     - *Group / Classroom*: Custom team/class boards created by teachers/captains with join codes (directly targets the Hackathon bonus criterion: "груповий рейтинг із чесно описаною серверною частиною").
   - **Option B (Simple Global Only)**: Single global leaderboard with language filters (Ukrainian / English).

2. **Anti-Cheat & Result Verification**:
   - **Option A (Statistical Keystroke Entropy & Server Verification)**:
     - Client records raw array of Inter-Keystroke Intervals (IKIs) using `performance.now()`.
     - Submissions with superhuman characteristics (e.g. constant 0ms delay, zero jitter < 25ms, impossible physical burst speeds > 250 WPM without fatigue) are flagged.
     - Verified checkmark badge awarded to runs validated by Supabase Edge Function replay.
   - **Option B (Client-side Basic Validation)**: Simple rate limit checks before saving.

## Options for Human Decision
- Option A (3-Tier Ranking + Statistical Anti-Cheat Replay) (Recommended)
- Option B (Simple Global)
