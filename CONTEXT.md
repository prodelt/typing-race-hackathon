# Typing-Race: Domain Context & Glossary

Comprehensive domain model and conceptual glossary for the Typing-Race touch-typing training system and speed racing platform.

## People

- **Learner (Учень)**: A signed-in person progressing through the curriculum; every learner has an account (see ADR-0002).
  _Avoid_: Guest, anonymous user, visitor

## Pedagogical Core Concepts

- **Touch Typing (Сенсорний набір)**: Typing without visual contact with the physical keyboard, where each physical key is mapped to exactly one dedicated finger, fingers start from and return to the home row, hands maintain stable orientation, and speed is developed only after rhythmic accuracy is established.
- **Home Row (Домашній ряд)**: The baseline finger resting position (`ASDF JKL;` for QWERTY, `ФІВА ОЛДЖ` for Ukrainian ЙЦУКЕН). Physical reference points are established by the tactile bumps on `F` and `J`.
- **Finger-to-Key Mapping**:
  - *Left Pinky*: `Q A Z` (QWERTY) / `Й Ф Я` (ЙЦУКЕН)
  - *Left Ring*: `W S X` / `Ц І Ч`
  - *Left Middle*: `E D C` / `У В С`
  - *Left Index*: `R F V T G B` / `К Е А П М И`
  - *Right Index*: `Y H N U J M` / `Н Г Р О Т Ь`
  - *Right Middle*: `I K ,` / `Ш Л Б`
  - *Right Ring*: `O L .` / `Щ Д Ю`
  - *Right Pinky*: `P [ ] ; ' /` / `З Х Ї Ж Є .` and right modifier keys
  - *Thumbs*: Spacebar
  - *Shift*: Operated by the pinky opposite to the target key.
- **Stage 1 (Scales / Клавіатурні гами)**: Piano-like mechanical finger drills (home row movement, mirror pairs, finger isolation, vertical row transitions, space/shift coordination).
- **Stage 2 (Words from Unlocked Keys / Слова з вивчених клавіш)**: Vocabulary drills generated strictly from the subset of characters already mastered by the learner.
- **Stage 3 (Academy / Академія)**: Advanced speed and rhythm modules based on weighted bigrams, trigrams, morphemes, suffixes, and full literary paragraphs derived from frequency corpora.
- **Zero-Peek Test Mode (Заліковий режим без підглядання)**: Assessment mode where the virtual on-screen keyboard and next-character indicators are completely hidden to prevent visual reliance.
- **Actionable Recommendation (Дієвий зворотний зв'язок)**: Single high-priority directive generated after each session identifying the typist's slowest transition (e.g. "Повтори перехід «ол»").

## Speed & Performance Metrics

- **SPM / CPM (Characters Per Minute)**: Primary typing speed metric: `(total_printable_characters_typed / elapsed_time_seconds) * 60`.
- **WPM (Words Per Minute)**: Secondary speed metric calculated via standardized formula: `WPM = SPM / 5`.
- **Gross WPM**: Speed calculated across all keystrokes.
- **Net WPM**: Speed calculated strictly across correct final characters.
- **Accuracy (%)**: `(correct_keystrokes / total_keystrokes_including_corrected) * 100`. Corrected errors remain penalized in total keystroke count.
- **Inter-Keystroke Interval (IKI)**: High-resolution timestamp delta (`performance.now()`) between consecutive physical key presses, used to calculate rhythm variance and transition heatmaps.
- **Rhythm Consistency (%)**: Standard deviation of IKIs normalized to a percentage scale (100% = perfectly uniform metronome rhythm).

## Attempts & Adaptation

- **Attempt (Спроба)**: One run of one exercise by a learner, recorded as an immutable keystroke event log together with its metrics.
  _Avoid_: session, try, run
- **Keystroke Event Log (Журнал натискань)**: The append-only, timestamped record of every keystroke in an attempt; every metric is derived from it.
  _Avoid_: input history
- **Transition (Перехід)**: The motor move from one key to the next, characterised by the fingers and rows involved. A bigram is the character pair in text; a transition is the movement that types it.
- **Same-Finger Transition**: A transition in which both keys belong to the same finger.
- **Confidence (Впевненість)**: How reliably a learner types a given key or transition, judged from its recent timing and miss rate.
- **Focus Element (Фокус вправи)**: The weakest key or transition an exercise is built around; it appears in every item of that exercise.
- **Test Attempt (Залікова спроба)**: An attempt that counts toward mastery, run in Zero-Peek Test Mode — the next-key hint and on-screen keyboard are hidden, errors stay visible.
  _Avoid_: exam, blind mode
- **Mastery Rule (Правило засвоєння)**: Three consecutive test attempts at or above the level's accuracy floor; speed never gates progression.
- **Session (Заняття)**: A 15–25 minute practice block of warm-up, one target skill, consolidation and real text.
- **Diagnostic (Діагностика)**: A short, skippable placement run that sets a learner's starting point and initial confidence.
- **Pseudo-word (Псевдослово)**: A meaningless letter string, allowed only in explicitly labelled mechanics exercises.
- **Authored Content (Авторський матеріал)**: Exercise text written by the project itself rather than derived from a licensed dictionary.

## Racing & Multiplayer Concepts

- **Race**: A real-time competitive typing sprint where multiple typists type identical snippets.
- **Lobby / Room**: Synchronized room powered by Supabase Realtime Channels.
- **Race State Machine**:
  - `waiting`: Typists gather in lobby.
  - `countdown`: 3-second gather, then a 3-2-1 countdown anchored to a server timestamp.
  - `active`: Race in progress; keystrokes and progress percentages are broadcasted live.
  - `finished`: All racers completed or timeout reached; verified leaderboard displayed.
- **Speedometer**: Dynamic visual HUD reflecting real-time instantaneous CPM/WPM during the race.

- **Quick Match (Швидкий заїзд)**: Joining an automatically filled room of up to five racers.
- **Private Room (Приватна кімната)**: A room joined by its code or an invite link.
- **Spectator (Глядач)**: Someone in a room who watches without racing — latecomers and racers idle for too long.
- **Validated Result (Перевірений результат)**: A race result the server has replayed against the race text and accepted; only validated results are ranked.
  _Avoid_: score, finish time
- **Group (Група)**: A class or team joined by a code, with an owner, members and its own leaderboard.
- **Leaderboard (Рейтинг)**: A ranking of validated results with at least 90% accuracy, scoped to a group, a week, or all time.
  _Avoid_: global rating (unless it is genuinely server-backed)

## Design System: Serene Script

- **Canvas**: Warm paper cream (`#FAF9F5` / `#F8FAF5`)
- **Typography**: Soft slate (`#2D312E` / `#191C19`)
- **Accent & Correct**: Sage green (`#4A7C59` / `#316342`)
- **Error & Alert**: Gentle terracotta (`#D95D39` / `#BA1A1A`)
- **Upcoming Text**: Muted slate (`#94A3B8` / `#717971`)
- **Font Triad**: `Source Serif 4` (typing core), `Source Sans 3` (UI copy), `JetBrains Mono` (metrics/data).
