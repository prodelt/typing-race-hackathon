# Typing-Race: Domain Context & Glossary

Comprehensive domain model and conceptual glossary for the Typing-Race touch-typing training system .

## People

- **Learner (Учень)**: The person progressing through the curriculum. Training needs no sign-in; without an Account the learner's progress lives in this browser only.
  _Avoid_: Guest, anonymous user, visitor
- **Account (Акаунт)**: An optional Google sign-in attached to a Learner, so their attempts, settings and profile follow them to any device. Signing in never discards progress made before it.
  _Avoid_: user, login, profile (the profile is what an Account shows, not the Account itself)

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
- **Practice Attempt (Тренувальна спроба)**: An attempt with the on-screen keyboard and next-key hint visible; it never counts toward mastery. The learner switches to a test attempt, which becomes the primary action once practice clears the accuracy floor.
- **Key Unlock (Відкриття клавіші)**: The moment a key joins the learner's unlocked set after the Mastery Rule is met on an exercise focused on it; shown on the result screen together with its finger and first words.
- **Next Action (Наступна дія)**: The one Actionable Recommendation shown on Home and on every result, with a button that starts it.
- **Mastery Rule (Правило засвоєння)**: Three consecutive test attempts at or above the level's accuracy floor; speed never gates progression.
- **Session (Заняття)**: A 15–25 minute practice block of warm-up, one target skill, consolidation and real text.
- **Diagnostic (Діагностика)**: A short, skippable placement run that sets a learner's starting point and initial confidence.
- **Pseudo-word (Псевдослово)**: A meaningless letter string, allowed only in explicitly labelled mechanics exercises.
- **Authored Content (Авторський матеріал)**: Exercise text written by the project itself rather than derived from a licensed dictionary.
- **Attempt Aggregates (Агрегати спроби)**: The per-key and per-transition summary of one attempt (counts, misses, timing). Kept forever, unlike the keystroke event log, and the only input from which progress and confidence are derived.
- **Validated Race Result (Перевірений результат перегону)**: A race result whose keystroke log the server has replayed against the race text; the only kind of result that scores on a leaderboard.
- **Unlock Order (Порядок відкриття)**: The fixed per-layout sequence in which keys are unlocked, following the finger map. A learner's unlocked set is always a prefix of it; the Diagnostic can only move the boundary forward.
- **Word Bank (Банк слів)**: The filtered, normalised words of one language from which Stage 2 and Academy exercises draw. Proper nouns are kept apart in a separate capitalisation bank used for Shift drills.
- **Difficulty Tier (Рівень складності слова)**: A 1–5 grade of a word from its frequency rank and length; same-finger transitions and row changes only order words within a tier.
- **Scale Catalogue (Каталог гам)**: The authored list of Stage 1 scales — type, fingers, size, tempo — whose text is generated from the finger map of each layout.

## Game Layer

- **Home (Головна)**: The hub a returning learner lands on; its one primary action is Continue, which starts the Next Action.
  _Avoid_: Today, dashboard, landing page
- **Map (Мапа)**: The whole curriculum drawn as one route through three regions (Stage 1, Stage 2, Stage 3), with weak-spot review and free practice always open from it.
  _Avoid_: Path, course list
- **Play Mode (Режим гри)**: The state while an attempt or race runs: navigation and the status bar leave the screen and only the run remains.
  _Avoid_: focus mode, fullscreen
- **Level (Рівень)**: A learner's standing derived from mastery alone (keys unlocked, Academy modules completed); speed never raises it.
- **Experience / XP (Досвід)**: Points earned only by Test Attempts that clear the level's accuracy floor; they fill the bar toward the next Level.
  _Avoid_: score, coins
- **Streak (Серія)**: Consecutive days with at least one completed attempt; one missed day is forgiven by a freeze.
- **Race Rating (Рейтинг перегонів)**: A learner's competitive standing computed from Validated Race Results only; it exists in races and nowhere else.

## Curriculum Data Model

The five nouns the code uses for the shipped curriculum data. Field-level detail lives in
the archived data model (`git show archive/process-harness-2026-09-30:specs/001-typing-core/data-model.md`); this is the naming.

- **Layout (Розкладка)**: One keyboard layout as data — its keys, its eight home anchors and its
  Unlock Order. Two exist: `yq` (ЙЦУКЕН, Ukrainian) and `qwerty` (English). A Layout is generated
  and shipped, never written at runtime.
  _Avoid_: keymap, keyboard, locale
- **Key (Клавіша)**: One physical key in a Layout, carrying its row, hand, exactly one finger, the
  character it produces plain and shifted, and its kind (letter, digit, punctuation, space,
  modifier). "Key" is always the physical key; the thing on screen is a **character**.
  _Avoid_: button, keycap (a keycap is the UI primitive that draws a Key)
- **Scale (Гама)**: One authored Stage 1 exercise definition — its generator type, Focus Element,
  fingers, size, optional tempo target and stated goal. **A Scale is not text**: text is produced
  from `(scale, unlocked set, seed)` by a pure function, so the same three inputs always give the
  same characters. The set of Scales for one Layout is the [Scale Catalogue](#attempts--adaptation).
  _Avoid_: lesson, drill, exercise (an *exercise* is a Scale already turned into text)
- **Level (Рівень)**: A band of the requirements' level table, holding an accuracy floor, an optional
  speed benchmark and a goal. The Level follows the **stage**, never the learner's speed, and speed
  never gates progression. In F1 only the `introduction` band is ever in force, so its floor — 95% —
  is the single threshold the Mastery Rule uses.
  _Avoid_: rank, tier (a *Difficulty Tier* grades a word, not a learner), grade
- **Settings (Налаштування)**: The learner's own preferences, stored with their progress: theme,
  motion, sound, typing text size, error mode, typing language, layout and interface language. The
  interface language is independent of the typing language — a learner may practise Ukrainian with
  an English interface.
  _Avoid_: preferences, config, options
