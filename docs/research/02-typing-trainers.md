# 02 Research: Leading typing trainers — mechanics, algorithms, UI/UX, code licenses

Ticket: `.scratch/typing-race-hackathon/issues/02-typing-trainers-teardown.md`
Date: 2026-09-13. Status: complete (research only; no app code). Branch: `research/02-typing-trainers`.

## 1. Summary

1. **The two open-source leaders cover opposite halves of our product.**
   - keybr is an *adaptive learning engine*: per-key confidence, unlock-when-all-confident, a focus key in every word, order-4 Markov pseudo-words, and server-authoritative races.
   - Monkeytype is a *best-in-class input loop and test*: `beforeinput`/`input` plus IME handling, an event log as the single source of truth, rich error modes, rhythm "consistency" metrics, and server plausibility checks.
   - Neither has a staged finger-scale curriculum, an n-gram/morpheme Academy, or a "one concrete next step" recommendation (§2.1, §2.2).
2. **Metric conventions converge on CPM/5 and keystroke accuracy.**
   - Speed is characters per minute; WPM = CPM/5 in Monkeytype, keybr, typing.com, 10FastFingers and Nitro Type.
   - Monkeytype counts accuracy over **every keystroke, including later-corrected ones**. keybr marks a character as a miss if a wrong key or Backspace happened before it. 10FastFingers penalizes corrections explicitly.
   - typing.com removed "Net WPM" because it rewarded speed over accuracy. This exactly matches the TZ philosophy (§2.8).
3. **Error handling is a menu, not a single rule.**
   - Free with Backspace; stop-on-letter; stop-on-word; no-Backspace ("confidence"); delete-on-error.
   - Instant death (TypeRacer) or at most one error (Klavogonki "Безошибочный").
   - Opposite-hand-Shift enforcement (Monkeytype), which directly supports the TZ §2 Shift rule.
4. **Both adaptive algorithms are per key; nobody adapts on bigrams.**
   - keybr: confidence = time at the target speed (default 175 CPM) / exponential moving average of time-to-type, with α = 0.1.
   - Monkeytype `weak-spot`: running average of inter-key ms, plus a 5 000 ms penalty per error, then best of 20 random words.
   - No studied product adapts on **bigram or transition** timing, so the TZ bonus "adaptive generator by slow bigrams" is unclaimed ground.
5. **Gating is accuracy-weighted everywhere pedagogy matters.** TypingClub uses stars with a *double penalty per error* and at least 1 star to proceed. typing.com gives up to 3 stars tied to accuracy. keybr, by contrast, gates on *speed*, which conflicts with the TZ rule that a beginner must never be blocked by an unreachable speed.
6. **Race mechanics worth copying as ideas:**
   - keybr: rooms of 5 with auto-matchmaking, 3 s wait then a 3-2-1 countdown, the server computing progress from per-character messages, spectator after 15 s idle.
   - Klavogonki: the car stops on a typo; ranks come from record CPM in bands of 100.
   - TypeRacer: points = words × words-per-second, with daily/weekly/monthly boards.
7. **Anti-cheat in practice is friction, not proof.**
   - An image-text verification test above a threshold: TypeRacer at 100 WPM (2008), 10FastFingers at 130 WPM, Klavogonki mandatory.
   - Server plausibility in Monkeytype: minimum 15 s / 10 words, accuracy ≥ 75%, result spacing, and key-timing statistics checked by a **private** module (the public repo has a stub).
8. **The accessibility bar is set by the education products.** typing.com claims WCAG 2.2 AA (no keyboard traps, visible focus, 400% reflow). TypingClub offers voice-over, a low-vision preset and 5 font sizes. Monkeytype honors `prefers-reduced-motion`.
9. **Ukrainian ЙЦУКЕН exists but is shallow.**
   - keybr and Monkeytype support `uk`; Ratatype has 19 lessons, TypingStudy 15 lessons, and KTouch a 2006 course of static drill text.
   - None found combines a staged finger curriculum, words restricted to unlocked letters, a Ukrainian n-gram Academy, per-transition feedback and races. That is our differentiation (§2.10).
10. **Licenses: study, re-implement, never copy.** keybr is **AGPL-3.0**, Monkeytype **GPL-3.0** and KTouch **GPL-2.0-or-later**. Copying their code *or their bundled word/model data* would force our hosted app under a copyleft license; clean-room re-implementation of the ideas is fine (§2.1, §2.2, §6).

## 2. Per-product findings

### 2.1 Monkeytype (open source)

Read at `monkeytypegame/monkeytype` commit `91bd24bb8513785c7364cbea29296ff7adafac41` (shallow clone, 2026-09-13). Paths are relative to the repo root; `ts/` = `frontend/src/ts/`.

**Pedagogy and progression.** None in the curriculum sense. Monkeytype is a customizable *test*: modes `time`, `words`, `quote`, `custom` and `zen`, plus "funbox" modifiers. There is no key unlocking and no lessons. The only adaptive element is the `weak-spot` funbox (below). The test starts on the first typed character: `if (!isTestActive()) TestLogic.startTest(now)` (`ts/input/handlers/insert-text.ts` L207–210).

**Input handling and input-lag avoidance.**
- **Listeners** (`ts/input/listeners/input.ts` L24–159):
  - Input goes through one hidden `<input>` element and two listeners.
  - `beforeinput` gates: it `preventDefault`s unsupported input types and blocked deletes.
  - `input` processes the character with a `performance.now()` timestamp taken at the top of the handler (L104).
  - IME composition events are handled separately (`ts/input/listeners/composition.ts`), with a Firefox special case (L69–72).
- **Normalization** (`insert-text.ts` L137–205):
  - Multi-character `data` is split and replayed one character at a time.
  - Visually equal characters are normalized to the target character (e.g. `…` → `...`, Dutch `ĳ`).
- **Event log as the single source of truth.** Every insert and delete is appended to a test event log. "the UI, live stats and replay all derive the current input from the event log — editing the input element without logging would desync them" (`insert-text.ts` L77–83, L279–296). All result statistics are pure functions over that log (`ts/test/events/stats.ts`). That makes them deterministic and unit-testable, and it enables replay (`ts/test/replay-ui.ts`).

**Error modes** (all opt-in settings):
- **`stopOnError: off | letter | word`.**
  - `letter`: the wrong character is not inserted, but it is still logged as `correct: false`, so it still costs accuracy (`insert-text.ts` L232–242).
  - `word`: the learner cannot move to the next word while it contains errors (`ts/input/helpers/validation.ts` L71–75).
  - A personal best with `stopOnError: letter` is only allowed at 100% accuracy (`ts/test/result.ts` L591–593).
- **`confidenceMode: off | on | max`** (`ts/input/handlers/before-delete.ts` L55–73).
  - `on`: blocks backspacing into the previous word.
  - `max`: blocks Backspace entirely.
  - Even with `off`, backspacing into an already *correct* previous word is blocked; `freedomMode` lifts that (L50–53).
- **`deleteOnError: letter | word | letter_hard | word_hard`.** On a wrong key, deletes the wrong character *and the one before it* "so that a mistake actually costs progress". The hard variants send the learner back a word (`insert-text.ts` L84–131).
- **`oppositeShiftMode`.** Rejects a capital typed with the same-hand Shift and shows a reminder after 5 in a row (`insert-text.ts` L216–256). This maps directly onto the TZ §2 rule "Shift with the opposite pinky".
- **`blindMode`.** Hides errors while typing (L238).
- **Fail conditions.** `difficulty` and `min burst` settings can fail the test mid-run (L342–373).

**Metric formulas.**
- **WPM.** `calculateWpm(chars, s) = chars / 5 / (s / 60)` (`ts/utils/numbers.ts` L153–159).
  - `wpm` uses `chars.correctWord`: characters of correctly typed words, including their spaces.
  - `raw` uses `allCorrect + incorrect + extra` (`ts/test/test-logic.ts` L764–767).
- **Accuracy** = correct insert events / all insert events × 100, over the whole event log (`ts/test/events/stats.ts` L550–584). A wrong keystroke later fixed with Backspace still counts as incorrect, which satisfies the TZ rule.
- **Consistency.**
  - `consistency = kogasa(stddev/mean of per-second raw speed)`, with `kogasa(c) = 100·(1 − tanh(c + c³/3 + c⁵/5))` (`packages/util/src/numbers.ts` L74–84; `test-logic.ts` L725–732).
  - `keyConsistency` applies the same mapping to inter-key intervals; `wpmConsistency` applies it to per-second WPM (L734–754).
  - This is a ready-made "rhythm unevenness" metric that meets TZ §4.3 "нерівномірність ритму".
- **Stored per result:**
  - raw inter-keydown spacing `keySpacing`, press duration `keyDuration`, `keyOverlap` (rollover), `afkDuration`, `startToFirstKey`, `lastKeyToEnd`;
  - per-second `wpm`, `burst` and `err` series (`test-logic.ts` L756–803; `stats.ts` L586–899).

**Adaptation: the `weak-spot` funbox** (`ts/test/weak-spot.ts`):
- **Per-character score.** Each character has a running-average score over roughly its last 50 occurrences (`perCharCount = 50`). The sample is the inter-key interval in ms, plus **5 000 ms if the key was wrong**.
- **Word choice.** The next word is the highest-scoring of 20 random dictionary words, where a word's score is the mean of its characters' scores.
- **Take-away.** A cheap, testable weak-key word selector of this kind is directly transferable, as an idea, to TZ §3.2 "добір слів адаптується до фактичних помилок і повільних переходів".

**Feedback and analytics.**
- **Result screen:** WPM, raw, accuracy, consistency and a per-second chart (WPM, raw, errors).
- **After the test:** a word-level "burst heatmap" over the words history (`ts/test/test-ui.ts` L1448–1544), a replay, and a PB crown (`ts/test/pb-crown.ts`).
- **During the test:** a *pace caret* racing against your PB, last 10 average, daily best, custom speed or last test (`ts/test/pace-caret.ts` L70–100).
- **Gaps.** No per-key/per-bigram dashboard and no "next step" recommendation were found in `ts/test/`. `practise-words.ts` offers retraining of missed or slow words.

**Caret, motion, themes.**
- The caret moves with optional animation: `animate: Config.smoothCaret !== "off"` (`ts/test/caret.ts` L37–45), with selectable caret styles.
- `prefers-reduced-motion` is respected in CSS (`frontend/src/styles/media-queries.scss` L44, `styles/test.scss` L479) and in JS animation timing (`ts/utils/misc.ts` L496–500).
- Themes are a first-class feature (theme settings, `frontend/static/themes`). Everything is reachable from a keyboard command line (`ts/commandline/`).

**Anti-cheat** (server, `backend/src/api/controllers/result.ts` L196–438):
- **Minimum test length.** Rejects tests under 15 s or under 10 words (`backend/src/utils/validation.ts` L3–26).
- **Low accuracy.** Rejects results under 75% accuracy for leaderboard users (L218–220).
- **Result hash.** Compares an `object-hash` of the result with a client-sent hash (L222–241); this is tamper friction only.
- **Result spacing.** Rejects a result that arrives sooner than the last result plus the test duration (L328–358).
- **Key-timing check.** For time tests above 130 WPM from unverified users, requires key spacing and duration stats and runs `validateKeys`, which can auto-ban (L360–409).
- **Duplicate results.** Rejects duplicate hashes (L425–438).
- **The real heuristics are not public.** `backend/src/anticheat/index.ts` is a stub whose `validateResult` and `validateKeys` return `true`.
- **Lesson for us:** client-computed results are inherently forgeable. Plausibility checks plus timing-distribution checks are the practical ceiling.

**Multiplayer history.** None in production code.
- GitHub issue #255 "Multiplayer" is still open, with the body "Moved checklist to Tribe project" (`gh api repos/monkeytypegame/monkeytype/issues/255`).
- The code has only the comment `//this will be used in tribe` (`ts/events/navigation.ts` L7).
- A dev build is referenced at `dev.monkeytype.com/tribe`. Its production status is UNVERIFIED.

**Ukrainian.** Word lists `ukrainian`, `ukrainian_1k`, `_10k`, `_50k` and `ukrainian_endings`, plus Latynka variants (`frontend/static/languages/`), and a `ukrainian` layout (`frontend/static/layouts/ukrainian.json`). The `ukrainian_1k` list starts "і, на, у, в, не, що…" (frequency-ordered).

**Onboarding and accessibility.**
- No onboarding: the test page is the home page.
- Accessibility beyond reduced motion, keyboard command line and themes was not audited — UNVERIFIED.

**License verdict.** GPL-3.0 (`LICENSE`): study it and re-implement freely, copy nothing. Shipping copied frontend code as browser JS would pull our app under GPL-3.0; the same caution applies to its bundled word lists. The formulas themselves (`chars/5/min`, keystroke accuracy, CoV consistency) are common conventions and safe to implement ourselves.

### 2.2 keybr.com (open source)

Read at `aradzie/keybr.com` commit `541eb0a5f010ead7ce4c580c0bb0d5bb2519185c` (shallow clone, 2026-09-13). Paths below are relative to `packages/`.

**Pedagogy and progression.** keybr is a pure adaptive trainer: no fixed curriculum, no finger drills. The learner starts with a small letter set; every generated word must contain the current *focus* letter. A new letter unlocks once all current letters are fast enough. The in-app help says: "When your typing speed improves, and all the letters finally become green, a new letter 'S' is added to the set… Letter 'S' is the target letter and appears in every generated word." It also expects regression: "it is very likely that the typing speed of the previous letters will degrade… your goal is still the same, to make the new target letter green to unlock the next one" (`page-help/lib/HelpPage.tsx` L135, L163).

**Unlock and adaptation algorithm** (`keybr-lesson/lib/guided.ts` L41–108):
1. **Letter order.** Letters are ordered by frequency in the language model (`Letter.frequencyOrder`), or by keyboard-weighted frequency if `keyboardOrder` is on (L131–141).
2. **Minimum set.** The first 6 letters are always included (`minSize = 6`). The optional `alphabetSize` setting forces up to all letters (L47–70).
3. **Unlock rule.** Every letter whose `bestConfidence ≥ 1` stays included. The next locked letter is added only when **every** included key has `bestConfidence ≥ 1`. With the `recoverKeys` option, the current `confidence` is used instead, so a key that has regressed blocks further unlocks (L72–92).
4. **Focus rule.** The focus key is the included key with the lowest confidence below 1 (L95–105).
5. **Confidence.** `confidence = timeFor(targetSpeed) / timeToType` (`keybr-lesson/lib/target.ts` L15–23). The default target speed is **175 CPM**, configurable 75–750 (`keybr-lesson/lib/settings.ts` L60).
6. **Per-key time model** (`keybr-result/lib/keystats.ts` L106–151):
   - Each lesson yields, per code point, `hitCount`, `missCount` and the mean `timeToType` of *correct* hits only (`keybr-textinput/lib/histogram.ts` L52–93).
   - Samples faster than 40 ms or slower than 12 000 ms are discarded as invalid (L96–106).
   - `timeToType` is an exponential moving average, `makeFilter(0.1)`, over lessons; `bestTimeToType` is the minimum of that filtered value.
7. **Learning-rate forecast** (`keybr-lesson/lib/learningrate.ts`):
   - Fits a polynomial to the last 30 per-key samples: linear, quadratic above 10 samples, cubic above 20.
   - If R² ≥ 0.5, it reports the slope and the number of lessons remaining until the target speed (within 50).
   - The daily goal defaults to 30 minutes (`settings.ts` L61).

**Exercise generation.**
- **Word supply** (`guided.ts` L110–161, `keybr-phonetic-model/lib/filter.ts`):
  - With `naturalWords` on (the default), up to 1 000 real dictionary words are picked, each built only from included letters and containing the focus letter.
  - Words of 2 letters or fewer are dropped (L30–34).
  - If fewer than 15 words qualify, phonetic pseudo-words fill the gap.
- **Pseudo-words.** They come from an **order-4 Markov transition table** over the alphabet plus space (`keybr-generators/lib/generate-languages.ts` L40). The table is built from a `word,frequency` CSV per language (`docs/custom_language.md`). The help page describes the aim as "random but readable and pronounceable words, using the phonetic rules of your native language… it's almost impossible for the letter 'W' to follow the 'Z'" (`HelpPage.tsx` L48).
- **Options.** Capitals, punctuation (probabilities 0–1) and word repeats are optional (`settings.ts` L57–59).
- **Other lesson types.** Word list (top-N words), books, custom text, numbers (with a Benford's-law option) and code syntax (`settings.ts`).

**Error modes** (`keybr-textinput/lib/textinput.ts`):
- The three flags are `stopOnError`, `forgiveErrors` and `spaceSkipsWords` (L31–52).
- **Wrong key.** It sets a `typo` flag. Without stop-on-error, the wrong characters go to a visible "garbage" buffer (L189–204).
- **Backspace.** `clearChar` and `clearWord` also set `typo = true` (L125–138). The next correct character is therefore recorded as a **miss even though the user corrected it**. This matches the TZ rule that corrected errors still count.
- **`forgiveErrors`.** Accepts the correct character after a replaced or skipped one, returning `Feedback.Recovered` (L205–209).

**Metric formulas** (`keybr-textinput/lib/stats.ts`, `keybr-result/lib/speedunit.ts`):
- `speed (CPM) = length / (time_ms/1000) × 60`, where `length` is the number of steps. The timer starts at the first keystroke: "The trigger step is ignored" (L28).
- `errors` = the number of steps with `typo`.
- `accuracy = (length − errors) / length`.
- WPM = CPM × 1/5; CPS = CPM/60; WPS = CPM/300.

**Analytics.**
- Per-key speed, confidence and learning-rate charts.
- Key-frequency heatmap (`keybr-chart/lib/KeyFrequencyHeatmap.tsx`) and a keyboard heatmap layer (`keybr-keyboard-ui/lib/HeatmapLayer.tsx`).
- Daily stats (`keybr-result/lib/dailystats.ts`).
- No per-bigram statistics model was found in `keybr-result` (it has key stats only). The bigram effect is indirect, through the phonetic model.

**Race and lobby mechanics** (`keybr-multiplayer-server/lib/room.ts`, `game.ts`):
- **Matchmaking.** Automatic: a player joins the first room with fewer than 5 players, otherwise a new room is created (`game.ts` L39–50, `room.ts` L35, L67–69). When only 1 player is left, the room is rebalanced into another open room (L118–130).
- **Start.** A new game is scheduled 3 s after at least 2 players are present. The server picks a random quote, broadcasts the text, then counts down 3-2-1 at 1 s steps (L228–273).
- **Late joiners and idle players.** Players who join while a game is running become spectators (L99–105). An inactive player becomes a spectator after 15 s without input and is kicked after 180 s without activity (L133–157).
- **Server-authoritative progress.** The client sends one `PLAYER_PROGRESS` message per character. The server feeds it into its own `TextInput` and computes offset, CPM and errors from server timestamps (L181–198, L416–427). Clients never report speed, which is the main anti-cheat property.
- **Handshake.** Checks only a magic signature (L80). The session carries `AnyUser` (`types.ts` L7–9); that anonymous play is allowed is inferred from the type name — UNVERIFIED.
- **Ranking.** No rank or MMR system was found; per-player `gamesCompleted` and `gamesWon` are tracked. A separate high-scores package exists (`keybr-highscores`).

**Ukrainian support.**
- A `UK` language with alphabet `абвгґдеєжзиіїйклмнопрстуфхцчшщьюя` (`keybr-keyboard/lib/language.ts` L191–195).
- A `uk_ua` layout (`keybr-keyboard/lib/layout/uk_ua.ts`), a phonetic model (`keybr-phonetic-model-loader/lib/assets.ts` L33) and a word list (`keybr-content-words/lib/data/words-uk.json`).
- UI translation (`keybr-intl/lib/messages/uk.json`).

**Onboarding, UX, accessibility.**
- No placement test: the learner starts typing immediately. The help page explains the key-set indicator (gray for unknown, red to green for confidence).
- Sounds (`keybr-textinput-sounds`), themes and a theme designer (`keybr-themes`, `keybr-theme-designer`).
- A11y specifics were not audited in code — UNVERIFIED.

**License verdict.** AGPL-3.0 (`LICENSE`; README L39–41). Study it and re-implement the ideas — confidence = target time / EMA time, unlock when all keys are confident, focus the weakest key, Markov pseudo-words — but copy no code and none of the generated data (`model-uk.data`, `words-uk.json`), since AGPL would bind our hosted app and oblige us to publish its source.

> Closed products (2.3–2.9): only public behavior, official posts and help pages were used. Several help centers returned HTTP 403, 402 or a JS-only "Loading…" page to the fetcher. A claim resting only on a search-engine snippet of an official page, or on a fan wiki, is marked as such. Anything with no source at all is marked UNVERIFIED.

### 2.3 TypeRacer

- **Pedagogy and progression.** None. Users race on passages (quotes). Progression is social: skill levels and experience levels.
- **Error modes.**
  - Standard races let the user continue after errors. The exact rule (whether a typo must be fixed before the word counts) is UNVERIFIED.
  - *Instant Death Mode*: "a single typo will kick you out of the race" (TypeRacer Blog, "Accuracy Matters", 2010).
- **Metric formula.** WPM uses the 5-characters-per-word convention. This appears only in a user comment under the official blog post ("TypeRacer is 5 characters per word"); no help-center statement was found, so the exact formula is UNVERIFIED.
- **Points and competitions.** "the number of words typed multiplied by typing speed (in words-per-second)". Leaderboards rank "most points earned today, this week, this month, and this year" (TypeRacer Blog, "Introducing points and competitions", 2017). Rationale: slower typists who race more can still rank.
- **Skill levels and matchmaking.** Six skill levels (Beginner, Intermediate, Average, Pro, Typemaster, Megaracer) based on average WPM. Players are matched with similar skill, but not strictly. Source: search snippet of the TeachMe help-center article (direct fetch returned 403). Thresholds are UNVERIFIED. The experience level is based on the number of races completed.
- **Anti-cheat.**
  - 2008 original: "everyone who gets a score higher than 100 wpm has to pass a typing test". The test shows text **as an image** ("a randomly-generated Star Trek plot summary"), and the user must score "not less than 20 wpm below" the race score. Passing grants clearance up to +20 WPM (TypeRacer Blog, "No More Cheating", 2008-05-18).
  - Later version per the fan wiki: typing within 25% of the race WPM certifies the user, and re-testing happens only above certified + 25% (TypeRacer Fandom wiki, secondary).
- **Onboarding, UX, a11y.** Guests can race without an account (UNVERIFIED). Accessibility is not documented (UNVERIFIED).
- **License.** Proprietary. Only behavior may be studied; there is nothing to copy.

### 2.4 Nitro Type

- **What it is.** A school-oriented racing game with cars, cash, teams and weekly leagues. The official site has `/leagues`, `/friends` and `/stats` pages (nitrotype.com page titles). Typing.com hosts "Nitro Type Lessons" (typing.com lesson 377), which suggests a shared owner (UNVERIFIED).
- **Metric formulas** (secondary sources only; official support page is JS-only):
  - WPM = characters per minute / 5, where characters include spaces and punctuation.
  - Accuracy = correct keystrokes / total keystrokes.
  - Race points = `(100 + WPM/2) × accuracy`, e.g. 60 WPM at 95% gives 123 (nitrotype.net, unofficial fan site; UNVERIFIED).
- **Error mode.** "If you hit the wrong key, your car stops instantly… you cannot move forward until you fix the error" (nitrotype.net, unofficial; UNVERIFIED). This is a stop-on-error racing model, like Klavogonki.
- **Race mechanics.** Race size, countdown and anti-cheat are UNVERIFIED (not retrievable from official pages). "Nitros" are a consumable that auto-completes a word. The fan wiki notes a nitro can cost "roughly 1–3 WPM" through packet timing (Nitro Wiki, secondary).
- **License.** Proprietary. Study only.

### 2.5 Klavogonki (klavogonki.ru)

- **What it is.** A Russian-language racing trainer. The site's own wiki ("Клавопедия") documents its rules.
- **Speed and error model.**
  - Speed is measured in characters per minute (зн./мин).
  - "В случае, если допущена ошибка, машина участника останавливается" — the car stops on a typo until it is fixed. Error % is shown but not used for rank (ru.wikipedia "Клавогонки").
  - The speedometer shows instantaneous speed computed from recent keystrokes (Klavogonki FAQ).
- **Modes** (Клавопедия, "Режимы"). Statistics are kept separately per mode.
  - Обычный: book quotes.
  - Безошибочный: "можно допустить максимум одну ошибку. При второй опечатке игрок дисквалифицируется".
  - Абракадабра: pseudo-words generated from a frequency dictionary while keeping word structure.
  - Буквы: random letters.
  - Цифры: digits.
  - Спринт: one fixed text per day.
  - Марафон: whoever types the most in 5 minutes wins.
  - Яндекс.Рефераты: generated coherent text.
  - По словарю: user-made vocabularies.
- **Ranks** (Клавопедия, "Ранги"). Based on the *record* in Обычный: Новичок 0–99, Любитель 100–199, Таксист 200–299, Профи 300–399, Гонщик 400–499, Маньяк 500–599, Супермен 600–699, Кибергонщик 700–799, Экстракибер 800+ зн/мин. Each rank comes with a car.
- **Lobby.** "необходимо создать заезд или выбрать уже созданный" — create a race or join an open one (ru.wikipedia). Countdown and room size are UNVERIFIED.
- **Anti-cheat** (Клавопедия, "Читеры").
  - A mandatory image test gates results into statistics.
  - "Результаты в 700 зн/мин или выше у не известных до этого игроков вызывают подозрения"; above 1500 зн/мин is treated as certain cheating.
  - Graph analysis looks for spikes ("фонари"), abnormally flat results and implausible cross-mode results (e.g. 600+ in Буквы). Manual review and bans follow, "не всегда своевременно".
- **Ukrainian texts.** Possible via user vocabularies. The existence of maintained Ukrainian vocabularies is UNVERIFIED.
- **License.** Proprietary. Study only. It is a Russian service, which makes it unsuitable as a reference brand for a Ukrainian audience (product judgment, not a sourced claim).

### 2.6 TypingClub (edclub)

- **Pedagogy.** A fixed, long lesson path; each lesson has a defined minimum speed and accuracy. Source: search-engine snippets of the official help docs (`s.typingclub.com/docs/…/results-page.html`, `adjust-student-difficulty.html`); direct fetch returned 403. The details are:
  - "Stars are awarded based on a student's performance in each lesson and are used to control whether the student can move on to the next lesson, or must retry for a better score. By default, students must earn at least 1 star to move to the next lesson."
  - "their accuracy and WPM are sent to a calculation engine which produces an overall score. The scoring system is optimized to value accuracy over speed. There is a double-penalty in the score's accounting for every error."
  - "The implied accuracy goal is always 100%." A "Perfect Score" (blue ribbon) requires roughly 2.5× the lesson's WPM goal with near-perfect accuracy.
- **Configurability.** "Everything about lessons in TypingClub, including text, score system, use of backspace, and speed requirements is configurable" (search snippet of `m.typingclub.com/docs/class-management/class-settings.html`).
- **Accessibility** (search snippet of the official `accessibility-features.pdf`; direct fetch 403):
  - "Voice Over" reads the lesson text word by word and adapts to the student's speed.
  - The "Low Vision" profile sets large font, fully guided voice-over and games off.
  - 5 font sizes, including an extra-large accessible font; high contrast when combined with the dark theme.
  - Works with JAWS; claims WCAG 2.0.
- **UX.** Video intros, hand/finger guides and a virtual keyboard per lesson — UNVERIFIED (not retrievable from official docs in this session).
- **License.** Proprietary. Study only.

### 2.7 Ratatype

- **Ukrainian course.** "Ukrainian keyboard typing practice: 19 lessons" on ЙЦУКЕН, with a separate macOS-layout course (ratatype.com/courses/ukrainian/, /courses/ukrainian-mac/). The course page gives no key order or pass criteria (UNVERIFIED).
- **Certificate.** The official FAQ gives only the process: "Complete the form to register. Pass the typing test to achieve the certification." (ratatype.com/faq/How-can-I-get-a-typing-certificate/). A search snippet adds that the certificate "is given for the best result measured in both speed and accuracy". Test duration and thresholds are UNVERIFIED.
- **Teacher features and themes.** The FAQ index lists "How to create a group typing class?" and a dark-theme question (ratatype.com/faq).
- **Metric formulas.** UNVERIFIED (answer pages not retrieved).
- **License.** Proprietary. Study only.

### 2.8 typing.com

- **Metric formula.** "Words Per Minute is the number of characters — including spaces and punctuation — typed in one minute, divided by five."
- **Net WPM removed.** Net WPM (WPM × accuracy) was dropped "as it motivated typists to focus too heavily on their WPM while ignoring their accuracy, leading to more mistakes and inevitably lower overall WPM". Speed and accuracy are shown separately ("Slow down to go faster!") (typing.com blog, "What is Words per Minute").
- **Progression.** Up to three stars per lesson, tied to accuracy; lessons can be repeated. Teachers can set a minimum number of stars before moving on (search snippet of support.typing.com article 9047233).
- **Accessibility** (typing.com/accessibility):
  - "Aligning with WCAG 2.2 AA guidelines".
  - Labels and roles for key interactive elements; mitigates redundant screen-reader announcements.
  - "No keyboard traps"; "Superior focus visibility".
  - Sufficient contrast; reflow up to 400% zoom; a VPAT is available.
- **License.** Proprietary. Study only.

### 2.9 10FastFingers

All points below are from 10fastfingers.com/faq.
- **Metric formula.** "5 keystrokes equal 1 WPM", computed from *correct* keystrokes including spaces; only correctly typed words count. Capitals and dead-key accented characters count as multiple keystrokes.
- **Accuracy in text practice.** Correct entries / (correct entries + corrections) × 100. Example: 500 keystrokes with 25 corrections gives 95.23%. Corrections are penalized even though the final text is right.
- **Anti-cheat.** Results above **130 WPM** per language must be unlocked with an anti-cheat test (an image of text). Results older than 24 h cannot be unlocked.
- **Competitions.** Tie-break order: higher CPM, then fewer wrong words, then fewer corrections, then earlier timestamp.
- **Languages.** 41+ languages, including Ukrainian.
- **License.** Proprietary. Study only.

### 2.10 Trainers supporting Ukrainian ЙЦУКЕН

| Trainer | Platform / license | Ukrainian support found | Mechanics notes | Source |
|---|---|---|---|---|
| keybr.com | Web, AGPL-3.0 | Full: `uk` language, `uk_ua` layout, phonetic model, word list, UI translation | Adaptive unlock by per-key confidence; pseudo-words | Code (§2.2) |
| Monkeytype | Web, GPL-3.0 | Word lists 1k/10k/50k, endings, Latynka; `ukrainian` layout | Test, not curriculum | Code (§2.1) |
| Ratatype | Web, proprietary | 19-lesson ЙЦУКЕН course + macOS variant | Certificate, teacher groups | ratatype.com/courses/ukrainian/ |
| TypingStudy | Web, proprietary | 15-lesson Ukrainian course starting from "Основний ряд" | Shows characters, progress, speed, errors, accuracy, virtual keyboard; flow "Нові клавіші → Клавіші → words" | typingstudy.com/uk-ukrainian-2/lesson/1 |
| 10FastFingers | Web, proprietary | Ukrainian typing test | 1-min test | 10fastfingers.com/faq |
| KTouch (KDE) | Desktop, GPL-2.0-or-later (repo `LICENSES/`) | `data/courses/ua.xml`, "Уроки для ktouch українською… 2006… Янович Борис" | Two new characters per lesson ("Урок 1 (а та о)", "Урок 2 (в та л)"); static pre-generated random drill text | `gh api repos/KDE/ktouch/contents/data/courses/ua.xml` |
| Stamina | Desktop + web (`staminaon.ru/uk/`) | Ukrainian lessons claimed | Details UNVERIFIED (fetch 403) | search snippet |
| VerseQ | Desktop, proprietary | RU/EN/UA lessons claimed | Adaptive to user errors and "problematic" combinations, "does not punish" mistakes — UNVERIFIED (secondary blogs only) | secondary |
| Соло на клавіатурі | Desktop, proprietary | RU/EN courses; Ukrainian reportedly absent as of 2020 — UNVERIFIED | Strictly sequential ~100 levels | secondary |
| Тиканка (`ed-info.github.io/tykanka`) | Web | Page rendered a QWERTY board and the error "Щось не так, має бути вправа"; `repos/ed-info/tykanka` not found via GitHub API | UNVERIFIED | fetch |

**Finding.** In this search, no Ukrainian-capable web trainer combines all of the following:
- (a) a staged finger-scale curriculum for ЙЦУКЕН;
- (b) word exercises restricted to unlocked letters;
- (c) an n-gram/morpheme "Academy";
- (d) per-transition analytics with a concrete next step;
- (e) live races.

keybr covers (b) and part of (d); Ratatype and TypingStudy cover a linear (a); nobody covers (c) for Ukrainian. That gap is where our product is differentiated.

## 3. Comparison table

U = UNVERIFIED; "snippet" = only a search-engine snippet of an official page was available.

| Product | License | Progression / gating | Adaptation | Exercise generation | Error modes | Speed / accuracy formula | Analytics | Races & ranks | Anti-cheat | Ukrainian |
|---|---|---|---|---|---|---|---|---|---|---|
| **Monkeytype** | GPL-3.0 | None (tests) | `weak-spot`: per-char average of inter-key ms, +5 000 ms per error, best of 20 words | Frequency word lists, quotes, custom, funboxes | off / stop-letter / stop-word; confidence on/max; delete-on-error ×4; opposite Shift; blind; freedom | WPM = correct-word chars /5 /min; raw = all typed; acc = correct keystrokes / all keystrokes | Per-second WPM/raw/errors, consistency (CoV → `kogasa`), key spacing/duration/overlap, burst heatmap, replay, pace caret | None in prod (Tribe in dev) | Server: min length, acc ≥ 75, hash, result spacing, key-timing stats (private module), autoban | Word lists + layout |
| **keybr** | AGPL-3.0 | Unlock when all included keys reach confidence ≥ 1 (speed-based) | Confidence = target time / EMA(time) with α = 0.1; focus = weakest key; learning-rate regression | Dictionary words from unlocked letters containing the focus key; order-4 Markov pseudo-words fallback | stopOnError, forgiveErrors, spaceSkipsWords; Backspace marks a miss | CPM = steps/s × 60; acc = (steps − typo steps) / steps; WPM = CPM/5 | Per-key speed/confidence, learning rate, heatmaps, daily goal | Auto rooms of 5, 3 s + 3-2-1, server-authoritative; no ranks | Server computes progress; sample window 40 ms–12 s | Full (model, words, layout, UI) |
| **TypeRacer** | Proprietary | None | None | Quotes | Standard (U); Instant Death | 5 chars/word (U) | Race history (U) | Skill-level matchmaking (snippet); points = words × WPS; periodic competitions | Image typing test > 100 WPM, clearance +20 WPM (2008) | U |
| **Nitro Type** | Proprietary | None | None | Passages (U) | Car stops until typo fixed (fan site, U) | CPM/5; acc = correct/total keystrokes (fan site) | U | Leagues, teams, friends; points (100 + WPM/2) × acc (fan site, U) | U | U |
| **Klavogonki** | Proprietary | Ranks from record CPM | None | Quotes, Абракадабра pseudo-words, letters, digits, user vocabularies | Car stops on error; Безошибочный (≤ 1 error) | зн/мин; error % shown, not ranked | Per-mode stats, speed graphs | Create/join заезд; 9 modes; 9 rank bands of 100 CPM | Mandatory image test; > 700 suspicious, > 1500 cheat; graph and manual review | Via user vocabularies (U) |
| **TypingClub** | Proprietary | Stars; ≥ 1 star to proceed; per-lesson min speed & accuracy (snippet) | U | Fixed lesson texts; configurable | Backspace use configurable (snippet) | Score engine; double penalty per error (snippet) | Results page (snippet) | None | n/a | U |
| **Ratatype** | Proprietary | 19-lesson UA course; certificate via test | U | Fixed lessons | U | U | U | Teacher groups | n/a | Yes (course) |
| **typing.com** | Proprietary | ≤ 3 stars tied to accuracy; teacher min stars (snippet) | U | Fixed lessons | U | WPM = chars incl. spaces /5 /min; Net WPM removed | Achievements (snippet) | (Nitro Type sibling, U) | n/a | U |
| **10FastFingers** | Proprietary | None | None | Frequent-word 1-min tests, text practice | Word-based | WPM = correct keystrokes /5 /min; acc = correct / (correct + corrections) | Correct/wrong keystrokes | Competitions with tie-break CPM → wrong words → corrections → time | Image test > 130 WPM per language | Yes (test) |
| **KTouch** | GPL-2.0+ | Linear lessons | None | Static pre-generated drill text | U | U | U | None | n/a | Yes (2006 course) |

**Accuracy denominators differ and must be chosen deliberately.** Monkeytype counts *each wrong keystroke*. keybr counts *each target character with any prior typo* (several wrong presses on one character = 1 miss). 10FastFingers counts *corrections*. The TZ wording "точність за всіма натисканнями, включно з виправленими помилками" matches the Monkeytype definition.

## 4. Best-of practices mapped to TZ criteria

### Pedagogical integrity (30)

- **P1 — Accuracy-first gating.**
  - Pass an exercise only with accuracy ≥ the level floor (TZ table 95–98%) on **3 consecutive attempts** (TZ §4.3).
  - Score errors heavier than speed, borrowing TypingClub's "double penalty per error" idea (§2.6).
  - Never gate the beginner level on speed: keybr's speed-based unlock (§2.2) is the anti-pattern here.
- **P2 — Focus element in every item.** Every generated word or line must contain the exercise's target key, finger or transition, and unlock waits until every earlier element is stable (keybr `Filter.focusedCodePoint` and the all-keys ≥ 1 rule, §2.2). Apply this to *transitions* as well as keys, in the TZ order keys → pairs → morphemes → words.
- **P3 — Enforce the opposite-hand Shift rule.** An optional check rejects a same-hand Shift and reminds after repeated misuse (Monkeytype `oppositeShiftMode`, §2.1). This gives TZ §2 a measurable signal.
- **P4 — Error-mode ladder per stage.**
  - Stage 1 scales: stop-on-letter; the error is shown and counted and the caret does not advance (Monkeytype `stopOnError: letter`).
  - Stages 2–3: free Backspace, with corrected errors still counted.
  - Tempo series and races: an optional "error-free" variant (Klavogonki Безошибочный, TypeRacer Instant Death).
- **P5 — Mode analogues for the TZ ladder.** Klavogonki's Буквы / Абракадабра / Цифры / Марафон map onto the TZ ladder: keys, labelled mechanics pseudo-words, numbers, and tempo/endurance series (§2.5).

### Reliability (20)

- **R1 — Event log as the single source of truth.** Every keystroke becomes an immutable event with a `performance.now()` timestamp. CPM, accuracy, per-key and per-transition stats, rhythm and replay are all pure functions of that log (Monkeytype `events/stats.ts`, §2.1). This gives deterministic Vitest fixtures (TZ §8 items 1–2) and Playwright assertions on replay.
- **R2 — Robust input path.** A hidden `<input>` with `beforeinput` gating and `input` processing, explicit IME/composition handling, splitting of multi-character `data`, and rejection of unsupported `inputType`s (Monkeytype `listeners/input.ts`). This is how TZ §4.2 "Alt/IME/dead key must not break the session" is met in practice.
- **R3 — Sample sanity.** Discard key intervals below 40 ms or above 12 s from timing statistics (keybr `histogram.ts`). Track AFK time separately (Monkeytype `afkDuration`).
- **R4 — Authoritative race progress.** The authority computes progress from keystrokes; clients never report speed (keybr `room.ts`).

### Dictionaries & exercise algorithm (15)

- **D1 — Word filter.**
  - Allowed only if every character is unlocked and the word contains the focus element.
  - Rank by frequency and cap at the top N; drop words below a minimum length (keybr `guided.ts`: top 1 000 words, length > 2).
  - When too few words qualify, keybr silently mixes in pseudo-words. We must **not**: TZ §3.2 allows pseudo-words only in explicitly labelled mechanics exercises.
- **D2 — Labelled mechanics pseudo-words** from an order-n Markov chain over the licensed `word + frequency` dictionary (keybr order 4; Klavogonki Абракадабра).
- **D3 — N-gram weights** as the sum of word frequencies (TZ §3.3). No competitor exposes this; it underpins the Academy.
- **D4 — Weak-spot sampling fallback.** When bigram data is sparse, pick the best of N candidate words by mean per-character weakness score (Monkeytype `weak-spot.ts`).

### UX & accessibility (15)

- **U1 — Start on the first typed character** (Monkeytype `insert-text.ts` L207; TZ §4.2).
- **U2 — Optional pace caret / ghost of the personal best** (Monkeytype `pace-caret.ts`). It makes the TZ "comparison with personal best" tangible. It must be motion-toggleable.
- **U3 — Motion safety.** Smooth caret behind a setting, plus `prefers-reduced-motion` support (Monkeytype `caret.ts`, `media-queries.scss`).
- **U4 — Keyboard-first command palette** (Monkeytype `commandline/`). Supports TZ §6 "all main actions from the keyboard".
- **U5 — Accessibility checklist.**
  - From typing.com: no keyboard traps, visible focus, reflow to 400%, labelled roles.
  - From TypingClub: a low-vision preset (large font, high contrast, games/motion off) and several font sizes. TZ requires at least 24 px exercise text.
- **U6 — Key-set indicator** (gray = unknown, red→green = confidence) on the lesson map *outside* test attempts (keybr help page). It shows progress without acting as a peeking aid.

### Analytics & adaptation (10)

- **A1 — Per-key and per-transition EMA timing** with hit/miss counts (keybr `keystats.ts`), extended to bigrams and same-finger/row-change transitions. This is our differentiator (§1 item 4).
- **A2 — Rhythm unevenness** as the coefficient of variation of inter-key intervals, mapped to 0–100 (Monkeytype `keyConsistency`, `kogasa`). Implement from the formula, not the code.
- **A3 — Learning-rate forecast** ("≈ N sessions to target"), shown only when the regression fit is good (R² ≥ 0.5; keybr `learningrate.ts`).
- **A4 — Visual maps.** Keyboard heatmap of errors and latency (keybr `HeatmapLayer`) and a per-word burst heatmap (Monkeytype).
- **A5 — One concrete next action** (TZ §4.4). No studied product does this: an open lane for 10 points.

### Implementation quality (10)

- **Q1 — Deep packages with co-located tests.** keybr keeps `*.test.ts` next to each module (`keybr-lesson/lib/*.test.ts`), with small packages per concern (lesson, result, textinput, phonetic-model). This matches our deep-module rule.
- **Q2 — Document formulas and sources in-product.** No competitor publishes formulas in-app. TZ §5.4 requires a "Джерела та ліцензії" page; publish the formulas there too.

### Bonuses

- **B1 — Real-time races.** keybr room lifecycle (auto-rooms of 5, 3 s wait, 3-2-1, spectators, idle kick).
- **B2 — Group leaderboard.** TypeRacer-style periodic boards (day/week/month), with an accuracy-weighted score (see FR-X7).
- **B3 — Adaptive generator by slow bigrams.** Unclaimed by any product studied.
- **B4 — Rhythm and error-map visualization** (A2, A4).
- **B5 — Extra layouts.** keybr's layout catalogue shows demand; a separate `layouts` data package keeps this cheap.

## 5. Candidate functional requirements beyond the TZ

| ID | Candidate requirement | One-line rationale |
|---|---|---|
| FR-X1 | Opposite-hand Shift enforcement toggle in Shift drills, with a reminder after N same-hand presses | Makes the TZ §2 Shift rule measurable (Monkeytype `oppositeShiftMode`). |
| FR-X2 | Every attempt is stored as a keystroke event log; all metrics derive from it; attempts can be replayed | Deterministic tests plus a demo of "the corrected error still counts" (Monkeytype). |
| FR-X3 | Optional pace caret / ghost of personal best, disabled under reduced motion | Makes the personal-best comparison tangible without latency cost (Monkeytype). |
| FR-X4 | Per-key and per-transition confidence indicator on the lesson map, hidden during test attempts | Shows progress without becoming a peeking aid (keybr). |
| FR-X5 | "≈ N sessions to target" forecast, shown only when fit quality R² ≥ 0.5 | Honest, motivating forecast (keybr `learningrate.ts`). |
| FR-X6 | Error-free race and tempo-series variant (race or series ends at the Nth error) | Aligns competition with accuracy-first pedagogy (Klavogonki, TypeRacer). |
| FR-X7 | Race and leaderboard score weighted by accuracy, with a minimum accuracy to be ranked | TZ §11 forbids speed counting without accuracy; typing.com dropped Net WPM for this reason. |
| FR-X8 | Race progress computed by an authority from keystrokes, not from client-reported speed | Core anti-cheat property of keybr races. |
| FR-X9 | Result plausibility checks: minimum duration, 40 ms–12 s interval window, CPM cap, result spacing, rate limit | Monkeytype and keybr server practice; cheap and testable. |
| FR-X10 | Verification challenge (text rendered on canvas/image) for leaderboard outliers above certified speed + X% | Standard practice at TypeRacer, 10FastFingers and Klavogonki; needs an accessible alternative. |
| FR-X11 | Ranks = TZ level bands (Ознайомлення…Швидкісний) by record CPM *at the required accuracy* | Reuses the TZ table instead of inventing Klavogonki-style ranks. |
| FR-X12 | AFK detection: pauses > N s excluded from speed and flagged on the attempt | Prevents distorted metrics (keybr 12 s cap, Monkeytype `afkDuration`). |
| FR-X13 | Configurable daily practice goal in minutes (default aligned with the 15–25 min TZ session) | Habit loop (keybr `dailyGoal`, default 30). |
| FR-X14 | Low-vision preset: large text, high contrast, motion and sound off | TypingClub "Low Vision" profile; supports TZ §6. |
| FR-X15 | Per-exercise Backspace policy: free / stop-on-letter / no-Backspace | TypingClub makes Backspace use configurable; Monkeytype confidence modes. |
| FR-X16 | Built-in latency probe (keystroke → paint) in a debug overlay and in Playwright | Proves the sub-16 ms claim with evidence, not assertion. |
| FR-X17 | Weak-key word picker fallback (best of N words by per-character weakness) when bigram data is sparse | Cold-start adaptation (Monkeytype `weak-spot`). |
| FR-X18 | Public "Formulas" section next to "Sources & licenses" | No competitor documents formulas in-app; raises jury trust in metrics (reliability 20). |

## 6. Proposed recommendation

*A proposal; the user decides.*

1. **License posture: clean-room.** Read keybr (AGPL-3.0), Monkeytype (GPL-3.0) and KTouch (GPL-2.0+) for ideas; copy no code and no data from them, including word lists, `model-*.data` and course XML. Use only the TZ-supplied dictionaries and credit the studied products as inspiration in `docs/pedagogy.md`. That keeps our own license choice free.
2. **Learning engine = TZ curriculum on top, keybr-style confidence underneath, applied to transitions.**
   - The unlock order follows the TZ finger map (home row first, then scales), not letter frequency.
   - Inside a unit, track EMA time and miss rate per key *and per bigram/transition*.
   - Pick the focus element as the weakest one; every generated item contains it.
   - Gate unlocks on accuracy ≥ level floor over 3 consecutive attempts; speed targets are advisory at the beginner level.
3. **Metrics module** (pure functions over the event log):
   - `CPM = correct characters / minutes` from the first keystroke; `rawCPM` stored as well.
   - `WPM = CPM / 5` (TZ §4.3).
   - `accuracy = correct character keystrokes / all character keystrokes`: every wrong press counts even after Backspace, and Backspace itself is not in the denominator (Monkeytype definition).
   - `rhythm = 100·(1 − tanh(c + c³/3 + c⁵/5))` over the coefficient of variation `c` of valid inter-key intervals, implemented from the formula.
   - Store per-key and per-transition latency and misses.
4. **Input loop = Monkeytype's architecture, re-implemented.** A hidden input, `beforeinput`/`input`, composition handling, `performance.now()`, append-only event log, and rendering decoupled from logging. Caret animation uses compositor-only transforms, behind a toggle, off under `prefers-reduced-motion`.
5. **Error modes.**
   - Stage 1 scales: stop-on-letter.
   - Stages 2–3: free Backspace, with corrections counted.
   - Tempo series and races: optional error-free variant.
   - Test attempts: no keyboard or next-key hint, but errors stay visible and not color-only (TZ §4.2, §6). Note: Monkeytype's `blindMode` hides *errors*, which is **not** what the TZ means by zero-peek.
6. **Races.**
   - Lifecycle after keybr: rooms of up to 5, group or private rooms by code, 3 s gather then 3-2-1 from a server timestamp, spectators for late joiners, idle→spectator.
   - Supabase Realtime Broadcast is a relay without game authority. So progress is broadcast for display only; the **final result is validated server-side** by replaying the submitted keystroke log against the known race text with FR-X9 plausibility checks before it reaches a leaderboard.
   - Score is accuracy-weighted (FR-X7). Quotas and feasibility belong to the backend research ticket.
7. **Feedback.** A rule engine that emits exactly **one** next action from the weakest element, using templates as in TZ §4.4 (transition + fingers, or "lower tempo to X CPM until accuracy ≥ Y%"). This is the lane no competitor occupies.
8. **Honesty.** README and in-app text describe what anti-cheat can and cannot prove, and that gaze control is impossible without a camera (TZ §3.2, §11).

## 7. Risks

1. **Evidence quality for closed products.** Nitro Type, TypingClub, TypeRacer skill levels and Ratatype details rest on snippets or fan wikis (marked). Do not repeat them in README or pitch as fact.
2. **License contamination by agents.** Coding agents may paste Monkeytype or keybr snippets or word lists. Mitigation: an explicit rule in `AGENTS.md`/`CLAUDE.md` and a code-review check for copied code; data only from the TZ `dictionaries/` manifest.
3. **Race authority on Supabase Free.** There is no long-running game server, and per-keystroke Broadcast traffic may hit message or rate quotas (UNVERIFIED here; the backend ticket must check). Server-side replay validation adds Edge Function or DB-function cost and latency.
4. **Metric-definition drift.** The per-keystroke (Monkeytype) and per-character (keybr) accuracy definitions give different numbers. Pick one, document it, and lock it with TZ §8 tests.
5. **Speed-gated adaptation versus TZ.** Copying keybr's speed target (175 CPM) as an unlock gate would block beginners, contrary to TZ §4.3.
6. **Silent pseudo-words.** keybr fills short word pools with pseudo-words; that would violate TZ §3.2 if replicated.
7. **Verification challenges versus accessibility.** Image or canvas text tests exclude screen-reader users; they need an alternative or must be limited to leaderboard outliers.
8. **Motion versus latency.** Pace caret, smooth caret and race cars can cost frames; they must run on compositor-only properties and be disableable (fixed constraint).
9. **Scope creep.** Races, ranks and anti-cheat can consume time needed for the 30-point pedagogy criterion. TZ §10 bonuses count only after all mandatory requirements are met.
10. **Brand association.** Klavogonki is a Russian service; avoid mirroring its naming or rank names in a Ukrainian-audience product.

## 8. Open questions for the user

1. **Project license.** MIT/Apache with clean-room code (recommended), or AGPL-3.0, which would legally allow reusing keybr code and data but binds the whole app?
2. **Accuracy definition.** Per keystroke, counting every wrong press (Monkeytype; recommended as closest to the TZ wording)? Or per character (keybr)?
3. **Default error mode by stage.** Stop-on-letter for Stage 1 and free Backspace for Stages 2–3: agree?
4. **Race result authority.** Accept client-computed results with plausibility checks only, or invest in server-side keystroke-log replay validation before leaderboard entry?
5. **Race format.** Accuracy-weighted score / error-free variant (pedagogy-aligned) or classic "first to finish wins", or both?
6. **Ranks.** Reuse the TZ level bands (Ознайомлення → Швидкісний) as rank names, or no ranks at MVP?
7. **Verification challenge.** Acceptable for leaderboard outliers, given its accessibility cost?
8. **MVP motion features.** Pace caret / ghost of personal best, and a confidence indicator on the lesson map: in or out?

## 9. Sources

### Open-source code (read locally, shallow clones, 2026-09-13)

- **Monkeytype**, https://github.com/monkeytypegame/monkeytype @ `91bd24bb8513785c7364cbea29296ff7adafac41`:
  - `LICENSE` (GPL-3.0)
  - `frontend/src/ts/input/listeners/input.ts`
  - `frontend/src/ts/input/handlers/insert-text.ts`, `frontend/src/ts/input/handlers/before-delete.ts`
  - `frontend/src/ts/input/helpers/validation.ts`
  - `frontend/src/ts/test/events/stats.ts`, `frontend/src/ts/test/test-logic.ts`
  - `frontend/src/ts/utils/numbers.ts`, `packages/util/src/numbers.ts`
  - `frontend/src/ts/test/weak-spot.ts`, `frontend/src/ts/test/pace-caret.ts`, `frontend/src/ts/test/caret.ts`
  - `frontend/src/ts/test/test-ui.ts`, `frontend/src/ts/test/result.ts`
  - `frontend/src/styles/media-queries.scss`, `frontend/src/ts/utils/misc.ts`
  - `backend/src/api/controllers/result.ts`, `backend/src/utils/validation.ts`, `backend/src/anticheat/index.ts`
  - `frontend/static/languages/ukrainian*.json`, `frontend/static/layouts/ukrainian.json`
  - `frontend/src/ts/events/navigation.ts`
- **Monkeytype issue #255** "Multiplayer": https://github.com/monkeytypegame/monkeytype/issues/255 (via `gh api`)
- **keybr.com**, https://github.com/aradzie/keybr.com @ `541eb0a5f010ead7ce4c580c0bb0d5bb2519185c`:
  - `LICENSE` (AGPL-3.0, §13 at L540–551), `README.md`, `docs/custom_language.md`
  - `packages/keybr-lesson/lib/guided.ts`, `packages/keybr-lesson/lib/key.ts`, `packages/keybr-lesson/lib/target.ts`
  - `packages/keybr-lesson/lib/learningrate.ts`, `packages/keybr-lesson/lib/settings.ts`
  - `packages/keybr-result/lib/keystats.ts`, `packages/keybr-result/lib/speedunit.ts`
  - `packages/keybr-textinput/lib/textinput.ts`, `packages/keybr-textinput/lib/stats.ts`, `packages/keybr-textinput/lib/histogram.ts`
  - `packages/keybr-phonetic-model/lib/filter.ts`, `packages/keybr-phonetic-model/lib/transitiontable.ts`
  - `packages/keybr-generators/lib/generate-languages.ts`
  - `packages/keybr-multiplayer-server/lib/game.ts`, `packages/keybr-multiplayer-server/lib/room.ts`, `packages/keybr-multiplayer-server/lib/types.ts`
  - `packages/keybr-keyboard/lib/language.ts`, `packages/keybr-keyboard/lib/layout/uk_ua.ts`
  - `packages/keybr-phonetic-model-loader/lib/assets.ts`, `packages/keybr-content-words/lib/data/words-uk.json`
  - `packages/page-help/lib/HelpPage.tsx`
  - `packages/keybr-chart/lib/KeyFrequencyHeatmap.tsx`, `packages/keybr-keyboard-ui/lib/HeatmapLayer.tsx`
- **KTouch (KDE)**, https://github.com/KDE/ktouch: `data/courses/ua.xml`, `LICENSES/` (via `gh api`)

### Closed products and official pages

- TypeRacer Blog, "No More Cheating" (2008-05-18): https://blog.typeracer.com/2008/05/18/no-more-cheating/
- TypeRacer Blog, "Accuracy Matters" (2010-03-29): https://blog.typeracer.com/2010/03/29/accuracy-matters/
- TypeRacer Blog, "Introducing points and competitions" (2017-07-26): https://blog.typeracer.com/2017/07/26/introducing-points-and-competitions/
- TypeRacer help, "What do the Skill Levels and Experience Levels mean?" (search snippet only; direct fetch 403): https://teachmehelp.zendesk.com/hc/en-us/articles/14560809798423
- TypeRacer Fandom wiki, "Anti-Cheating Mechanisms" (secondary; direct fetch 402, search snippet): https://typeracer.fandom.com/wiki/Anti-Cheating_Mechanisms
- Nitro Type official pages (JS-only, no content retrievable): https://www.nitrotype.com/support, https://www.nitrotype.com/leagues
- Nitro Type unofficial fan site (secondary): https://nitrotype.net/nitro-type-mastering-the-science-of-typing-speed-and-accuracy/
- Nitro Wiki (secondary, search snippet): https://nitro.fandom.com/wiki/Words_per_minute
- Typing.com, "Nitro Type Lessons": https://www.typing.com/student/lesson/377/nitro-type-lessons
- Klavogonki — Клавопедия "Ранги": https://klavogonki.ru/wiki/Ранги
- Klavogonki — Клавопедия "Режимы": https://klavogonki.ru/wiki/Режимы
- Klavogonki — Клавопедия "Читеры": https://klavogonki.ru/wiki/Читеры
- Klavogonki FAQ: https://klavogonki.ru/about/faq/
- Wikipedia (ru), "Клавогонки": https://ru.wikipedia.org/wiki/Клавогонки
- TypingClub help docs (search snippets; direct fetch 403):
  - https://s.typingclub.com/docs/student-management/track-progress/results-page.html
  - https://s.typingclub.com/docs/student-management/student-settings/adjust-student-difficulty.html
  - https://m.typingclub.com/docs/class-management/class-settings.html
  - https://static.typingclub.com/m/edclubdocs/media/pdf/accessibility-features.pdf
- Ratatype: https://www.ratatype.com/courses/ukrainian/, https://www.ratatype.com/faq/, https://www.ratatype.com/faq/How-can-I-get-a-typing-certificate/
- typing.com, "What is Words per Minute": https://www.typing.com/blog/what-is-words-per-minute/
- typing.com accessibility page: https://www.typing.com/accessibility
- typing.com support, "Understand the Achievements Tab" (search snippet): https://support.typing.com/en/articles/9047233
- 10FastFingers FAQ: https://10fastfingers.com/faq
- TypingStudy Ukrainian lesson 1: https://www.typingstudy.com/uk-ukrainian-2/lesson/1
- Stamina online (search snippet; direct fetch 403): https://staminaon.ru/uk/
- Тиканка: https://ed-info.github.io/tykanka/
- Secondary (UNVERIFIED claims only):
  - VerseQ: https://brainapps.io/blog/2025/02/best-keyboard-trainers-for-fast/
  - Соло на клавіатурі: https://blogchain.com.ua/5-populiarnykh-klaviaturnykh-trenazheriv/

### Hackathon

- TZ: `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md` §2–§4, §6, §8, §10, §11 (main checkout)
